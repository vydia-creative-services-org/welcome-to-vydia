import type {Resource, ResourceType} from '@/lib/resources/types'
import {resourceInput, type ResourceInputValue} from '@/lib/validation'

export type ResourceDraft = {
  id: string
  title: string
  type: ResourceType
  file: string | null
  fileName: string | null
  url: string
  coverImage: string | null
  coverImageAlt: string
  coverImageLqip: string | null
  pdfPreview: string | null
  pdfPreviewLqip: string | null
  category: string
  addedOn: string
  uploads: number
  message: string | null
  messageTone: 'info' | null
}

export type DraftErrors = Partial<Record<string, string>>

export function newDraft(category = ''): ResourceDraft {
  return {
    id: crypto.randomUUID(),
    title: '',
    type: 'pdf',
    file: null,
    fileName: null,
    url: '',
    coverImage: null,
    coverImageAlt: '',
    coverImageLqip: null,
    pdfPreview: null,
    pdfPreviewLqip: null,
    category,
    addedOn: '',
    uploads: 0,
    message: null,
    messageTone: null,
  }
}

const baseName = (path: string) => path.split('/').pop() ?? path

export function draftFromResource(resource: Resource): ResourceDraft {
  return {
    id: resource.id,
    title: resource.title,
    type: resource.type,
    file: resource.file,
    fileName: resource.file ? baseName(resource.file) : null,
    url: resource.url ?? '',
    coverImage: resource.coverImage?.path ?? null,
    coverImageAlt: resource.coverImage?.alt ?? '',
    coverImageLqip: resource.coverImage?.lqip ?? null,
    pdfPreview: resource.pdfPreview?.path ?? null,
    pdfPreviewLqip: resource.pdfPreview?.lqip ?? null,
    category: resource.category,
    addedOn: resource.addedOn,
    uploads: 0,
    message: null,
    messageTone: null,
  }
}

export function draftToInput(draft: ResourceDraft): ResourceInputValue {
  return {
    id: draft.id,
    title: draft.title,
    type: draft.type,
    file: draft.file,
    url: draft.url.trim() || null,
    coverImage: draft.coverImage,
    coverImageAlt: draft.coverImageAlt.trim() || null,
    coverImageLqip: draft.coverImageLqip,
    pdfPreview: draft.pdfPreview,
    pdfPreviewLqip: draft.pdfPreviewLqip,
    category: draft.category,
    addedOn: draft.addedOn || undefined,
  }
}

export function validateDraft(draft: ResourceDraft): DraftErrors {
  const result = resourceInput.safeParse(draftToInput(draft))
  if (result.success) return {}
  const errors: DraftErrors = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form')
    errors[field] ??= issue.message
  }
  return errors
}

export const dateInputValue = (addedOn: string) => addedOn.slice(0, 10)

export const dateInputToIso = (value: string) => (value ? `${value}T12:00:00.000Z` : '')
