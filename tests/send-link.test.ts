import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

type RpcName = 'hit_rate_limit' | 'access_link_for' | 'claim_link_send'
type RpcResult = {data: unknown; error: {code: string} | null}

const LINK = {email: 'lil@example.com', token: 'a'.repeat(64), client_name: 'Lil Example', slug: 'lil-example'}

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendAccessLink: vi.fn(),
  forwardedFor: {value: '203.0.113.7, 10.0.0.1'},
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({'x-forwarded-for': mocks.forwardedFor.value}),
}))
vi.mock('@/lib/supabase/service', () => ({createServiceClient: () => ({rpc: mocks.rpc})}))
vi.mock('@/lib/access-links', () => ({sendAccessLink: mocks.sendAccessLink}))

type Actions = typeof import('@/app/(site)/[slug]/actions')
let actions: Actions

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://welcometovydia.com'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  actions = await import('@/app/(site)/[slug]/actions')
})

const ok = (data: unknown): RpcResult => ({data, error: null})

function answers(overrides: Partial<Record<RpcName, RpcResult>> = {}) {
  const table: Record<RpcName, RpcResult> = {
    hit_rate_limit: ok(true),
    access_link_for: ok([LINK]),
    claim_link_send: ok(true),
    ...overrides,
  }
  mocks.rpc.mockImplementation(async (name: RpcName) => table[name])
}

const form = (email: string, slug: string) => {
  const data = new FormData()
  data.set('email', email)
  data.set('slug', slug)
  return data
}

const send = (email: string, slug: string) => actions.sendLink({status: 'idle'}, form(email, slug))
const calls = () => mocks.rpc.mock.calls.map(([name]) => name)

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.sendAccessLink.mockReset()
  mocks.sendAccessLink.mockResolvedValue(true)
  mocks.forwardedFor.value = '203.0.113.7, 10.0.0.1'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  answers()
})

describe('sendLink', () => {
  it('rejects a malformed email before touching the database', async () => {
    expect(await send('not-an-email', 'lil-example')).toEqual({status: 'invalid'})
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('emails an approved address its permanent link', async () => {
    expect(await send('  Lil@Example.com ', 'Lil-Example')).toEqual({status: 'sent', email: 'lil@example.com'})
    expect(mocks.rpc).toHaveBeenCalledWith('access_link_for', {p_slug: 'lil-example', p_email: 'lil@example.com'})
    expect(mocks.sendAccessLink).toHaveBeenCalledWith(LINK, expect.anything())
    expect(mocks.rpc).toHaveBeenCalledWith('claim_link_send', {p_email: 'lil@example.com', p_slug: 'lil-example'})
  })

  it('answers a wrong email on a real slug and any email on an unknown slug identically, and sends nothing', async () => {
    answers({access_link_for: ok([])})
    const wrongEmail = await send('wrong@example.com', 'lil-example')
    const unknownSlug = await send('lil@example.com', 'does-not-exist')
    expect(wrongEmail).toEqual({status: 'not-approved'})
    expect(unknownSlug).toEqual(wrongEmail)
    expect(mocks.sendAccessLink).not.toHaveBeenCalled()
    expect(calls()).not.toContain('claim_link_send')
  })

  it('never approves a reserved or malformed slug, even if the database said yes', async () => {
    for (const slug of ['admin', 'a', 'Has Spaces']) {
      expect(await send('lil@example.com', slug)).toEqual({status: 'not-approved'})
    }
    expect(mocks.sendAccessLink).not.toHaveBeenCalled()
  })

  it('reports sent without sending again inside the 60 second cooldown', async () => {
    answers({claim_link_send: ok(false)})
    expect(await send('lil@example.com', 'lil-example')).toEqual({status: 'sent', email: 'lil@example.com'})
    expect(mocks.sendAccessLink).not.toHaveBeenCalled()
  })

  it('reports an error when the email couldn’t be sent, instead of claiming it was', async () => {
    mocks.sendAccessLink.mockResolvedValueOnce(false)
    expect(await send('lil@example.com', 'lil-example')).toEqual({status: 'error'})
  })

  it('returns rate-limited and stops when the IP is over the limit', async () => {
    answers({hit_rate_limit: ok(false)})
    expect(await send('lil@example.com', 'lil-example')).toEqual({status: 'rate-limited'})
    expect(calls()).toEqual(['hit_rate_limit'])
  })

  it('keys the limit on the first forwarded address', async () => {
    await send('lil@example.com', 'lil-example')
    expect(mocks.rpc).toHaveBeenCalledWith('hit_rate_limit', {
      p_key: 'link:ip:203.0.113.7',
      p_limit: 20,
      p_window: '10 minutes',
    })
  })

  it('fails closed when the lookup errors', async () => {
    answers({access_link_for: {data: null, error: {code: '57014'}}})
    expect(await send('lil@example.com', 'lil-example')).toEqual({status: 'error'})
    expect(mocks.sendAccessLink).not.toHaveBeenCalled()
  })
})
