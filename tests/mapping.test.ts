import {beforeAll, describe, expect, expectTypeOf, it} from 'vitest'
import type {Resource, ResourceType} from '@/lib/resources/types'
import type {Database} from '@/lib/supabase/database.types'

type Row = Database['public']['Tables']['resources']['Row']
type Mapping = typeof import('@/lib/resources/mapping')

let mapping: Mapping

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://welcometovydia.com'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  mapping = await import('@/lib/resources/mapping')
})

const row = (overrides: Partial<Row> = {}): Row => ({
  id: 'r1',
  artist_id: null,
  title: 'Vydia Dashboard Walkthrough',
  type: 'link',
  file: null,
  url: 'https://example.com/a',
  cover_image: null,
  cover_image_alt: null,
  cover_image_hotspot: null,
  cover_image_lqip: null,
  pdf_preview: null,
  pdf_preview_lqip: null,
  category: 'Getting Started',
  sort_order: 1,
  added_on: '2026-01-01T12:00:00Z',
  created_at: '2026-01-01T12:00:00Z',
  updated_at: '2026-01-01T12:00:00Z',
  ...overrides,
})

const resource = (overrides: Partial<Row> = {}): Resource => mapping.fromRow(row(overrides))

describe('types', () => {
  it('uses the database enum as the resource type', () => {
    expectTypeOf<Database['public']['Enums']['resource_type']>().toEqualTypeOf<ResourceType>()
  })
})

describe('fromRow', () => {
  it('maps the columns to the Sanity field names', () => {
    expect(resource({sort_order: 4})).toMatchObject({
      id: 'r1',
      artistId: null,
      title: 'Vydia Dashboard Walkthrough',
      type: 'link',
      category: 'Getting Started',
      sortOrder: 4,
      addedOn: '2026-01-01T12:00:00Z',
      coverImage: null,
      pdfPreview: null,
    })
  })

  it('reads a valid hotspot and ignores a malformed one', () => {
    const good = resource({cover_image: 'r1/cover.webp', cover_image_hotspot: {x: 0.25, y: 0.75}})
    const bad = resource({cover_image: 'r1/cover.webp', cover_image_hotspot: {x: 'left', y: 1}})
    const list = resource({cover_image: 'r1/cover.webp', cover_image_hotspot: [0.25, 0.75]})
    expect(good.coverImage?.hotspot).toEqual({x: 0.25, y: 0.75})
    expect(bad.coverImage?.hotspot).toBeNull()
    expect(list.coverImage?.hotspot).toBeNull()
  })
})

describe('toCard', () => {
  it('links straight to the url for links and slide decks with a url', () => {
    expect(mapping.toCard(resource())?.href).toBe('https://example.com/a')
    expect(mapping.toCard(resource({type: 'slides', url: 'https://slides.example/d'}))?.href).toBe(
      'https://slides.example/d',
    )
  })

  it('routes uploaded files through the file route', () => {
    for (const type of ['pdf', 'video', 'slides'] as const) {
      const card = mapping.toCard(resource({id: 'abc', type, url: null, file: 'abc/file-1.bin'}))
      expect(card?.href).toBe('/api/resources/abc/file')
    }
  })

  it('returns null when there is nothing to open', () => {
    expect(mapping.toCard(resource({url: null, file: null}))).toBeNull()
  })

  it('has no cover when there is no image', () => {
    expect(mapping.toCard(resource())?.cover).toBeNull()
  })

  it('builds a public cover url, alt text, hotspot position, and lqip', () => {
    const card = mapping.toCard(
      resource({
        cover_image: 'r1/cover.webp',
        cover_image_alt: 'A dashboard',
        cover_image_hotspot: {x: 0.5, y: 0.25},
        cover_image_lqip: 'data:image/jpeg;base64,AAAA',
      }),
    )
    expect(card?.cover).toEqual({
      src: 'https://example.supabase.co/storage/v1/object/public/resource-images/r1/cover.webp',
      alt: 'A dashboard',
      position: '50% 25%',
      lqip: 'data:image/jpeg;base64,AAAA',
    })
  })

  it('falls back to the pdf preview and its own lqip when there is no cover', () => {
    const card = mapping.toCard(
      resource({
        type: 'pdf',
        url: null,
        file: 'r1/file-1.pdf',
        pdf_preview: 'r1/preview-1.jpg',
        pdf_preview_lqip: 'data:image/jpeg;base64,BBBB',
        cover_image_lqip: 'data:image/jpeg;base64,AAAA',
      }),
    )
    expect(card?.cover).toEqual({
      src: 'https://example.supabase.co/storage/v1/object/public/resource-images/r1/preview-1.jpg',
      alt: '',
      position: 'center',
      lqip: 'data:image/jpeg;base64,BBBB',
    })
  })

  it('prefers the cover image over the pdf preview', () => {
    const card = mapping.toCard(
      resource({type: 'pdf', url: null, file: 'r1/f.pdf', cover_image: 'r1/cover.png', pdf_preview: 'r1/p.jpg'}),
    )
    expect(card?.cover?.src.endsWith('/r1/cover.png')).toBe(true)
  })
})

describe('publicImageUrl', () => {
  it('encodes each path segment', () => {
    expect(mapping.publicImageUrl('id/my cover.png')).toBe(
      'https://example.supabase.co/storage/v1/object/public/resource-images/id/my%20cover.png',
    )
  })
})
