import {beforeAll, describe, expect, it} from 'vitest'

describe('urlFor', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'testproj'
    process.env.NEXT_PUBLIC_SANITY_DATASET = 'production'
  })

  it('builds a cdn.sanity.io URL inside the allowed images path', async () => {
    const {urlFor} = await import('@/lib/sanity/image')
    const url = urlFor({asset: {_id: 'image-abc123-1200x675-png'}})
      .width(800)
      .url()
    expect(url).toMatch(/^https:\/\/cdn\.sanity\.io\/images\/testproj\/production\/abc123-1200x675\.png\?/)
    expect(url).toContain('w=800')
    expect(url).toContain('auto=format')
  })
})
