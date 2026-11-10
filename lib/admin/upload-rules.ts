import type {ResourceType} from '@/lib/resources/types'

export type UploadKind = 'file' | 'cover' | 'preview'

export const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const SLIDE_TYPES: readonly string[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.apple.keynote',
]

const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  key: 'application/vnd.apple.keynote',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const FILE_LABELS: Record<ResourceType, string> = {
  pdf: 'PDF',
  video: 'video',
  slides: 'slide deck (PDF, PowerPoint, or Keynote)',
  link: 'link',
}

export const extensionOf = (name: string) => (name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '')

export function mimeFor(file: {type: string; name: string}) {
  return file.type || EXTENSION_TYPES[extensionOf(file.name)] || ''
}

export function fileTypeAllowed(type: ResourceType, mime: string) {
  if (type === 'pdf') return mime === 'application/pdf'
  if (type === 'video') return mime.startsWith('video/')
  if (type === 'slides') return SLIDE_TYPES.includes(mime)
  return false
}

export function fileTypeMessage(type: ResourceType, mime: string) {
  return `This file isn’t a ${FILE_LABELS[type]} (it’s ${mime || 'an unknown type'}). Upload the right file or change the Type above.`
}

export const IMAGE_MESSAGE = 'Cover images must be JPG, PNG, or WebP and at most 5 MB.'

export const imageAllowed = (mime: string, size: number) => IMAGE_TYPES.includes(mime) && size <= MAX_IMAGE_BYTES
