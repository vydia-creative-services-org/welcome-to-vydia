'use server'
import {redirect} from 'next/navigation'
import {field} from '@/lib/form'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

export async function confirmSignIn(form: FormData) {
  const next = safeNext(field(form, 'next'))
  const supabase = await createClient()
  const {error} = await supabase.auth.verifyOtp({type: 'email', token_hash: field(form, 'token_hash')})
  if (!error) redirect(next)
  // A double click spends the token on the first submit; the second still has a session, so let it through.
  const {data} = await supabase.auth.getClaims()
  if (data?.claims) redirect(next)
  redirect(`/login?error=link&next=${encodeURIComponent(next)}`)
}
