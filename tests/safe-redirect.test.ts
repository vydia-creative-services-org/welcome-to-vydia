import {beforeAll, describe, expect, it} from 'vitest'

let safeNext: (raw: string | null | undefined) => string

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://welcometovydia.com'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  safeNext = (await import('@/lib/safe-redirect')).safeNext
})

describe('safeNext', () => {
  it.each([
    ['/test-artist', '/test-artist'],
    ['/test-artist?tab=1', '/test-artist?tab=1'],
    ['https://welcometovydia.com/test-artist', '/test-artist'],
    ['/account/update-password', '/account/update-password'],
  ])('keeps same-site path %s', (raw, expected) => expect(safeNext(raw)).toBe(expected))

  it.each([
    ['https://evil.example.com/steal'],
    ['//evil.example.com'],
    ['///evil.example.com'],
    ['/\\evil.example.com'],
    ['http://welcometovydia.com/x'],
    ['javascript:alert(1)'],
    ['https://welcometovydia.com.evil.com/x'],
  ])('rejects %s', (raw) => expect(safeNext(raw)).toBe('/'))

  it.each([[null], [undefined], ['']])('falls back to / for %s', (raw) => expect(safeNext(raw)).toBe('/'))
})
