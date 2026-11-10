'use server'
import {refresh} from 'next/cache'
import {z} from 'zod'
import {requireAdmin} from '@/lib/admin/auth'
import {sweepStorage} from '@/lib/admin/storage'
import {resourceInput, type ResourceInputValue} from '@/lib/validation'

export type ResourceResult = {ok: true} | {ok: false; errors: Record<string, string>}

export async function upsertMainResource(input: ResourceInputValue): Promise<ResourceResult> {
  const {supabase} = await requireAdmin()
  const parsed = resourceInput.safeParse(input)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message
    return {ok: false, errors}
  }
  const resource = parsed.data

  const {data: existing} = await supabase.from('resources').select('client_id').eq('id', resource.id).maybeSingle()
  if (existing && existing.client_id !== null) return {ok: false, errors: {form: 'That resource belongs to a client.'}}

  const {error} = await supabase.from('resources').upsert({
    id: resource.id,
    client_id: null,
    title: resource.title,
    type: resource.type,
    file: resource.file,
    url: resource.url,
    cover_image: resource.coverImage,
    cover_image_alt: resource.coverImageAlt,
    cover_image_lqip: resource.coverImageLqip,
    pdf_preview: resource.pdfPreview,
    pdf_preview_lqip: resource.pdfPreviewLqip,
    category: resource.category,
    ...(resource.addedOn ? {added_on: resource.addedOn} : {}),
  })
  if (error) {
    console.error('upsert main resource failed:', error.code, error.message)
    return {ok: false, errors: {form: 'Couldn’t save the resource. Nothing was changed.'}}
  }

  await sweepStorage(supabase)
  refresh()
  return {ok: true}
}

export async function deleteMainResource(id: string): Promise<{ok: boolean}> {
  const {supabase} = await requireAdmin()
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return {ok: false}
  const {error} = await supabase.from('resources').delete().eq('id', parsed.data).is('client_id', null)
  if (error) return {ok: false}
  await sweepStorage(supabase)
  refresh()
  return {ok: true}
}

export async function reorderMainResources(ids: string[]): Promise<{ok: boolean}> {
  const {supabase} = await requireAdmin()
  const parsed = z.array(z.uuid()).safeParse(ids)
  if (!parsed.success) return {ok: false}
  const {error} = await supabase.rpc('reorder_main_resources', {ids: parsed.data})
  if (error) return {ok: false}
  refresh()
  return {ok: true}
}
