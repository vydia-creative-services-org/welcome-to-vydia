'use server'
import {z} from 'zod'
import {requireAdmin} from '@/lib/admin/auth'
import {extensionOf, fileTypeAllowed, fileTypeMessage, IMAGE_MESSAGE, imageAllowed} from '@/lib/admin/upload-rules'
import {RESOURCE_TYPE_VALUES} from '@/lib/resources/types'

const uploadRequest = z.object({
  resourceId: z.uuid(),
  kind: z.enum(['file', 'cover', 'preview']),
  resourceType: z.enum(RESOURCE_TYPE_VALUES),
  fileName: z.string().max(200),
  contentType: z.string().max(120),
  size: z.number().int().positive(),
})

export type UploadRequest = z.input<typeof uploadRequest>

export type UploadTarget = {ok: true; bucket: string; path: string; token: string} | {ok: false; message: string}

export async function createUploadTarget(input: UploadRequest): Promise<UploadTarget> {
  const {supabase, isSuper} = await requireAdmin()
  const parsed = uploadRequest.safeParse(input)
  if (!parsed.success) return {ok: false, message: 'That upload isn’t valid.'}
  const request = parsed.data

  if (!isSuper) {
    const {data: existing} = await supabase
      .from('resources')
      .select('client_id')
      .eq('id', request.resourceId)
      .maybeSingle()
    if (existing && existing.client_id === null) {
      return {ok: false, message: 'Only super admins can change core resources.'}
    }
  }

  const isImage = request.kind !== 'file'
  if (isImage && !imageAllowed(request.contentType, request.size)) return {ok: false, message: IMAGE_MESSAGE}
  if (!isImage && !fileTypeAllowed(request.resourceType, request.contentType)) {
    return {ok: false, message: fileTypeMessage(request.resourceType, request.contentType)}
  }

  const extension = extensionOf(request.fileName).replace(/[^a-z0-9]/g, '')
  const bucket = isImage ? 'resource-images' : 'resource-files'
  const path = `${request.resourceId}/${request.kind}-${crypto.randomUUID()}${extension ? `.${extension}` : ''}`
  const {data, error} = await supabase.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) return {ok: false, message: 'Uploads aren’t available right now. Try again.'}
  return {ok: true, bucket, path: data.path, token: data.token}
}
