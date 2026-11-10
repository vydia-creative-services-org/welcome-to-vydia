import 'server-only'
import {redirect} from 'next/navigation'
import {cache} from 'react'
import type {Database} from '@/lib/supabase/database.types'
import {createClient} from '@/lib/supabase/server'

export type AdminRole = Database['public']['Enums']['admin_role']

export const getAdmin = cache(async () => {
  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  const email = typeof auth?.claims?.email === 'string' ? auth.claims.email.toLowerCase() : null
  if (!email) return null

  const {data: admin} = await supabase
    .from('admins')
    .select('email, display_name, avatar_url, role')
    .eq('email', email)
    .maybeSingle()
  return admin ? {supabase, admin, isSuper: admin.role === 'super'} : null
})

export type AdminSession = NonNullable<Awaited<ReturnType<typeof getAdmin>>>

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdmin()
  if (session) return session
  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  redirect(auth?.claims ? '/admin/login?error=no-access' : '/admin/login')
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin()
  if (!session.isSuper) redirect('/admin')
  return session
}
