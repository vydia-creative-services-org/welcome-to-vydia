'use server'
import {redirect} from 'next/navigation'
import {SITE_URL} from '@/lib/env'
import {createClient} from '@/lib/supabase/server'

export async function signInWithGoogle() {
  const supabase = await createClient()
  const {data, error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_URL}/admin/auth/callback`,
      queryParams: {prompt: 'select_account', hd: 'vydia.com'},
    },
  })
  if (error || !data.url) redirect('/admin/login?error=google')
  redirect(data.url)
}
