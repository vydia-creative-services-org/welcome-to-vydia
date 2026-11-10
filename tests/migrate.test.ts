import {describe, expect, it} from 'vitest'
import {z} from 'zod'
import {
  croppedCover,
  fileExtension,
  filePath,
  imagePath,
  resolveTarget,
  sanityResource,
  uuidFromSanityId,
} from '@/scripts/migrate-sanity-lib'

describe('uuidFromSanityId', () => {
  it('is deterministic, so a re-run updates instead of duplicating', () => {
    expect(uuidFromSanityId('test-resource-best-practices')).toBe(uuidFromSanityId('test-resource-best-practices'))
  })

  it('gives different ids to different documents', () => {
    expect(uuidFromSanityId('a')).not.toBe(uuidFromSanityId('b'))
  })

  it('produces ids the strict uuid validator accepts', () => {
    for (const id of ['a', '0d4243a9-d899-44c4-a840-a32feb3ba7f0', 'test-resource-broadcast-slides', 'drafts.x']) {
      expect(z.uuid().safeParse(uuidFromSanityId(id)).success).toBe(true)
    }
  })

  it('treats a draft and its published document as the same resource', () => {
    expect(uuidFromSanityId('drafts.abc')).toBe(uuidFromSanityId('abc'))
  })
})

describe('croppedCover', () => {
  const asset = {url: 'https://cdn.sanity.io/images/p/d/abc-2000x1000.jpg', width: 2000, height: 1000}

  it('bakes the crop into a pixel rect on the image URL', () => {
    const plan = croppedCover(asset, {top: 0.1, bottom: 0.1, left: 0.25, right: 0.25}, null)
    expect(plan.url).toBe(`${asset.url}?rect=500,100,1000,800&w=2000&fit=max&fm=webp&q=85`)
    expect(plan.cropKey).not.toBe('full')
  })

  it('moves the hotspot into the cropped frame', () => {
    const crop = {top: 0, bottom: 0, left: 0.25, right: 0.25}
    expect(croppedCover(asset, crop, {x: 0.5, y: 0.4}).hotspot).toEqual({x: 0.5, y: 0.4})
    expect(croppedCover(asset, crop, {x: 0.375, y: 0.4}).hotspot?.x).toBeCloseTo(0.25)
  })

  it('clamps a hotspot that falls outside the crop', () => {
    const crop = {top: 0, bottom: 0, left: 0.25, right: 0.25}
    expect(croppedCover(asset, crop, {x: 0.05, y: 0.5}).hotspot?.x).toBe(0)
    expect(croppedCover(asset, crop, {x: 0.95, y: 0.5}).hotspot?.x).toBe(1)
  })

  it('leaves an uncropped image alone and keeps a plain hotspot', () => {
    const plan = croppedCover(asset, null, {x: 0.3, y: 0.7})
    expect(plan.url).toBe(`${asset.url}?w=2000&fit=max&fm=webp&q=85`)
    expect(plan.hotspot).toEqual({x: 0.3, y: 0.7})
    expect(plan.cropKey).toBe('full')
  })

  it('has no hotspot when Sanity has none', () => {
    expect(croppedCover(asset, null, null).hotspot).toBeNull()
  })

  it('gives different crops different keys', () => {
    const a = croppedCover(asset, {top: 0.1, bottom: 0, left: 0, right: 0}, null).cropKey
    const b = croppedCover(asset, {top: 0.2, bottom: 0, left: 0, right: 0}, null).cropKey
    expect(a).not.toBe(b)
  })
})

describe('resolveTarget', () => {
  it('keeps the upload for PDFs and videos and notes a stale link', () => {
    expect(resolveTarget('pdf', true, 'https://example.com/slides')).toEqual({
      ok: true,
      file: true,
      url: null,
      notes: ['ignored a stale link URL (PDFs and videos are uploaded)'],
    })
    expect(resolveTarget('video', true, null)).toEqual({ok: true, file: true, url: null, notes: []})
  })

  it('skips a PDF or video with no file', () => {
    expect(resolveTarget('pdf', false, 'https://example.com')).toEqual({ok: false, reason: 'no uploaded PDF file'})
    expect(resolveTarget('video', false, null)).toEqual({ok: false, reason: 'no uploaded video file'})
  })

  it('keeps the link for links and skips one without a URL', () => {
    expect(resolveTarget('link', false, ' https://example.com/form ')).toEqual({
      ok: true,
      file: false,
      url: 'https://example.com/form',
      notes: [],
    })
    expect(resolveTarget('link', false, '  ')).toEqual({ok: false, reason: 'no link URL'})
  })

  it('accepts a deck as either an upload or a link, preferring the upload when both exist', () => {
    expect(resolveTarget('slides', true, null)).toMatchObject({ok: true, file: true, url: null})
    expect(resolveTarget('slides', false, 'https://slides.example/d')).toMatchObject({ok: true, file: false})
    expect(resolveTarget('slides', true, 'https://slides.example/d')).toMatchObject({
      ok: true,
      file: true,
      url: null,
      notes: ['had both an upload and a link; kept the upload'],
    })
    expect(resolveTarget('slides', false, null)).toEqual({ok: false, reason: 'neither an upload nor a link'})
  })
})

describe('storage paths', () => {
  it('takes the extension from the original name, then the mime type', () => {
    expect(fileExtension({mimeType: 'application/pdf', originalFilename: 'Vydia Guide Book.PDF'})).toBe('pdf')
    expect(fileExtension({mimeType: 'video/mp4', originalFilename: null})).toBe('mp4')
    expect(fileExtension({mimeType: 'application/octet-stream', originalFilename: 'noext'})).toBe('bin')
  })

  it('names files and images from their content, so a changed asset gets a new path', () => {
    const asset = {sha1hash: 'a'.repeat(40), mimeType: 'application/pdf', originalFilename: 'Guide.pdf'}
    expect(filePath('id1', asset)).toBe(`id1/file-${'a'.repeat(16)}.pdf`)
    expect(filePath('id1', {...asset, sha1hash: 'b'.repeat(40)})).not.toBe(filePath('id1', asset))
    expect(imagePath('id1', 'cover', 'c'.repeat(40), 'full')).toBe(`id1/cover-${'c'.repeat(12)}-full.webp`)
    expect(imagePath('id1', 'preview', 'c'.repeat(40), 'full')).toBe(`id1/preview-${'c'.repeat(12)}-full.webp`)
  })
})

describe('sanityResource', () => {
  const base = {_id: 'r1', _createdAt: '2026-10-20T03:45:25Z'}

  it('accepts the shape the query returns, including missing and null parts', () => {
    expect(sanityResource.safeParse({...base, title: 'T', type: 'link', url: 'https://x.test'}).success).toBe(true)
    expect(sanityResource.safeParse({...base, file: null, coverImage: null, pdfPreview: {asset: null}}).success).toBe(
      true,
    )
  })

  it('rejects a resource type outside the allowed list', () => {
    expect(sanityResource.safeParse({...base, type: 'audio'}).success).toBe(false)
  })
})
