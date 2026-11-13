import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))

describe('sendEmail', () => {
  const fetchMock = vi.fn()
  let sendEmail: typeof import('@/lib/resend').sendEmail
  const message = {to: 'lil@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi'}

  beforeAll(async () => {
    ;({sendEmail} = await import('@/lib/resend'))
  })
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('posts to Resend with the key and sender', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('EMAIL_FROM', 'Vydia <welcome@onboarding.vydia.com>')
    fetchMock.mockResolvedValue(new Response('{"id":"1"}', {status: 200}))
    expect(await sendEmail(message)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer re_test')
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Vydia <welcome@onboarding.vydia.com>',
      to: ['lil@example.com'],
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    })
  })

  it('reports a rejected or failed request as not sent', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('EMAIL_FROM', 'welcome@onboarding.vydia.com')
    fetchMock.mockResolvedValueOnce(new Response('rate limited', {status: 429}))
    expect(await sendEmail(message)).toBe(false)
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect(await sendEmail(message)).toBe(false)
  })

  it('fails in production without a key, and only prints the email in development', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(await sendEmail(message)).toBe(false)
    vi.stubEnv('NODE_ENV', 'development')
    expect(await sendEmail(message)).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
