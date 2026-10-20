import {createServerClient} from '@supabase/ssr'
import {NextResponse, type NextRequest} from 'next/server'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'

const PUBLIC_EXACT = ['/']
const PUBLIC_PREFIXES = ['/login', '/auth']

export const isPublicPath = (path: string) =>
  PUBLIC_EXACT.includes(path) || PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({request})

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
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

  if (!data?.claims && !isPublicPath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', path)
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}
