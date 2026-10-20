'use server'
import {redirect} from 'next/navigation'
import {SITE_URL} from '@/lib/env'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

export type AuthState = {error?: string; message?: string}

const field = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

const callbackUrl = (next: string) => `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const {error} = await supabase.auth.signInWithPassword({
    email: field(form, 'email').trim(),
    password: field(form, 'password'),
  })
  if (error) return {error: 'Invalid email or password, or your email isn’t confirmed yet.'}
  redirect(safeNext(field(form, 'next')))
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const {error} = await supabase.auth.signUp({
    email: field(form, 'email').trim(),
    password: field(form, 'password'),
    options: {emailRedirectTo: callbackUrl(safeNext(field(form, 'next')))},
  })
  if (error?.code === 'weak_password') return {error: 'Use a password with at least 8 characters.'}
  if (error?.code === 'over_email_send_rate_limit')
    return {error: 'Too many sign-up emails were sent just now. Please wait a few minutes and try again.'}
  if (error && error.code !== 'user_already_exists') return {error: 'We couldn’t create your login. Please try again.'}
  return {message: 'Check your inbox for a confirmation link to finish signing up.'}
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(field(form, 'email').trim(), {
    redirectTo: callbackUrl('/account/update-password'),
  })
  return {message: 'If that email has an account, a reset link is on its way.'}
}
