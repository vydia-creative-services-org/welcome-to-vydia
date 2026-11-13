import {describe, expect, it} from 'vitest'
import {accessLink, welcomeEmail} from '@/lib/welcome-email'

const SITE = 'https://onboarding.vydia.com'
const TOKEN = 'ab'.repeat(32)

describe('welcomeEmail', () => {
  const link = accessLink(SITE, TOKEN)
  const email = welcomeEmail({siteUrl: SITE, email: 'lil@example.com', clientName: 'Lil Example', link})

  it('links to the permanent open route', () => {
    expect(link).toBe(`${SITE}/auth/open?t=${TOKEN}`)
    // The VML button, the button, and the fallback link and its text.
    expect(email.html.split(link).length - 1).toBe(4)
    expect(email.text).toContain(link)
  })

  it('colors the button and fallback text on a span, since Gmail strips color from links', () => {
    expect(email.html).toMatch(
      /<a class="btn"[^>]*>\s*<span class="btn-label" style="color:#ffffff;[^"]*">Open my page<\/span>/,
    )
    expect(email.html).toContain(`<span class="soft" style="color:#666666;text-decoration:underline;">${link}</span>`)
    expect(email.html).toContain('.btn-label { color: #0a0a0a !important; }')
  })

  it('never says the link expires', () => {
    expect(email.html).not.toMatch(/expire/i)
    expect(email.text).not.toMatch(/expire/i)
    expect(email.html).toContain('yours to keep')
  })

  it('names the client in the subject and body, so emails for two clients look different', () => {
    expect(email.subject).toBe('Open Lil Example’s Vydia Onboarding page')
    expect(email.html).toContain('Welcome to Vydia')
    expect(email.html).toContain('Lil Example')
    expect(email.html).toContain('lil@example.com')
    expect(email.text).toContain('for Lil Example as lil@example.com')
    const other = welcomeEmail({siteUrl: SITE, email: 'lil@example.com', clientName: 'Big Example', link})
    expect(other.subject).not.toBe(email.subject)
  })

  it('keeps a client name with line breaks on one line', () => {
    expect(welcomeEmail({siteUrl: SITE, email: 'a@b.co', clientName: ' Two\nLines ', link}).subject).toBe(
      'Open Two Lines’s Vydia Onboarding page',
    )
  })

  it('escapes the address and the client name', () => {
    const odd = welcomeEmail({siteUrl: SITE, email: 'a<b>"c@example.com', clientName: 'R&B <Duo>', link})
    expect(odd.html).toContain('R&amp;B &lt;Duo&gt;')
    expect(odd.html).toContain('a&lt;b&gt;&quot;c@example.com')
    expect(odd.html).not.toContain('a<b>')
  })

  it('loads images only from the site', () => {
    const sources = [...email.html.matchAll(/src="([^"]+)"/g)].map((match) => match[1] ?? '')
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) expect(source.startsWith(`${SITE}/`)).toBe(true)
  })

  it('stays well under Gmail’s clipping limit', () => {
    expect(Buffer.byteLength(email.html)).toBeLessThan(30 * 1024)
  })
})
