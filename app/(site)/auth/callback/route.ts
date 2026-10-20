import {NextResponse, type NextRequest} from 'next/server'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const supabase = await createClient()

  if (code) {
    const {error} = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  } else {
    const {data} = await supabase.auth.getClaims()
    if (data?.claims) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=link&next=${encodeURIComponent(next)}`)
}
