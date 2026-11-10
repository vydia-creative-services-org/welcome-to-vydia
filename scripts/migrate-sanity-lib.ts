import {createHash} from 'node:crypto'
import {z} from 'zod'
import {RESOURCE_TYPE_VALUES, type Hotspot, type ResourceType} from '../lib/resources/types'

const fileAsset = z.object({
  url: z.string(),
  mimeType: z.string(),
  sha1hash: z.string(),
  size: z.number().nullish(),
  originalFilename: z.string().nullish(),
})

const imageAsset = z.object({
  url: z.string(),
  mimeType: z.string(),
  sha1hash: z.string(),
  width: z.number(),
  height: z.number(),
  lqip: z.string().nullish(),
})

const crop = z.object({top: z.number(), bottom: z.number(), left: z.number(), right: z.number()})
const hotspot = z.object({x: z.number(), y: z.number()})

export const sanityResource = z.object({
  _id: z.string(),
  _createdAt: z.string(),
  title: z.string().nullish(),
  type: z.enum(RESOURCE_TYPE_VALUES).nullish(),
  url: z.string().nullish(),
  category: z.string().nullish(),
  sortOrder: z.number().nullish(),
  addedOn: z.string().nullish(),
  file: fileAsset.nullish(),
  coverImage: z
    .object({alt: z.string().nullish(), hotspot: hotspot.nullish(), crop: crop.nullish(), asset: imageAsset.nullish()})
    .nullish(),
  pdfPreview: z.object({asset: imageAsset.nullish()}).nullish(),
})

export type SanityResource = z.infer<typeof sanityResource>
export type ImageAsset = z.infer<typeof imageAsset>
export type FileAsset = z.infer<typeof fileAsset>

export const SANITY_QUERY = `*[_id == "website"][0].resources[defined(@->_id)]->{
  _id, _createdAt, title, type, url, category, sortOrder, addedOn,
  "file": file.asset->{url, mimeType, sha1hash, size, originalFilename},
  coverImage{alt, hotspot, crop, "asset": asset->{url, mimeType, sha1hash, "width": metadata.dimensions.width, "height": metadata.dimensions.height, "lqip": metadata.lqip}},
  pdfPreview{"asset": asset->{url, mimeType, sha1hash, "width": metadata.dimensions.width, "height": metadata.dimensions.height, "lqip": metadata.lqip}}
}`

export function uuidFromSanityId(id: string): string {
  const stable = id.replace(/^drafts\./, '')
  const hash = createHash('sha1').update(`welcome-to-vydia:${stable}`).digest('hex')
  const variant = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

type Crop = z.infer<typeof crop>

export type CoverPlan = {url: string; hotspot: Hotspot | null; cropKey: string}

export function croppedCover(
  asset: Pick<ImageAsset, 'url' | 'width' | 'height'>,
  cropValue: Crop | null | undefined,
  hotspotValue: Hotspot | null | undefined,
): CoverPlan {
  const c = cropValue ?? {top: 0, bottom: 0, left: 0, right: 0}
  const width = 1 - c.left - c.right
  const height = 1 - c.top - c.bottom
  const hasCrop = c.top > 0 || c.bottom > 0 || c.left > 0 || c.right > 0
  const rect = [c.left * asset.width, c.top * asset.height, width * asset.width, height * asset.height]
    .map(Math.round)
    .join(',')
  const params = [...(hasCrop ? [`rect=${rect}`] : []), 'w=2000', 'fit=max', 'fm=webp', 'q=85'].join('&')
  return {
    url: `${asset.url}?${params}`,
    hotspot: hotspotValue
      ? {x: clamp((hotspotValue.x - c.left) / width), y: clamp((hotspotValue.y - c.top) / height)}
      : null,
    cropKey: hasCrop ? createHash('sha1').update(rect).digest('hex').slice(0, 8) : 'full',
  }
}

export type Target = {ok: true; file: boolean; url: string | null; notes: string[]} | {ok: false; reason: string}

export function resolveTarget(type: ResourceType, hasFile: boolean, url: string | null | undefined): Target {
  const link = url?.trim() || null
  if (type === 'pdf' || type === 'video') {
    if (!hasFile) return {ok: false, reason: `no uploaded ${type === 'pdf' ? 'PDF' : 'video'} file`}
    return {
      ok: true,
      file: true,
      url: null,
      notes: link ? ['ignored a stale link URL (PDFs and videos are uploaded)'] : [],
    }
  }
  if (type === 'link') {
    if (!link) return {ok: false, reason: 'no link URL'}
    return {ok: true, file: false, url: link, notes: hasFile ? ['ignored a stale uploaded file (links have none)'] : []}
  }
  if (hasFile) {
    return {ok: true, file: true, url: null, notes: link ? ['had both an upload and a link; kept the upload'] : []}
  }
  if (link) return {ok: true, file: false, url: link, notes: []}
  return {ok: false, reason: 'neither an upload nor a link'}
}

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.apple.keynote': 'key',
}

export function fileExtension(asset: Pick<FileAsset, 'mimeType' | 'originalFilename'>): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(asset.originalFilename ?? '')
  return (match?.[1] ?? MIME_EXTENSIONS[asset.mimeType] ?? 'bin').toLowerCase()
}

export const filePath = (id: string, asset: Pick<FileAsset, 'sha1hash' | 'mimeType' | 'originalFilename'>) =>
  `${id}/file-${asset.sha1hash.slice(0, 16)}.${fileExtension(asset)}`

export const imagePath = (id: string, kind: 'cover' | 'preview', hash: string, cropKey: string) =>
  `${id}/${kind}-${hash.slice(0, 12)}-${cropKey}.webp`
