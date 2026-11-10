'use server'
import {redirect} from 'next/navigation'
import {requireAdmin} from '@/lib/admin/auth'
import {mapSaveError} from '@/lib/admin/errors'
import {sweepStorage} from '@/lib/admin/storage'
import {artistPayload, type ArtistInput} from '@/lib/validation'

export type SaveResult = {ok: false; fieldErrors: Record<string, string>; formError?: string}

export async function saveArtist(input: ArtistInput): Promise<SaveResult> {
  const {supabase} = await requireAdmin()
  const parsed = artistPayload.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message
    return {ok: false, fieldErrors}
  }

  const {data: id, error} = await supabase.rpc('save_artist', {payload: parsed.data})
  if (error) {
    const mapped = mapSaveError(error)
    if (mapped) return {ok: false, fieldErrors: {[mapped.field]: mapped.message}}
    console.error('save_artist failed:', error.code, error.message)
    return {ok: false, fieldErrors: {}, formError: 'Couldn’t save. Nothing was changed. Try again.'}
  }

  await sweepStorage(supabase)
  redirect(`/admin/artists/${id}?saved=1`)
}

export async function deleteArtist(id: string): Promise<{ok: false; message: string}> {
  const {supabase} = await requireAdmin()
  const {error} = await supabase.from('artists').delete().eq('id', id)
  if (error) return {ok: false, message: 'Couldn’t delete the artist. Nothing was changed.'}
  await sweepStorage(supabase)
  redirect('/admin')
}
