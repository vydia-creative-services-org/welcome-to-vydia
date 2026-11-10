import {createClient} from '@supabase/supabase-js'
import type {Database} from '../lib/supabase/database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.')

const supabase = createClient<Database>(url, secret, {auth: {persistSession: false}})

const shouldDelete = process.argv.includes('--delete')
const ageFlag = process.argv.indexOf('--min-age-hours')
const minAgeHours = ageFlag >= 0 ? Number(process.argv[ageFlag + 1]) : 24
if (!Number.isFinite(minAgeHours) || minAgeHours < 0) throw new Error('--min-age-hours needs a number of hours.')

const minAgeMs = minAgeHours * 60 * 60 * 1000
const PAGE_SIZE = 1000

type StorageBucket = ReturnType<typeof supabase.storage.from>
type Listed = NonNullable<Awaited<ReturnType<StorageBucket['list']>>['data']>

async function list(bucket: string, prefix: string): Promise<Listed> {
  const items: Listed = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const {data, error} = await supabase.storage.from(bucket).list(prefix, {limit: PAGE_SIZE, offset})
    if (error) throw error
    items.push(...data)
    if (data.length < PAGE_SIZE) return items
  }
}

async function main() {
  const {data: rows, error} = await supabase.from('resources').select('file, cover_image, pdf_preview')
  if (error) throw error
  const referenced = new Set(rows.flatMap((row) => [row.file, row.cover_image, row.pdf_preview]).filter(Boolean))

  for (const bucket of ['resource-files', 'resource-images']) {
    const orphans: string[] = []
    for (const folder of await list(bucket, '')) {
      if (folder.id !== null) continue
      for (const object of await list(bucket, folder.name)) {
        const path = `${folder.name}/${object.name}`
        const age = Date.now() - new Date(object.created_at ?? 0).getTime()
        if (!referenced.has(path) && age >= minAgeMs) orphans.push(path)
      }
    }
    console.log(`${bucket}: ${orphans.length} orphaned object(s) older than ${minAgeHours} h`)
    for (const path of orphans) console.log(`  ${path}`)
    if (shouldDelete && orphans.length) {
      for (let i = 0; i < orphans.length; i += PAGE_SIZE) {
        const {error: removeError} = await supabase.storage.from(bucket).remove(orphans.slice(i, i + PAGE_SIZE))
        if (removeError) throw removeError
      }
      console.log(`  deleted ${orphans.length}`)
    }
  }
  if (!shouldDelete) console.log('Dry run. Re-run with --delete to remove these.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
