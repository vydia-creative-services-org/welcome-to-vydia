import {NextResponse, type NextRequest} from 'next/server'
import {canSignIn, verifiedEmail} from '@/lib/access'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const supabase = await createClient()

  if (code) {
    const {data, error} = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const email = verifiedEmail(data.user)
      if (email && (await canSignIn(email))) return NextResponse.redirect(`${origin}${next}`)
      // Supabase creates a user for any Google account; an unapproved one never keeps a session.
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=not-approved&next=${encodeURIComponent(next)}`)
    }
  } else {
    const {data} = await supabase.auth.getClaims()
    if (data?.claims) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=link&next=${encodeURIComponent(next)}`)
}
