import {createServerClient} from '@supabase/ssr'
import {NextResponse, type NextRequest} from 'next/server'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'
import type {Database} from './database.types'

const ADMIN_PUBLIC_PATHS = ['/admin/login', '/admin/auth/callback']

export const needsAdminSession = (path: string) =>
  (path === '/admin' || path.startsWith('/admin/')) && !ADMIN_PUBLIC_PATHS.includes(path)

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({request})

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({name, value}) => request.cookies.set(name, value))
        response = NextResponse.next({request})
        toSet.forEach(({name, value, options}) => response.cookies.set(name, value, options))
      },
    },
  })

  const {data} = await supabase.auth.getClaims()
  const path = request.nextUrl.pathname

  if (!data?.claims && needsAdminSession(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = ''
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}
