import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {accessLink} from '@/lib/welcome-email'

const SITE = 'https://onboarding.vydia.com'

vi.mock('server-only', () => ({}))
const service = vi.hoisted(() => ({rpc: vi.fn()}))
const resend = vi.hoisted(() => ({sendEmail: vi.fn()}))
vi.mock('@/lib/supabase/service', () => ({createServiceClient: () => service}))
vi.mock('@/lib/resend', () => ({sendEmail: resend.sendEmail}))

describe('sendWelcomeEmails', () => {
  let sendWelcomeEmails: typeof import('@/lib/access-links').sendWelcomeEmails
  const rows = [
    {email: 'one@example.com', token: '1'.repeat(64), client_name: 'C', slug: 'c'},
    {email: 'two@example.com', token: '2'.repeat(64), client_name: 'C', slug: 'c'},
  ]

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SITE_URL = SITE
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
    ;({sendWelcomeEmails} = await import('@/lib/access-links'))
  })
  beforeEach(() => {
    service.rpc.mockReset()
    resend.sendEmail.mockReset()
    service.rpc.mockImplementation(async (name: string) =>
      name === 'unsent_access_links' ? {data: rows, error: null} : {data: null, error: null},
    )
  })

  it('emails every unsent address its own link and marks only the ones that went out', async () => {
    resend.sendEmail.mockImplementation(async ({to}: {to: string}) => to === 'one@example.com')
    expect(await sendWelcomeEmails('client-id')).toEqual({failed: ['two@example.com']})
    expect(resend.sendEmail).toHaveBeenCalledTimes(2)
    expect(resend.sendEmail.mock.calls[1]?.[0].text).toContain(accessLink(SITE, rows[1]!.token))
    expect(service.rpc).toHaveBeenCalledWith('mark_access_links_sent', {p_tokens: [rows[0]!.token]})
  })

  it('sends nothing when every email already has its link', async () => {
    service.rpc.mockResolvedValue({data: [], error: null})
    expect(await sendWelcomeEmails('client-id')).toEqual({failed: []})
    expect(resend.sendEmail).not.toHaveBeenCalled()
  })
})
