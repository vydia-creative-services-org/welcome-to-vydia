'use server'
import {headers} from 'next/headers'
import {EMAIL_PATTERN, normalizeEmail} from '@/lib/email'
import {SITE_URL} from '@/lib/env'
import {field} from '@/lib/form'
import {isValidSlug, normalizeSlug} from '@/lib/slug'
import {createServiceClient} from '@/lib/supabase/service'
import {createStatelessClient} from '@/lib/supabase/stateless'

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

  const {data: approved, error} = await service.rpc('email_can_access_slug', {p_slug: slug, p_email: email})
  if (error) {
    console.error('email_can_access_slug failed:', error.code)
    return {status: 'error'}
  }
  if (!approved || !isValidSlug(slug)) return {status: 'not-approved'}

  const {data: maySend} = await service.rpc('claim_link_send', {p_email: email})
  if (!maySend) return {status: 'sent', email}

  const {error: sendError} = await createStatelessClient().auth.signInWithOtp({
    email,
    options: {shouldCreateUser: true, emailRedirectTo: `${SITE_URL}/${slug}`},
  })
  if (sendError && sendError.code !== 'over_email_send_rate_limit') {
    console.error('Magic link not sent:', sendError.code ?? sendError.message)
    return {status: 'error'}
  }
  return {status: 'sent', email}
}
