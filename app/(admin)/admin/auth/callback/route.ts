import {NextResponse, type NextRequest} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const noAccess = () => NextResponse.redirect(`${origin}/admin/login?error=no-access`)

  const code = searchParams.get('code')
  if (!code) return noAccess()

  const supabase = await createClient()
  const {error} = await supabase.auth.exchangeCodeForSession(code)
  if (error) return noAccess()

  const {data: isAdmin} = await supabase.rpc('claim_admin_profile')
  if (!isAdmin) {
    await supabase.auth.signOut()
    return noAccess()
  }
  return NextResponse.redirect(`${origin}/admin`)
}
