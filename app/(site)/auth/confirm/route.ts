import type {EmailOtpType} from '@supabase/supabase-js'
import {NextResponse, type NextRequest} from 'next/server'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = OTP_TYPES.find((otpType) => otpType === searchParams.get('type'))
  const next = safeNext(searchParams.get('redirect_to') ?? searchParams.get('next'))

  if (tokenHash && type) {
    const supabase = await createClient()
    const {error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash})
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=link`)
}
