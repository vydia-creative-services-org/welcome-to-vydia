export const RESOURCE_TYPE_VALUES = ['pdf', 'video', 'link', 'slides'] as const

export type ResourceType = (typeof RESOURCE_TYPE_VALUES)[number]

export const RESOURCE_TYPES = [
  {title: 'PDF', value: 'pdf'},
  {title: 'Video', value: 'video'},
  {title: 'Link (pitch forms, external pages)', value: 'link'},
  {title: 'Slide deck', value: 'slides'},
] as const satisfies readonly {title: string; value: ResourceType}[]

export type Hotspot = {x: number; y: number}

export type Resource = {
  id: string
  artistId: string | null
  title: string
  type: ResourceType
  file: string | null
  url: string | null
  coverImage: {path: string; alt: string | null; hotspot: Hotspot | null; lqip: string | null} | null
  pdfPreview: {path: string; lqip: string | null} | null
  category: string
  sortOrder: number
  addedOn: string
}

export type ResourceCardData = {
  id: string
  title: string
  type: ResourceType
  category: string
  href: string
  cover: {src: string; alt: string; position: string; lqip: string | null} | null
}
