import {beforeAll, describe, expect, it} from 'vitest'
import type {CardCover} from '@/lib/sanity/types'

const asset = {_id: 'image-abc-900x1200-png', url: null, lqip: null, width: 900, height: 1200}

describe('coverSource', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'testproj'
  })

  it('returns null when the cover has no asset', async () => {
    const {coverSource} = await import('@/lib/sanity/image')
    const cover: CardCover = {alt: null, hotspot: null, crop: null, asset: null}
    expect(coverSource(cover)).toBeNull()
  })

  it('keeps a complete crop and hotspot', async () => {
    const {coverSource} = await import('@/lib/sanity/image')
    const cover: CardCover = {
      alt: 'Cover',
      asset,
      crop: {_type: 'sanity.imageCrop', top: 0.1, bottom: 0.1, left: 0, right: 0},
      hotspot: {_type: 'sanity.imageHotspot', x: 0.5, y: 0.4, width: 0.3, height: 0.3},
    }
    expect(coverSource(cover)).toEqual({
      asset: {_ref: asset._id},
      crop: {top: 0.1, bottom: 0.1, left: 0, right: 0},
      hotspot: {x: 0.5, y: 0.4, width: 0.3, height: 0.3},
    })
  })

  it('drops incomplete crop and hotspot data instead of passing partial values', async () => {
    const {coverSource} = await import('@/lib/sanity/image')
    const cover: CardCover = {
      alt: null,
      asset,
      crop: {_type: 'sanity.imageCrop', top: 0.1},
      hotspot: {_type: 'sanity.imageHotspot', x: 0.5},
    }
    expect(coverSource(cover)).toEqual({asset: {_ref: asset._id}, crop: undefined, hotspot: undefined})
  })

  it('produces an uncropped URL when only a width is requested', async () => {
    const {coverSource, urlFor} = await import('@/lib/sanity/image')
    const source = coverSource({alt: null, hotspot: null, crop: null, asset})
    const url = source ? urlFor(source).width(800).fit('max').url() : ''
    expect(url).not.toContain('rect=')
    expect(url).toContain('w=800')
  })
})
