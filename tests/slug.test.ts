import {describe, expect, it} from 'vitest'
import {RESERVED_SLUGS, SLUG_PATTERN, slugify} from '@/lib/slug'

describe('slugify', () => {
  it.each([
    ['Beyoncé', 'beyonce'],
    ['Guns N’ Roses', 'guns-n-roses'],
    ["Guns N' Roses", 'guns-n-roses'],
    ['Simon & Garfunkel', 'simon-and-garfunkel'],
    ['  A$AP Rocky!! ', 'a-ap-rocky'],
    ['múm', 'mum'],
    ['Sigur Rós', 'sigur-ros'],
    ['---Already--Dashed---', 'already-dashed'],
  ])('%s -> %s', (input, out) => expect(slugify(input)).toBe(out))

  it('caps length at 64 without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(63)} b`)
    expect(slug.length).toBeLessThanOrEqual(64)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('always produces a slug that matches SLUG_PATTERN', () => {
    for (const name of ['Beyoncé', 'Simon & Garfunkel', '  A$AP Rocky!! ', 'The 1975']) {
      expect(slugify(name)).toMatch(SLUG_PATTERN)
    }
  })

  it('returns an empty string when nothing is sluggable', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('SLUG_PATTERN', () => {
  it.each(['jane-doe', 'the-1975', 'a'])('accepts %s', (s) => expect(s).toMatch(SLUG_PATTERN))
  it.each(['Jane', 'jane--doe', '-jane', 'jane-', 'jane_doe', ''])('rejects %s', (s) =>
    expect(s).not.toMatch(SLUG_PATTERN),
  )
})

describe('RESERVED_SLUGS', () => {
  it.each(['studio', 'login', 'auth', 'api', 'account'])('reserves %s', (s) => expect(RESERVED_SLUGS.has(s)).toBe(true))
})
