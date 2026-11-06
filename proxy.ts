import type {NextRequest} from 'next/server'
import {updateSession} from '@/lib/supabase/proxy'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|studio|api/revalidate|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|mjs)$).*)',
  ],
}
