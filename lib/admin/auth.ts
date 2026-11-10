import 'server-only'
import {redirect} from 'next/navigation'
import {cache} from 'react'
import {createClient} from '@/lib/supabase/server'

export const getAdmin = cache(async () => {
  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  if (!auth?.claims) return null
  const {data: admin} = await supabase.from('admins').select('email, display_name, avatar_url').maybeSingle()
  return admin ? {supabase, admin} : null
})

export async function requireAdmin() {
  const session = await getAdmin()
  if (session) return session
  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  redirect(auth?.claims ? '/admin/login?error=no-access' : '/admin/login')
}
