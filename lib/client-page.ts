import 'server-only'
import {cache} from 'react'
import {z} from 'zod'
import {groupByCategory, type CategoryGroup} from '@/lib/resources/group'
import {fromRow, toCard} from '@/lib/resources/mapping'
import {RESOURCE_TYPE_VALUES, type ResourceCardData} from '@/lib/resources/types'
import {isValidSlug, normalizeSlug} from '@/lib/slug'
import {createClient} from '@/lib/supabase/server'

export type ClientPage = {clientName: string; groups: CategoryGroup<ResourceCardData>[]}

const resourceRow = z.object({
  id: z.string(),
  client_id: z.string().nullable(),
  title: z.string(),
  type: z.enum(RESOURCE_TYPE_VALUES),
  file: z.string().nullable(),
  url: z.string().nullable(),
  cover_image: z.string().nullable(),
  cover_image_alt: z.string().nullable(),
  cover_image_hotspot: z.json().nullable(),
  cover_image_lqip: z.string().nullable(),
  pdf_preview: z.string().nullable(),
  pdf_preview_lqip: z.string().nullable(),
  category: z.string(),
  sort_order: z.number(),
  added_on: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

const pagePayload = z.object({
  client: z.object({id: z.string(), name: z.string()}),
  resources: z.array(resourceRow),
})

export const getClientPage = cache(async (rawSlug: string): Promise<ClientPage | null> => {
  const slug = normalizeSlug(rawSlug)
  if (!isValidSlug(slug)) return null

  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  if (!auth?.claims) return null

  const {data, error} = await supabase.rpc('get_client_page', {p_slug: slug})
  if (error) {
    console.error('get_client_page failed:', error.code)
    return null
  }
  if (!data) return null

  const parsed = pagePayload.safeParse(data)
  if (!parsed.success) {
    console.error('get_client_page returned an unexpected shape')
    return null
  }

  const cards = parsed.data.resources
    .map((row) => toCard(fromRow(row)))
    .filter((card): card is ResourceCardData => card !== null)
  return {clientName: parsed.data.client.name, groups: groupByCategory(cards)}
})
