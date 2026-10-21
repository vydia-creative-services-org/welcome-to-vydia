'use server'
import {redirect} from 'next/navigation'
import {after} from 'next/server'
import {canSignIn, normalizeEmail} from '@/lib/access'
import {SITE_URL} from '@/lib/env'
import {field} from '@/lib/form'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'
import {createStatelessClient} from '@/lib/supabase/stateless'
import {EMAIL_PATTERN} from '@/sanity/schemaTypes/shared'

export type LinkState = {sentTo?: string; error?: string}

export async function sendMagicLink(_: LinkState, form: FormData): Promise<LinkState> {
  const email = normalizeEmail(field(form, 'email'))
  if (!EMAIL_PATTERN.test(email)) return {error: 'Enter your full email address.'}
  // The email template puts this into a query string as-is, so drop any query of our own (artist pages have none).
  const redirectTo = `${SITE_URL}${safeNext(field(form, 'next')).split('?')[0]}`

  // The lookup and the send happen after the response, so approved and unknown emails get the same answer at the
  // same speed and this form can't reveal who is a Vydia client.
  after(async () => {
    try {
      if (!(await canSignIn(email))) return
      const {error} = await createStatelessClient().auth.signInWithOtp({
        email,
        options: {shouldCreateUser: true, emailRedirectTo: redirectTo},
      })
      if (error) console.error('Magic link not sent:', error.code ?? error.message)
    } catch (error) {
      console.error('Magic link not sent:', error)
    }
  })

  return {sentTo: email}
}

export async function signInWithGoogle(form: FormData) {
  const next = safeNext(field(form, 'next'))
  const supabase = await createClient()
  const {data, error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {prompt: 'select_account'},
    },
  })
  if (error || !data.url) redirect(`/login?error=google&next=${encodeURIComponent(next)}`)
  redirect(data.url)
}
