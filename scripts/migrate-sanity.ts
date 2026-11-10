import {createClient as createSanity} from '@sanity/client'
import {createClient as createSupabase} from '@supabase/supabase-js'
import {z} from 'zod'
import {resourceInput} from '../lib/validation'
import type {Database} from '../lib/supabase/database.types'
import {
  croppedCover,
  filePath,
  imagePath,
  resolveTarget,
  SANITY_QUERY,
  sanityResource,
  uuidFromSanityId,
  type ImageAsset,
  type SanityResource,
} from './migrate-sanity-lib'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

const dryRun = process.argv.includes('--dry-run')
const includeDrafts = process.argv.includes('--include-drafts')
const categoryFlag = process.argv.indexOf('--default-category')
const defaultCategory = categoryFlag >= 0 ? process.argv[categoryFlag + 1]?.trim() : undefined
const sizeFlag = process.argv.indexOf('--max-file-mb')
const maxFileMb = sizeFlag >= 0 ? Number(process.argv[sizeFlag + 1]) : null
if (maxFileMb !== null && (!Number.isFinite(maxFileMb) || maxFileMb <= 0))
  throw new Error('--max-file-mb needs a number of megabytes.')

const sanity = createSanity({
  projectId: requireEnv('NEXT_PUBLIC_SANITY_PROJECT_ID'),
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2025-02-19',
  token: requireEnv('SANITY_API_READ_TOKEN'),
  useCdn: false,
  perspective: includeDrafts ? 'drafts' : 'published',
})

const supabase = createSupabase<Database>(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
  auth: {persistSession: false},
})

class Skip extends Error {}

type Outcome = {title: string; sanityId: string; detail: string}

async function objectExists(bucket: string, path: string) {
  const slash = path.lastIndexOf('/')
  const {data, error} = await supabase.storage.from(bucket).list(path.slice(0, slash), {search: path.slice(slash + 1)})
  if (error) throw new Error(`list ${bucket}/${path}: ${error.message}`)
  return data.some((object) => object.name === path.slice(slash + 1))
}

async function copy(url: string, bucket: string, path: string, contentType: string) {
  if (dryRun || (await objectExists(bucket, path))) return
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download ${url}: ${response.status}`)
  const {error} = await supabase.storage.from(bucket).upload(path, await response.blob(), {contentType, upsert: true})
  if (error && /maximum allowed size|payload too large/i.test(error.message)) {
    throw new Skip('over this project’s upload limit: raise Storage → global file size limit (Pro) and re-run')
  }
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`)
}

async function copyImage(
  id: string,
  kind: 'cover' | 'preview',
  asset: ImageAsset,
  plan: ReturnType<typeof croppedCover>,
) {
  const path = imagePath(id, kind, asset.sha1hash, plan.cropKey)
  await copy(plan.url, 'resource-images', path, 'image/webp')
  return path
}

async function migrateOne(doc: SanityResource, index: number): Promise<{notes: string[]}> {
  const id = uuidFromSanityId(doc._id)
  const category = doc.category?.trim() || defaultCategory
  if (!category) throw new Skip('no category (set it in Studio and publish, or pass --default-category)')
  if (!doc.type) throw new Skip('no type')
  const target = resolveTarget(doc.type, Boolean(doc.file), doc.url)
  if (!target.ok) throw new Skip(target.reason)

  if (maxFileMb !== null && target.file && doc.file?.size && doc.file.size > maxFileMb * 1024 * 1024) {
    throw new Skip(
      `${Math.round(doc.file.size / 1024 / 1024)} MB is over --max-file-mb ${maxFileMb}; re-run without it once the limit is raised`,
    )
  }
  const file = target.file && doc.file ? filePath(id, doc.file) : null
  if (file && doc.file) await copy(doc.file.url, 'resource-files', file, doc.file.mimeType)

  const coverAsset = doc.coverImage?.asset
  const coverPlan = coverAsset ? croppedCover(coverAsset, doc.coverImage?.crop, doc.coverImage?.hotspot) : null
  const coverPath = coverAsset && coverPlan ? await copyImage(id, 'cover', coverAsset, coverPlan) : null

  const previewAsset = doc.type === 'pdf' ? doc.pdfPreview?.asset : null
  const previewPlan = previewAsset ? croppedCover(previewAsset, null, null) : null
  const previewPath = previewAsset && previewPlan ? await copyImage(id, 'preview', previewAsset, previewPlan) : null

  const candidate = {
    id,
    title: doc.title ?? '',
    type: doc.type,
    file,
    url: target.url,
    coverImage: coverPath,
    coverImageAlt: doc.coverImage?.alt ?? null,
    coverImageLqip: coverPath ? (coverAsset?.lqip ?? null) : null,
    pdfPreview: previewPath,
    pdfPreviewLqip: previewPath ? (previewAsset?.lqip ?? null) : null,
    category,
    addedOn: doc.addedOn ?? doc._createdAt,
  }
  const parsed = resourceInput.safeParse(candidate)
  if (!parsed.success) throw new Skip(parsed.error.issues.map((issue) => issue.message).join('; '))
  const row = parsed.data

  if (!dryRun) {
    const {error} = await supabase.from('resources').upsert({
      id,
      artist_id: null,
      title: row.title,
      type: row.type,
      file: row.file,
      url: row.url,
      cover_image: row.coverImage,
      cover_image_alt: row.coverImageAlt,
      cover_image_hotspot: coverPlan?.hotspot ?? null,
      cover_image_lqip: row.coverImageLqip,
      pdf_preview: row.pdfPreview,
      pdf_preview_lqip: row.pdfPreviewLqip,
      category: row.category,
      sort_order: doc.sortOrder ?? index + 1,
      added_on: row.addedOn,
    })
    if (error) throw new Error(`save: ${error.message}`)
  }
  return {notes: target.notes}
}

async function main() {
  const fetched = await sanity.fetch(SANITY_QUERY)
  const docs = z.array(sanityResource).parse(fetched ?? [])
  const migrated: Outcome[] = []
  const skipped: Outcome[] = []

  for (const [index, doc] of docs.entries()) {
    const title = doc.title ?? '(untitled)'
    const sanityId = doc._id.replace(/^drafts\./, '')
    try {
      const {notes} = await migrateOne(doc, index)
      migrated.push({title, sanityId, detail: notes.join('; ')})
    } catch (error) {
      skipped.push({title, sanityId, detail: error instanceof Error ? error.message : 'failed'})
    }
  }

  const mode = `${dryRun ? '[dry run] ' : ''}${includeDrafts ? '(including unpublished drafts) ' : ''}`
  console.log(`${mode}Website lists ${docs.length} resources: migrated ${migrated.length}, skipped ${skipped.length}`)
  for (const item of migrated) console.log(`  ✓ ${item.title}${item.detail ? `  [${item.detail}]` : ''}`)
  for (const item of skipped) console.log(`  ✗ ${item.title}: ${item.detail}`)
  if (skipped.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
