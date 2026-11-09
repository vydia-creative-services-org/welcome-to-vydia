import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {beforeAll, describe, expect, it} from 'vitest'
import {z} from 'zod'
import {RESOURCE_TYPE_VALUES, RESOURCE_TYPES} from '@/lib/resources/types'

type Mapping = typeof import('@/lib/resources/mapping')

const entries = z.array(z.object({name: z.string()}).loose())
const attribute = z.object({
  value: z.object({type: z.string(), of: z.array(z.object({value: z.string()}).loose()).optional()}).loose(),
  optional: z.boolean().optional(),
})
const resourceEntry = z.object({name: z.literal('resource'), attributes: z.record(z.string(), attribute)})

const schemaPath = join(process.cwd(), 'sanity/schema.json')
const raw = z.parse(entries, JSON.parse(readFileSync(schemaPath, 'utf8')))
const resource = z.parse(
  resourceEntry,
  raw.find((entry) => entry.name === 'resource'),
)
const sanityFields = Object.keys(resource.attributes).filter((key) => !key.startsWith('_'))

let mapping: Mapping

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://welcometovydia.com'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  mapping = await import('@/lib/resources/mapping')
})

describe('Sanity and Supabase resource contract', () => {
  it('maps every Sanity resource field and nothing else', () => {
    expect([...sanityFields].sort()).toEqual(Object.keys(mapping.RESOURCE_FIELD_MAP).sort())
  })

  it('includes the fields iteration two added to Sanity', () => {
    expect(sanityFields).toEqual(expect.arrayContaining(['category', 'sortOrder']))
  })

  it('allows exactly the Sanity resource types, in order', () => {
    const union = resource.attributes.type.value.of ?? []
    expect(union.map((option) => option.value)).toEqual([...RESOURCE_TYPE_VALUES])
  })

  it('lists the same values in RESOURCE_TYPES and RESOURCE_TYPE_VALUES', () => {
    expect(RESOURCE_TYPES.map((type) => type.value)).toEqual([...RESOURCE_TYPE_VALUES])
  })
})
