import {describe, expect, it} from 'vitest'
import {artistPayload, resourceInput} from '@/lib/validation'

const id = () => crypto.randomUUID()

const resource = (overrides: Record<string, unknown> = {}) => ({
  id: id(),
  title: 'Q1 Release Plan',
  type: 'pdf',
  file: 'abc/file-1.pdf',
  url: null,
  coverImage: null,
  coverImageAlt: null,
  coverImageLqip: null,
  pdfPreview: null,
  pdfPreviewLqip: null,
  category: 'Your Releases',
  ...overrides,
})

const artist = (overrides: Record<string, unknown> = {}) => ({
  name: 'Lil Example',
  slug: 'lil-example',
  emails: [
    {email: 'lil@example.com', label: 'Artist', isPrimary: true},
    {email: 'manager@mgmt.com', label: 'Manager', isPrimary: false},
  ],
  hiddenResourceIds: [],
  exclusiveResources: [],
  ...overrides,
})

const messages = (result: {success: boolean; error?: {issues: {message: string}[]}}) =>
  result.error?.issues.map((i) => i.message) ?? []

describe('resourceInput per-type rules', () => {
  it('accepts the valid shape for every type', () => {
    for (const input of [
      resource(),
      resource({type: 'video', file: 'a/file-1.mp4'}),
      resource({type: 'link', file: null, url: 'https://example.com/form'}),
      resource({type: 'slides', file: 'a/file-1.pdf'}),
      resource({type: 'slides', file: null, url: 'https://slides.example/d'}),
    ]) {
      expect(resourceInput.safeParse(input).success).toBe(true)
    }
  })

  it.each([
    [{type: 'pdf', file: null}, 'Upload a PDF.'],
    [{type: 'video', file: null}, 'Upload the video file.'],
    [{type: 'pdf', url: 'https://example.com/x'}, 'Videos and PDFs are uploaded, not linked.'],
    [{type: 'video', file: 'a/f.mp4', url: 'https://example.com/x'}, 'Videos and PDFs are uploaded, not linked.'],
    [{type: 'link', file: null, url: null}, 'Add the link URL.'],
    [{type: 'link', file: 'a/f.pdf', url: 'https://example.com/x'}, 'Links don’t have a file.'],
    [{type: 'slides', file: null, url: null}, 'Upload the deck or add a link.'],
    [{type: 'slides', file: 'a/f.pdf', url: 'https://example.com/x'}, 'Use either an upload or a link, not both.'],
    [{type: 'link', file: null, url: 'https://example.com/x', pdfPreview: 'a/p.jpg'}, 'Only PDFs have a preview.'],
  ])('rejects %j with "%s"', (overrides, message) => {
    expect(messages(resourceInput.safeParse(resource(overrides)))).toContain(message)
  })
})

describe('resourceInput field limits', () => {
  it('requires a title of at most 120 characters', () => {
    expect(resourceInput.safeParse(resource({title: 'a'.repeat(120)})).success).toBe(true)
    expect(resourceInput.safeParse(resource({title: 'a'.repeat(121)})).success).toBe(false)
    expect(resourceInput.safeParse(resource({title: '   '})).success).toBe(false)
  })

  it('requires a category', () => {
    expect(messages(resourceInput.safeParse(resource({category: '  '})))).toContain('Category is required.')
  })

  it('rejects a resource type outside the allowed list', () => {
    expect(resourceInput.safeParse(resource({type: 'audio'})).success).toBe(false)
  })

  it('only accepts http and https links', () => {
    expect(resourceInput.safeParse(resource({type: 'link', file: null, url: 'ftp://example.com/x'})).success).toBe(
      false,
    )
    expect(resourceInput.safeParse(resource({type: 'link', file: null, url: 'javascript:alert(1)'})).success).toBe(
      false,
    )
  })

  it('accepts a small image lqip and rejects other data urls', () => {
    const ok = resource({coverImage: 'a/cover-1.png', coverImageLqip: 'data:image/jpeg;base64,/9j/4AAQ='})
    expect(resourceInput.safeParse(ok).success).toBe(true)
    expect(resourceInput.safeParse(resource({coverImageLqip: 'data:text/html;base64,AAAA'})).success).toBe(false)
    expect(
      resourceInput.safeParse(resource({coverImageLqip: `data:image/jpeg;base64,${'A'.repeat(4096)}`})).success,
    ).toBe(false)
  })

  it('requires a valid id and an offset datetime for addedOn', () => {
    expect(resourceInput.safeParse(resource({id: 'not-a-uuid'})).success).toBe(false)
    expect(resourceInput.safeParse(resource({addedOn: '2026-01-01T12:00:00Z'})).success).toBe(true)
    expect(resourceInput.safeParse(resource({addedOn: 'yesterday'})).success).toBe(false)
  })
})

describe('artistPayload', () => {
  it('accepts the spec sample and lowercases emails and the slug', () => {
    const parsed = artistPayload.parse(
      artist({
        slug: ' Lil-Example ',
        emails: [
          {email: ' LIL@Example.com ', label: 'Artist', isPrimary: true},
          {email: 'manager@mgmt.com', label: '', isPrimary: false},
        ],
      }),
    )
    expect(parsed.slug).toBe('lil-example')
    expect(parsed.emails[0].email).toBe('lil@example.com')
  })

  it('limits the name to 100 characters', () => {
    expect(artistPayload.safeParse(artist({name: 'a'.repeat(100)})).success).toBe(true)
    expect(artistPayload.safeParse(artist({name: 'a'.repeat(101)})).success).toBe(false)
    expect(artistPayload.safeParse(artist({name: ''})).success).toBe(false)
  })

  it.each(['ab', 'a'.repeat(61), 'Lil Example', 'lil--example', 'admin', 'login'])('rejects the slug "%s"', (slug) => {
    expect(artistPayload.safeParse(artist({slug})).success).toBe(false)
  })

  it('rejects a malformed email', () => {
    const bad = artist({emails: [{email: 'not-an-email', label: '', isPrimary: true}]})
    expect(messages(artistPayload.safeParse(bad))).toContain('Enter a valid email address.')
  })

  it('rejects the same email twice, ignoring case', () => {
    const dup = artist({
      emails: [
        {email: 'lil@example.com', label: '', isPrimary: true},
        {email: 'LIL@example.com', label: '', isPrimary: false},
      ],
    })
    expect(messages(artistPayload.safeParse(dup))).toContain('This email is listed twice.')
  })

  it('requires exactly one primary email', () => {
    const none = artist({emails: [{email: 'a@example.com', label: '', isPrimary: false}]})
    const two = artist({
      emails: [
        {email: 'a@example.com', label: '', isPrimary: true},
        {email: 'b@example.com', label: '', isPrimary: true},
      ],
    })
    expect(messages(artistPayload.safeParse(none))).toContain('Add a primary email.')
    expect(messages(artistPayload.safeParse(two))).toContain('Add a primary email.')
    expect(artistPayload.safeParse(artist({emails: []})).success).toBe(false)
  })

  it('limits the email label to 40 characters', () => {
    const long = artist({emails: [{email: 'a@example.com', label: 'a'.repeat(41), isPrimary: true}]})
    expect(artistPayload.safeParse(long).success).toBe(false)
  })

  it('validates nested exclusive resources and hidden ids', () => {
    expect(artistPayload.safeParse(artist({exclusiveResources: [resource()], hiddenResourceIds: [id()]})).success).toBe(
      true,
    )
    expect(artistPayload.safeParse(artist({exclusiveResources: [resource({file: null})]})).success).toBe(false)
    expect(artistPayload.safeParse(artist({hiddenResourceIds: ['nope']})).success).toBe(false)
  })
})
