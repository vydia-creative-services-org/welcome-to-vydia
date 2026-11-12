import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const read = (name: string) => readFileSync(`supabase/templates/${name}.html`, 'utf8')
const magic = read('magic-link')
const confirm = read('confirm-signup')
const LINK = '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}'

describe('sign-in email templates', () => {
  it('are byte-identical because Supabase sends either one', () => {
    expect(confirm).toBe(magic)
  })

  it('keep the subject on the first line', () => {
    expect(magic.split('\n')[0]).toBe('<!-- Subject: Open your Vydia Onboarding page -->')
  })

  it('link to the confirm route from the VML button, the button, and the fallback', () => {
    expect(magic.split(LINK).length - 1).toBeGreaterThanOrEqual(4)
    expect(magic).not.toContain('ConfirmationURL')
  })

  it('load images only from the site', () => {
    const sources = [...magic.matchAll(/src="([^"]+)"/g)].map((match) => match[1] ?? '')
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) expect(source.startsWith('{{ .SiteURL }}/')).toBe(true)
  })

  it('greets with Welcome to Vydia', () => {
    expect(magic).toContain('Welcome to Vydia')
  })

  it('stays well under Gmail’s clipping limit', () => {
    expect(Buffer.byteLength(magic)).toBeLessThan(30 * 1024)
  })
})
