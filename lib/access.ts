import 'server-only'
import type {User} from '@supabase/supabase-js'
import {sanityFetch} from './sanity/fetch'
import {ACCESS_QUERY} from './sanity/queries'
import type {ACCESS_QUERY_RESULT} from './sanity/types.generated'

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

const PERMANENT_VIEWERS = new Set(
  (process.env.PERMANENT_VIEWER_EMAILS ?? 'labelrelationships@vydia.com,creativeservices@vydia.com')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean),
)

export type AccessDecision =
  {status: 'granted'; artistId: string} | {status: 'redirect'; canonicalSlug: string} | {status: 'denied'}

export function isInternalViewer(email: string, internalViewers: string[] | null | undefined) {
  const normalized = normalizeEmail(email)
  return PERMANENT_VIEWERS.has(normalized) || (internalViewers ?? []).some((v) => normalizeEmail(v) === normalized)
}

export function decideAccess(requestedSlug: string, email: string | null, lookup: ACCESS_QUERY_RESULT): AccessDecision {
  const {artist} = lookup
  if (!email || !artist?.slug) return {status: 'denied'}

  const normalized = normalizeEmail(email)
  const allowed =
    isInternalViewer(normalized, lookup.internalViewers) ||
    (artist.allowedEmails ?? []).some((allowedEmail) => normalizeEmail(allowedEmail) === normalized)

  if (!allowed) return {status: 'denied'}
  if (artist.slug !== requestedSlug) return {status: 'redirect', canonicalSlug: artist.slug}
  return {status: 'granted', artistId: artist._id}
}

export function verifiedEmail(user: User | null): string | null {
  if (!user?.email || !user.email_confirmed_at) return null
  return user.email
}

export function normalizeSlug(rawSlug: string) {
  try {
    return decodeURIComponent(rawSlug).toLowerCase()
  } catch {
    return rawSlug.toLowerCase()
  }
}

export async function resolveArtistAccess(rawSlug: string, user: User | null): Promise<AccessDecision> {
  const slug = normalizeSlug(rawSlug)
  const lookup = await sanityFetch(ACCESS_QUERY, {slug}, ['artist', 'website'])
  return decideAccess(slug, verifiedEmail(user), lookup)
}
