import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'

const SIGNED_URL_TTL_SECONDS = 60 * 60
const NO_STORE = {'Cache-Control': 'no-store'}

const notFound = () => new NextResponse('Not found', {status: 404, headers: NO_STORE})

export async function GET(_: Request, context: RouteContext<'/api/resources/[id]/file'>) {
  const {id} = await context.params
  const supabase = await createClient()

  const {data} = await supabase.from('resources').select('file').eq('id', id).maybeSingle()
  if (!data?.file) return notFound()

  const {data: signed, error} = await supabase.storage
    .from('resource-files')
    .createSignedUrl(data.file, SIGNED_URL_TTL_SECONDS)
  if (error || !signed) return notFound()

  return NextResponse.redirect(signed.signedUrl, {status: 302, headers: {'Cache-Control': 'private, no-store'}})
}
