import {SUPABASE_URL} from '@/lib/env'
import type {Database, Json} from '@/lib/supabase/database.types'
import type {Hotspot, Resource, ResourceCardData} from './types'

type Row = Database['public']['Tables']['resources']['Row']

export const RESOURCE_FIELD_MAP = {
  title: 'title',
  type: 'type',
  file: 'file',
  url: 'url',
  coverImage: 'cover_image',
  pdfPreview: 'pdf_preview',
  addedOn: 'added_on',
  category: 'category',
  sortOrder: 'sort_order',
} as const satisfies Record<string, keyof Row>

export const publicImageUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/resource-images/${path.split('/').map(encodeURIComponent).join('/')}`

function toHotspot(value: Json | null): Hotspot | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const {x, y} = value
  return typeof x === 'number' && typeof y === 'number' ? {x, y} : null
}

export function fromRow(row: Row): Resource {
  return {
    id: row.id,
    artistId: row.artist_id,
    title: row.title,
    type: row.type,
    file: row.file,
    url: row.url,
    coverImage: row.cover_image
      ? {
          path: row.cover_image,
          alt: row.cover_image_alt,
          hotspot: toHotspot(row.cover_image_hotspot),
          lqip: row.cover_image_lqip,
        }
      : null,
    pdfPreview: row.pdf_preview ? {path: row.pdf_preview, lqip: row.pdf_preview_lqip} : null,
    category: row.category,
    sortOrder: row.sort_order,
    addedOn: row.added_on,
  }
}

export function toCard(resource: Resource): ResourceCardData | null {
  const href = resource.url ?? (resource.file ? `/api/resources/${resource.id}/file` : null)
  if (!href) return null
  const image = resource.coverImage ?? resource.pdfPreview
  const hotspot = resource.coverImage?.hotspot
  return {
    id: resource.id,
    title: resource.title,
    type: resource.type,
    category: resource.category,
    href,
    cover: image && {
      src: publicImageUrl(image.path),
      alt: resource.coverImage?.alt ?? '',
      position: hotspot ? `${hotspot.x * 100}% ${hotspot.y * 100}%` : 'center',
      lqip: image.lqip,
    },
  }
}
