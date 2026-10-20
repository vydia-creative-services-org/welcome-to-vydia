import {DocumentIcon} from '@sanity/icons/Document'
import {createImageUrlBuilder} from '@sanity/image-url'
import {defineField, defineType, type FileValue, type ImageValue, type SanityDocument} from 'sanity'
import {apiVersion, dataset, projectId} from '../env'
import {PdfPreviewInput} from '../components/PdfPreviewInput'

export const RESOURCE_TYPES = [
  {title: 'PDF', value: 'pdf'},
  {title: 'Video', value: 'video'},
  {title: 'Link (pitch forms, external pages)', value: 'link'},
  {title: 'Slide deck', value: 'slides'},
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]['value']

const resourceTypeOf = (doc: SanityDocument | undefined): ResourceType | undefined =>
  RESOURCE_TYPES.find((t) => t.value === doc?.type)?.value

const SLIDE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.apple.keynote',
])

const MIME_RULES: Record<ResourceType, (mime: string) => boolean> = {
  pdf: (m) => m === 'application/pdf',
  video: (m) => m.startsWith('video/'),
  slides: (m) => SLIDE_MIME_TYPES.has(m),
  link: () => false,
}

const FILE_LABELS: Record<ResourceType, string> = {
  pdf: 'PDF',
  video: 'video',
  slides: 'slide deck (PDF, PowerPoint, or Keynote)',
  link: 'link',
}

type ResourceDocument = SanityDocument & {
  type?: ResourceType
  file?: FileValue
  url?: string
}

const imageBuilder = createImageUrlBuilder({projectId, dataset})

const thumbnailUrl = (image: ImageValue | undefined) =>
  image?.asset ? imageBuilder.image(image.asset).width(120).height(120).fit('max').url() : undefined

export const resource = defineType({
  name: 'resource',
  title: 'Resource',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: 'type',
      type: 'string',
      options: {list: [...RESOURCE_TYPES], layout: 'radio'},
      initialValue: 'pdf',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'file',
      type: 'file',
      description:
        'Upload the PDF, video, or slide deck. For videos, export as MP4 at 1080p or smaller to keep file sizes down.',
      hidden: ({document}) => document?.type === 'link',
      validation: (rule) =>
        rule.custom<FileValue>(async (file, context) => {
          const type = resourceTypeOf(context.document)
          const ref = file?.asset?._ref
          if (!type || type === 'link' || !ref) return true
          const mime = await context.getClient({apiVersion}).fetch<string | null>('*[_id == $ref][0].mimeType', {ref})
          return mime && MIME_RULES[type](mime)
            ? true
            : `This file isn't a ${FILE_LABELS[type]} (it's ${mime ?? 'an unknown type'}). Upload the right file or change the Type above.`
        }),
    }),
    defineField({
      name: 'url',
      title: 'Link URL',
      type: 'url',
      description: 'For links and pitch forms. Slide decks can use a link (e.g. Google Slides) instead of an upload.',
      hidden: ({document}) => document?.type === 'pdf' || document?.type === 'video',
      validation: (rule) => rule.uri({scheme: ['https', 'http']}),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover photo (optional)',
      type: 'image',
      options: {hotspot: true},
      description:
        'Shown on the card. If empty, PDFs use their first page and everything else uses a branded Vydia tile.',
      fields: [defineField({name: 'alt', type: 'string', title: 'Alt text'})],
    }),
    defineField({
      name: 'pdfPreview',
      title: 'PDF first-page preview',
      type: 'image',
      description: 'Generated automatically when you upload a PDF. Only used when there is no cover photo.',
      hidden: ({document}) => document?.type !== 'pdf',
      components: {input: PdfPreviewInput},
      fields: [defineField({name: 'source', title: 'Generated from file', type: 'string', hidden: true})],
    }),
    defineField({
      name: 'addedOn',
      title: 'Added on',
      type: 'datetime',
      description:
        'Shown on the card as "Added on …". Defaults to when this resource was created. Editing the resource later does NOT change it. When migrating from Seismic, set this to the original date.',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
  ],
  validation: (rule) =>
    rule.custom<ResourceDocument>((doc) => {
      if (!doc?.type) return true
      const hasFile = Boolean(doc.file?.asset)
      const hasUrl = Boolean(doc.url)
      if (doc.type === 'pdf' && !hasFile) return 'Upload a PDF.'
      if (doc.type === 'video' && !hasFile) return 'Upload the video file.'
      if (doc.type === 'link' && !hasUrl) return 'Add the link URL.'
      if (doc.type === 'slides' && !hasFile && !hasUrl) return 'Upload the deck or add a link.'
      if (doc.type === 'slides' && hasFile && hasUrl) return 'Use either an upload or a link, not both.'
      return true
    }),
  orderings: [
    {title: 'Newest first', name: 'addedOnDesc', by: [{field: 'addedOn', direction: 'desc'}]},
    {title: 'Title', name: 'titleAsc', by: [{field: 'title', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'title', type: 'type', addedOn: 'addedOn', cover: 'coverImage', pdf: 'pdfPreview'},
    prepare: ({
      title,
      type,
      addedOn,
      cover,
      pdf,
    }: {
      title?: string
      type?: ResourceType
      addedOn?: string
      cover?: ImageValue
      pdf?: ImageValue
    }) => ({
      title,
      subtitle: [RESOURCE_TYPES.find((t) => t.value === type)?.title, addedOn?.slice(0, 10)]
        .filter(Boolean)
        .join(' · '),
      imageUrl: thumbnailUrl(cover) ?? thumbnailUrl(pdf),
    }),
  },
})
