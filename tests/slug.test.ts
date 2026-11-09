import {readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {describe, expect, it} from 'vitest'
import {isValidSlug, normalizeSlug, RESERVED_SLUGS, SLUG_MAX, SLUG_PATTERN, slugify} from '@/lib/slug'

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

  it('caps length at SLUG_MAX without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(SLUG_MAX - 1)} b`)
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('turns the spec example into lil-example', () => {
    expect(slugify('Lil Example')).toBe('lil-example')
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
  it.each(['admin', 'studio', 'login', 'auth', 'api', 'account'])('reserves %s', (s) =>
    expect(RESERVED_SLUGS.has(s)).toBe(true),
  )
})

describe('isValidSlug', () => {
  it.each(['lil-example', 'the-1975', 'abc', 'a'.repeat(60)])('accepts %s', (slug) =>
    expect(isValidSlug(slug)).toBe(true),
  )
  it.each(['ab', 'a'.repeat(61), 'Jane', 'jane--doe', '-jane', 'jane_doe', '', 'admin', 'api', 'login'])(
    'rejects %s',
    (slug) => expect(isValidSlug(slug)).toBe(false),
  )
})

describe('normalizeSlug', () => {
  it.each([
    ['Lil-Example', 'lil-example'],
    ['  lil-example ', 'lil-example'],
    ['lil%2Dexample', 'lil-example'],
    ['100%', '100%'],
  ])('%s -> %s', (input, out) => expect(normalizeSlug(input)).toBe(out))
})

describe('the database slug constraint', () => {
  it('reserves exactly the words RESERVED_SLUGS does', () => {
    const dir = join(process.cwd(), 'supabase/migrations')
    const file = readdirSync(dir).find((name) => name.endsWith('_iteration_two.sql'))
    expect(file).toBeDefined()
    const sql = readFileSync(join(dir, file ?? ''), 'utf8')
    const list = /slug not in \(([^)]*)\)/.exec(sql)?.[1] ?? ''
    const inDatabase = [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort()
    expect(inDatabase).toEqual([...RESERVED_SLUGS].sort())
  })
})
