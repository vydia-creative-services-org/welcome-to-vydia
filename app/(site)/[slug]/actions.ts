'use server'
import {headers} from 'next/headers'
import {sendAccessLink} from '@/lib/access-links'
import {EMAIL_PATTERN, normalizeEmail} from '@/lib/email'
import {field} from '@/lib/form'
import {isValidSlug, normalizeSlug} from '@/lib/slug'
import {createServiceClient} from '@/lib/supabase/service'

export type LinkState =
  | {status: 'idle'}
  | {status: 'invalid'}
  | {status: 'not-approved'}
  | {status: 'rate-limited'}
  | {status: 'error'}
  | {status: 'sent'; email: string}

const IP_LIMIT = 20
const IP_WINDOW = '10 minutes'

export async function sendLink(_: LinkState, form: FormData): Promise<LinkState> {
  const email = normalizeEmail(field(form, 'email'))
  const slug = normalizeSlug(field(form, 'slug'))
  if (!EMAIL_PATTERN.test(email)) return {status: 'invalid'}

  const service = createServiceClient()
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const {data: underLimit} = await service.rpc('hit_rate_limit', {
    p_key: `link:ip:${ip}`,
    p_limit: IP_LIMIT,
    p_window: IP_WINDOW,
  })
  if (underLimit === false) return {status: 'rate-limited'}

  // One lookup answers both "is this email on this client" and "which link do they get". A wrong email and an
  // unknown slug both come back empty, so the answer can't reveal whether a slug exists.
  const {data: links, error} = await service.rpc('access_link_for', {p_slug: slug, p_email: email})
  if (error) {
    console.error('access_link_for failed:', error.code)
    return {status: 'error'}
  }
  const link = links[0]
  if (!link || !isValidSlug(slug)) return {status: 'not-approved'}

  // One send per email per client page every 60 seconds, so asking on two clients' pages sends both.
  const {data: maySend} = await service.rpc('claim_link_send', {p_email: email, p_slug: slug})
  if (!maySend) return {status: 'sent', email}

  // The same permanent link as the welcome email, so nothing a client is sent ever expires.
  if (!(await sendAccessLink(link, service))) return {status: 'error'}
  return {status: 'sent', email}
}
