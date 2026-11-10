import {createClient} from '@supabase/supabase-js'
import {createUploadTarget} from '@/app/(admin)/admin/(panel)/uploads/actions'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'
import type {ResourceType} from '@/lib/resources/types'
import type {Database} from '@/lib/supabase/database.types'
import {mimeFor, type UploadKind} from './upload-rules'

const storage = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
}).storage

export class UploadError extends Error {}

export async function uploadAsset(args: {
  resourceId: string
  kind: UploadKind
  resourceType: ResourceType
  file: File | Blob
  fileName: string
}): Promise<string> {
  const contentType = mimeFor({type: args.file.type, name: args.fileName})
  const target = await createUploadTarget({
    resourceId: args.resourceId,
    kind: args.kind,
    resourceType: args.resourceType,
    fileName: args.fileName,
    contentType,
    size: args.file.size,
  })
  if (!target.ok) throw new UploadError(target.message)
  const {error} = await storage
    .from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, args.file, {contentType})
  if (error) throw new UploadError('The upload failed. Check your connection and try again.')
  return target.path
}
