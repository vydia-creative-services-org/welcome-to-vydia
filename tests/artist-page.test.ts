import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {RawResource, RawSection} from '@/lib/sanity/types'
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

const section = (id: string, resources: RawResource[] | null): RawSection => ({
  _id: id,
  title: `Section ${id}`,
  subtitle: null,
  resources,
})

const globalSections = [section('g1', [resource('r1'), resource('r2')]), section('g2', [resource('r3')])]

const data = (artist: Partial<NonNullable<ARTIST_PAGE_QUERY_RESULT['artist']>> | null): ARTIST_PAGE_QUERY_RESULT => ({
  website: {intro: text('global', 'Global intro'), sections: globalSections},
  artist:
    artist === null
      ? null
      : {name: 'Test Artist', introOverride: null, additionalInfo: null, sectionOverride: null, ...artist},
})

const firstText = (blocks: BlockContent) => blocks[0]?.children?.[0]?.text

describe('getArtistPage', () => {
  beforeEach(() => {
    vi.mocked(sanityFetch).mockClear()
  })

  it('queries the page with the artist id and all four cache tags', async () => {
    state.data = data({})
    await getArtistPage('artist-1')
    expect(sanityFetch).toHaveBeenCalledWith(ARTIST_PAGE_QUERY, {artistId: 'artist-1'}, [
      'website',
      'section',
      'resource',
      'artist',
    ])
  })

  it('uses the global intro and sections when there are no overrides', async () => {
    state.data = data({})
    const page = await getArtistPage('a')
    expect(page.artistName).toBe('Test Artist')
    expect(firstText(page.intro)).toBe('Global intro')
    expect(page.sections.map((s) => s._id)).toEqual(['g1', 'g2'])
    expect(page.sections[0].resources.map((r) => r._id)).toEqual(['r1', 'r2'])
    expect(page.additionalInfo).toBeNull()
  })

  it('replaces only the intro when the artist has an intro override', async () => {
    state.data = data({introOverride: text('o', 'Artist intro')})
    const page = await getArtistPage('a')
    expect(firstText(page.intro)).toBe('Artist intro')
    expect(page.sections.map((s) => s._id)).toEqual(['g1', 'g2'])
  })

  it('replaces (never appends to) the global sections when the artist has a section override', async () => {
    state.data = data({sectionOverride: [section('own', [resource('x')]), globalSections[1]]})
    const page = await getArtistPage('a')
    expect(page.sections.map((s) => s._id)).toEqual(['own', 'g2'])
    expect(firstText(page.intro)).toBe('Global intro')
  })

  it('treats empty override arrays as "no override"', async () => {
    state.data = data({introOverride: [], sectionOverride: [], additionalInfo: []})
    const page = await getArtistPage('a')
    expect(firstText(page.intro)).toBe('Global intro')
    expect(page.sections.map((s) => s._id)).toEqual(['g1', 'g2'])
    expect(page.additionalInfo).toBeNull()
  })

  it('returns additional info when the artist has some', async () => {
    state.data = data({additionalInfo: text('i', 'Your rep is Jane')})
    const page = await getArtistPage('a')
    expect(page.additionalInfo && firstText(page.additionalInfo)).toBe('Your rep is Jane')
  })

  it('drops resources missing a title or type, and handles sections with no resources', async () => {
    state.data = data({
      sectionOverride: [
        section('s', [resource('ok'), resource('untitled', {title: null}), resource('untyped', {type: null})]),
        section('empty', null),
      ],
    })
    const page = await getArtistPage('a')
    expect(page.sections[0].resources.map((r) => r._id)).toEqual(['ok'])
    expect(page.sections[1].resources).toEqual([])
  })

  it('falls back safely when the website or artist is missing', async () => {
    state.data = {website: null, artist: null}
    const page = await getArtistPage('missing')
    expect(page).toEqual({artistName: '', intro: [], additionalInfo: null, sections: []})
  })
})
