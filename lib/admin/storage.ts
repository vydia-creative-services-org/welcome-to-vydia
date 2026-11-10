import 'server-only'
import type {ServerClient} from '@/lib/supabase/server'

export async function sweepStorage(supabase: ServerClient) {
  const {data, error} = await supabase.rpc('take_storage_garbage')
  if (error || !data?.length) return
  const byBucket = new Map<string, string[]>()
  for (const {bucket, path} of data) byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path])
  for (const [bucket, paths] of byBucket) {
    const {error: removeError} = await supabase.storage.from(bucket).remove(paths)
    if (removeError) console.error(`storage cleanup failed for ${bucket}:`, removeError.message)
  }
}
