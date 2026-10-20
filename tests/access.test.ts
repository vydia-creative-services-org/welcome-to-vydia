import type {User} from '@supabase/supabase-js'
import {beforeAll, describe, expect, it, vi} from 'vitest'
import type {ACCESS_QUERY_RESULT} from '@/lib/sanity/types.generated'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/sanity/fetch', () => ({sanityFetch: vi.fn()}))

type AccessModule = typeof import('@/lib/access')
let access: AccessModule

beforeAll(async () => {
  process.env.PERMANENT_VIEWER_EMAILS = 'labelrelationships@vydia.com, CreativeServices@vydia.com'
  access = await import('@/lib/access')
})

const lookup = (overrides: Partial<NonNullable<ACCESS_QUERY_RESULT['artist']>> = {}): ACCESS_QUERY_RESULT => ({
  artist: {_id: 'a1', slug: 'jane-doe', allowedEmails: ['Jane@Example.com'], ...overrides},
  internalViewers: ['ops@vydia.com'],
})

const unknown: ACCESS_QUERY_RESULT = {artist: null, internalViewers: ['ops@vydia.com']}

describe('decideAccess', () => {
  it('denies unknown artists', () => {
    expect(access.decideAccess('nope', 'jane@example.com', unknown)).toEqual({status: 'denied'})
  })

  it('denies unapproved emails with exactly the same result as an unknown artist', () => {
    expect(access.decideAccess('jane-doe', 'eve@example.com', lookup())).toEqual(
      access.decideAccess('nope', 'eve@example.com', unknown),
    )
  })

  it('matches allowed emails case-insensitively and ignores surrounding spaces', () => {
    expect(access.decideAccess('jane-doe', '  JANE@example.COM ', lookup()).status).toBe('granted')
    expect(
      access.decideAccess('jane-doe', 'jane@example.com', lookup({allowedEmails: [' jane@EXAMPLE.com ']})).status,
    ).toBe('granted')
  })

  it('always allows the permanent internal emails, in any case', () => {
    expect(access.decideAccess('jane-doe', 'LabelRelationships@vydia.com', lookup()).status).toBe('granted')
    expect(access.decideAccess('jane-doe', 'creativeservices@VYDIA.com', lookup()).status).toBe('granted')
  })

  it('allows internal viewers listed on the website, but not on unknown artists', () => {
    expect(access.decideAccess('jane-doe', 'OPS@vydia.com', lookup()).status).toBe('granted')
    expect(access.decideAccess('nope', 'ops@vydia.com', unknown)).toEqual({status: 'denied'})
  })

  it('redirects an old slug to the current one only when access is allowed', () => {
    expect(access.decideAccess('jane-old', 'jane@example.com', lookup())).toEqual({
      status: 'redirect',
      canonicalSlug: 'jane-doe',
    })
    expect(access.decideAccess('jane-old', 'eve@example.com', lookup())).toEqual({status: 'denied'})
  })

  it('denies when there is no verified email', () => {
    expect(access.decideAccess('jane-doe', null, lookup())).toEqual({status: 'denied'})
  })

  it('denies an artist with no allowed emails to everyone except internal viewers', () => {
    expect(access.decideAccess('jane-doe', 'jane@example.com', lookup({allowedEmails: null})).status).toBe('denied')
    expect(access.decideAccess('jane-doe', 'ops@vydia.com', lookup({allowedEmails: null})).status).toBe('granted')
  })
})

describe('verifiedEmail', () => {
  const user = (email: string | undefined, confirmed: string | undefined): User => ({
    id: 'u1',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    email,
    email_confirmed_at: confirmed,
  })

  it('returns the email of a confirmed user', () => {
    expect(access.verifiedEmail(user('jane@example.com', '2026-01-02T00:00:00Z'))).toBe('jane@example.com')
  })

  it('returns null for unconfirmed users, users without email, and no user', () => {
    expect(access.verifiedEmail(user('jane@example.com', undefined))).toBeNull()
    expect(access.verifiedEmail(user(undefined, '2026-01-02T00:00:00Z'))).toBeNull()
    expect(access.verifiedEmail(null)).toBeNull()
  })
})

describe('normalizeSlug', () => {
  it('decodes and lowercases, and survives malformed encoding', () => {
    expect(access.normalizeSlug('Jane-Doe')).toBe('jane-doe')
    expect(access.normalizeSlug('beyonc%C3%A9')).toBe('beyoncé')
    expect(access.normalizeSlug('bad%E0%A4%A')).toBe('bad%e0%a4%a')
  })
})
