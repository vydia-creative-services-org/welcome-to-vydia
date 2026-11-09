import {NextResponse, type NextRequest} from 'next/server'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

const JUST_SIGNED_IN_SECONDS = 60
const NO_STORE = {'Cache-Control': 'no-store'}

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const next = safeNext(searchParams.get('redirect_to'))
  const expired = () =>
    NextResponse.redirect(`${origin}/auth/expired?next=${encodeURIComponent(next)}`, {headers: NO_STORE})

  const tokenHash = searchParams.get('token_hash')
  if (!tokenHash) return expired()

  const supabase = await createClient()
  const {error} = await supabase.auth.verifyOtp({type: 'email', token_hash: tokenHash})
  if (!error) return NextResponse.redirect(`${origin}${next}`, {headers: NO_STORE})

  const {data} = await supabase.auth.getClaims()
  const now = Date.now() / 1000
  const justSignedIn = (data?.claims.amr ?? []).some(
    (entry) =>
      typeof entry === 'object' &&
      (entry.method === 'otp' || entry.method === 'magiclink') &&
      now - entry.timestamp < JUST_SIGNED_IN_SECONDS,
  )
  return justSignedIn ? NextResponse.redirect(`${origin}${next}`, {headers: NO_STORE}) : expired()
}
