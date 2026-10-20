import 'server-only'
import {createServerClient} from '@supabase/ssr'
import {cookies} from 'next/headers'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({name, value, options}) => cookieStore.set(name, value, options))
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  })
}
