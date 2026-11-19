// app/api/health/route.ts — cs-monitor health route. Contract: lib/health.ts
import {healthResponse, notFound, requireEnv, type Check} from '@/lib/health'
import {resendKey} from '@/lib/health-checks/resend'
import {supabaseAuth, supabaseGoogleEnabled, supabaseTable} from '@/lib/health-checks/supabase'

// Env is read when a check runs, not at import, so a missing variable fails that check instead of the route.
const supabaseEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']

const withSupabase =
  (make: (url: string, key: string) => Check): Check =>
  (signal) => {
    requireEnv(...supabaseEnv)
    return make(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)(signal)
  }

export function GET(req: Request) {
  return healthResponse(req, {
    // CRITICAL — the site can't serve users without these. Fail → 503 → DOWN.
    supabase_auth: withSupabase((url, key) => supabaseAuth(url, key)),
    // Google sign-in enabled in Supabase Auth settings.
    supabase_google: withSupabase((url, key) => supabaseGoogleEnabled(url, key)),
    // Empty-body POST: Resend answers 422 when the key is valid and sends nothing (401 for a bad key).
    resend_key: resendKey,
    // One-row read through the app's own service client (anon has no grant on `resources`; visitors read through
    // RLS-limited sessions). Needs SUPABASE_SECRET_KEY, which sign-in approval needs too. Zero rows is fine.
    supabase_db: async (signal) => {
      const {createServiceClient} = await import('@/lib/supabase/service') // lazy: env errors fail this check only
      return supabaseTable(createServiceClient(), 'resources')(signal)
    },
  })
}

export const POST = notFound
export const HEAD = notFound
