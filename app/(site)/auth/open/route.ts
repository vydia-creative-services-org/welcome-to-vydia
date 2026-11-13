import {NextResponse, type NextRequest} from 'next/server'
import {normalizeEmail} from '@/lib/email'
import {createClient} from '@/lib/supabase/server'
import {createServiceClient} from '@/lib/supabase/service'

const NO_STORE = {'Cache-Control': 'no-store'}
const TOKEN = /^[0-9a-f]{64}$/

// A permanent link from the welcome email. It never expires and can be opened any number of times, in any browser.
// Removing the email from the client deletes the link. The page itself still checks access on every load.
export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const go = (path: string) => NextResponse.redirect(`${origin}${path}`, {headers: NO_STORE})

  const token = searchParams.get('t') ?? ''
  if (!TOKEN.test(token)) return go('/auth/inactive')

  const service = createServiceClient()
  const {data, error} = await service.rpc('open_access_link', {p_token: token})
  if (error) {
    console.error('open_access_link failed:', error.code)
    return go('/auth/inactive?reason=error')
  }
  const link = data[0]
  if (!link) return go('/auth/inactive')
  const page = `/${link.slug}`

  const supabase = await createClient()
  const {data: current} = await supabase.auth.getClaims()
  const currentEmail = current?.claims.email
  if (typeof currentEmail === 'string' && normalizeEmail(currentEmail) === link.email) return go(page)

  // Mint a one-time token for this email without sending anything, and spend it right away to start the session.
  const {data: generated, error: generateError} = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: link.email,
  })
  if (generateError) {
    console.error('generateLink failed:', generateError.code ?? generateError.message)
    return go('/auth/inactive?reason=error')
  }
  const {error: verifyError} = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: generated.properties.hashed_token,
  })
  if (verifyError) {
    console.error('verifyOtp failed:', verifyError.code ?? verifyError.message)
    return go('/auth/inactive?reason=error')
  }
  return go(page)
}
