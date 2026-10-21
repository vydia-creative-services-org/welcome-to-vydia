import {revalidateTag} from 'next/cache'
import {NextResponse, type NextRequest} from 'next/server'
import {parseBody} from 'next-sanity/webhook'
import type {SanityTag} from '@/lib/sanity/fetch'

const TAGS: readonly SanityTag[] = ['artist', 'resource', 'website']

export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  if (!secret) return new NextResponse('Webhook secret is not configured', {status: 500})

  const {isValidSignature, body} = await parseBody<{_type?: string}>(request, secret, true)
  if (isValidSignature !== true) return new NextResponse('Invalid signature', {status: 401})

  const tag = TAGS.find((t) => t === body?._type)
  if (!tag) return new NextResponse('Ignored document type', {status: 400})

  revalidateTag(tag, {expire: 0})
  return NextResponse.json({revalidated: tag, now: Date.now()})
}
