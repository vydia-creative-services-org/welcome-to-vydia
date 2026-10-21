import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {RawResource} from '@/lib/sanity/types'
import type {ARTIST_PAGE_QUERY_RESULT, BlockContent} from '@/lib/sanity/types.generated'

const state = vi.hoisted((): {data: ARTIST_PAGE_QUERY_RESULT | undefined} => ({data: undefined}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/sanity/fetch', () => ({sanityFetch: vi.fn(async () => state.data)}))

const {getArtistPage} = await import('@/lib/sanity/page')
const {sanityFetch} = await import('@/lib/sanity/fetch')
const {ARTIST_PAGE_QUERY} = await import('@/lib/sanity/queries')

const text = (key: string, value: string): BlockContent => [
  {_type: 'block', _key: key, style: 'normal', markDefs: [], children: [{_type: 'span', _key: `${key}s`, text: value}]},
]

const resource = (id: string, overrides: Partial<RawResource> = {}): RawResource => ({
  _id: id,
  title: `Resource ${id}`,
  type: 'link',
  url: `https://example.com/${id}`,
  addedOn: '2026-01-01T12:00:00Z',
  fileUrl: null,
  fileName: null,
  cover: null,
  ...overrides,
})

const globalResources = [resource('r1'), resource('r2'), resource('r3')]

const data = (artist: Partial<NonNullable<ARTIST_PAGE_QUERY_RESULT['artist']>> | null): ARTIST_PAGE_QUERY_RESULT => ({
  website: {resources: globalResources},
  artist: artist === null ? null : {name: 'Test Artist', additionalInfo: null, resourceOverride: null, ...artist},
})

const firstText = (blocks: BlockContent) => blocks[0]?.children?.[0]?.text
const ids = (resources: {_id: string}[]) => resources.map((r) => r._id)

describe('getArtistPage', () => {
  beforeEach(() => {
    vi.mocked(sanityFetch).mockClear()
  })

  it('queries the page with the artist id and all three cache tags', async () => {
    state.data = data({})
    await getArtistPage('artist-1')
    expect(sanityFetch).toHaveBeenCalledWith(ARTIST_PAGE_QUERY, {artistId: 'artist-1'}, [
      'website',
      'resource',
      'artist',
    ])
  })

  it('uses the website resources, in order, when there is no override', async () => {
    state.data = data({})
    const page = await getArtistPage('a')
    expect(page.artistName).toBe('Test Artist')
    expect(ids(page.resources)).toEqual(['r1', 'r2', 'r3'])
    expect(page.additionalInfo).toBeNull()
  })

  it('replaces (never appends to) the website resources when the artist has an override', async () => {
    state.data = data({resourceOverride: [resource('own'), globalResources[1]]})
    const page = await getArtistPage('a')
    expect(ids(page.resources)).toEqual(['own', 'r2'])
  })

  it('treats empty override arrays as "no override"', async () => {
    state.data = data({resourceOverride: [], additionalInfo: []})
    const page = await getArtistPage('a')
    expect(ids(page.resources)).toEqual(['r1', 'r2', 'r3'])
    expect(page.additionalInfo).toBeNull()
  })

  it('returns additional info when the artist has some', async () => {
    state.data = data({additionalInfo: text('i', 'Your rep is Jane')})
    const page = await getArtistPage('a')
    expect(page.additionalInfo && firstText(page.additionalInfo)).toBe('Your rep is Jane')
  })

  it('drops resources missing a title or type', async () => {
    state.data = data({
      resourceOverride: [resource('ok'), resource('untitled', {title: null}), resource('untyped', {type: null})],
    })
    const page = await getArtistPage('a')
    expect(ids(page.resources)).toEqual(['ok'])
  })

  it('falls back safely when the website or artist is missing', async () => {
    state.data = {website: null, artist: null}
    const page = await getArtistPage('missing')
    expect(page).toEqual({artistName: '', additionalInfo: null, resources: []})
  })
})
