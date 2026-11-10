import {beforeAll, describe, expect, it} from 'vitest'
import {
  draftFromResource,
  draftToInput,
  newDraft,
  validateDraft,
  dateInputToIso,
  dateInputValue,
} from '@/lib/admin/drafts'
import {mapSaveError} from '@/lib/admin/errors'
import {distinctCategories} from '@/lib/resources/group'
import {extensionOf, fileTypeAllowed, imageAllowed, mimeFor, MAX_IMAGE_BYTES} from '@/lib/admin/upload-rules'
import type {Database} from '@/lib/supabase/database.types'

type Row = Database['public']['Tables']['resources']['Row']
type FormInitial = typeof import('@/lib/admin/form-initial')

let formInitial: FormInitial

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://welcometovydia.com'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  formInitial = await import('@/lib/admin/form-initial')
})

const row = (overrides: Partial<Row> = {}): Row => ({
  id: crypto.randomUUID(),
  client_id: null,
  title: 'Q1 Release Plan',
  type: 'pdf',
  file: 'abc/file-1.pdf',
  url: null,
  cover_image: null,
  cover_image_alt: null,
  cover_image_hotspot: null,
  cover_image_lqip: null,
  pdf_preview: null,
  pdf_preview_lqip: null,
  category: 'Your Releases',
  sort_order: 1,
  added_on: '2026-01-02T12:00:00.000Z',
  created_at: '2026-01-02T12:00:00.000Z',
  updated_at: '2026-01-02T12:00:00.000Z',
  ...overrides,
})

describe('drafts', () => {
  it('starts as an empty PDF with a fresh id', () => {
    const a = newDraft()
    const b = newDraft('Docs')
    expect(a.type).toBe('pdf')
    expect(a.id).not.toBe(b.id)
    expect(b.category).toBe('Docs')
  })

  it('shows Sanity’s per-type messages for an empty draft of each type', () => {
    const base = {...newDraft('Docs'), title: 'Walkthrough'}
    expect(validateDraft({...base, type: 'pdf'}).file).toBe('Upload a PDF.')
    expect(validateDraft({...base, type: 'video'}).file).toBe('Upload the video file.')
    expect(validateDraft({...base, type: 'link'}).url).toBe('Add the link URL.')
    expect(validateDraft({...base, type: 'slides'}).file).toBe('Upload the deck or add a link.')
    expect(validateDraft({...base, type: 'slides', file: 'a/f.pdf', url: 'https://example.com'}).url).toBe(
      'Use either an upload or a link, not both.',
    )
  })

  it('requires a title and a category', () => {
    const errors = validateDraft({...newDraft(), file: 'a/f.pdf'})
    expect(errors.title).toBe('Title is required.')
    expect(errors.category).toBe('Category is required.')
  })

  it('accepts a complete draft', () => {
    expect(validateDraft({...newDraft('Docs'), title: 'Plan', file: 'a/f.pdf'})).toEqual({})
  })

  it('sends blanks as null and keeps an untouched added-on date', () => {
    const draft = draftFromResource(formInitialResource())
    const input = draftToInput({...draft, url: '  ', coverImageAlt: ' '})
    expect(input.url).toBeNull()
    expect(input.coverImageAlt).toBeNull()
    expect(input.addedOn).toBe('2026-01-02T12:00:00.000Z')
    expect(draftToInput(newDraft('Docs')).addedOn).toBeUndefined()
  })

  it('converts the date input both ways', () => {
    expect(dateInputValue('2026-01-02T12:00:00.000Z')).toBe('2026-01-02')
    expect(dateInputToIso('2026-03-04')).toBe('2026-03-04T12:00:00.000Z')
    expect(dateInputToIso('')).toBe('')
  })
})

function formInitialResource() {
  return {
    id: 'r1',
    clientId: null,
    title: 'Q1 Release Plan',
    type: 'pdf' as const,
    file: 'abc/file-1.pdf',
    url: null,
    coverImage: null,
    pdfPreview: null,
    category: 'Your Releases',
    sortOrder: 1,
    addedOn: '2026-01-02T12:00:00.000Z',
  }
}

describe('toFormInitial', () => {
  const client = {
    id: 'a1',
    name: 'Lil Example',
    slug: 'lil-example',
    client_emails: [
      {email: 'manager@mgmt.com', label: 'Manager', is_primary: false},
      {email: 'lil@example.com', label: 'Client', is_primary: true},
      {email: 'alt@example.com', label: null, is_primary: false},
    ],
    client_hidden_resources: [{resource_id: 'h1'}, {resource_id: 'h2'}],
    resources: [row({title: 'Second', sort_order: 2}), row({title: 'First', sort_order: 1})],
  }

  it('puts the primary email first and the rest in rows with labels', () => {
    const initial = formInitial.toFormInitial(client)
    expect(initial.primaryEmail).toBe('lil@example.com')
    expect(initial.auxEmails.map((r) => [r.email, r.label])).toEqual([
      ['manager@mgmt.com', 'Manager'],
      ['alt@example.com', ''],
    ])
    expect(new Set(initial.auxEmails.map((r) => r.key)).size).toBe(2)
  })

  it('carries the hides and orders exclusive resources by sort order', () => {
    const initial = formInitial.toFormInitial(client)
    expect(initial.hiddenResourceIds).toEqual(['h1', 'h2'])
    expect(initial.exclusiveResources.map((d) => d.title)).toEqual(['First', 'Second'])
    expect(initial.id).toBe('a1')
  })
})

describe('mapSaveError', () => {
  it.each([
    [{code: '23505', message: 'duplicate key value violates unique constraint "clients_slug_key"'}, 'slug'],
    [{code: '23505', message: 'duplicate email'}, 'emails'],
    [{code: '23514', message: 'new row violates check constraint "clients_slug_check"'}, 'slug'],
    [{code: '23514', message: 'exactly one primary email is required'}, 'emails'],
  ])('maps %j to the %s field', (error, field) => {
    expect(mapSaveError(error)?.field).toBe(field)
  })

  it('leaves a missing or unowned client to the form-level message', () => {
    expect(mapSaveError({code: 'P0002', message: 'client not found'})).toBeNull()
  })

  it('leaves unknown errors for the generic message', () => {
    expect(mapSaveError({code: '57014', message: 'canceling statement due to statement timeout'})).toBeNull()
  })
})

describe('distinctCategories', () => {
  it('merges case and whitespace, keeps the first spelling, and sorts', () => {
    expect(
      distinctCategories(['getting started', 'Getting  Started', 'Your Releases', ' ', 'additional services']),
    ).toEqual(['additional services', 'getting started', 'Your Releases'])
  })
})

describe('upload rules', () => {
  it('reads the extension and falls back to it when the browser gives no type', () => {
    expect(extensionOf('Deck.KEY')).toBe('key')
    expect(extensionOf('noext')).toBe('')
    expect(mimeFor({type: '', name: 'Deck.key'})).toBe('application/vnd.apple.keynote')
    expect(mimeFor({type: 'application/pdf', name: 'x.bin'})).toBe('application/pdf')
  })

  it('allows only matching file types per resource type', () => {
    expect(fileTypeAllowed('pdf', 'application/pdf')).toBe(true)
    expect(fileTypeAllowed('pdf', 'video/mp4')).toBe(false)
    expect(fileTypeAllowed('video', 'video/quicktime')).toBe(true)
    expect(fileTypeAllowed('slides', 'application/vnd.apple.keynote')).toBe(true)
    expect(fileTypeAllowed('slides', 'video/mp4')).toBe(false)
    expect(fileTypeAllowed('link', 'application/pdf')).toBe(false)
  })

  it('accepts only JPG, PNG, and WebP covers up to 5 MB', () => {
    expect(imageAllowed('image/webp', MAX_IMAGE_BYTES)).toBe(true)
    expect(imageAllowed('image/webp', MAX_IMAGE_BYTES + 1)).toBe(false)
    expect(imageAllowed('image/gif', 10)).toBe(false)
  })
})
