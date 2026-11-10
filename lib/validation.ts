import {z} from 'zod'
import {EMAIL_PATTERN} from './email'
import {RESOURCE_TYPE_VALUES} from './resources/types'
import {isValidSlug, SLUG_MAX, SLUG_MIN} from './slug'

const lqip = z
  .string()
  .max(4096)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
const emailField = z.string().trim().toLowerCase().regex(EMAIL_PATTERN, 'Enter a valid email address.')

export const resourceInput = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1, 'Title is required.').max(120, 'Keep the title under 120 characters.'),
    type: z.enum(RESOURCE_TYPE_VALUES),
    file: z.string().min(1).nullable(),
    url: z.url({protocol: /^https?$/}).nullable(),
    coverImage: z.string().min(1).nullable(),
    coverImageAlt: z.string().trim().nullable(),
    coverImageLqip: lqip.nullable(),
    pdfPreview: z.string().min(1).nullable(),
    pdfPreviewLqip: lqip.nullable(),
    category: z.string().trim().min(1, 'Category is required.'),
    addedOn: z.iso.datetime({offset: true}).optional(),
  })
  .superRefine((r, ctx) => {
    const fail = (path: 'file' | 'url', message: string) => ctx.addIssue({code: 'custom', path: [path], message})
    if ((r.type === 'pdf' || r.type === 'video') && !r.file)
      fail('file', r.type === 'pdf' ? 'Upload a PDF.' : 'Upload the video file.')
    if ((r.type === 'pdf' || r.type === 'video') && r.url) fail('url', 'Videos and PDFs are uploaded, not linked.')
    if (r.type === 'link' && !r.url) fail('url', 'Add the link URL.')
    if (r.type === 'link' && r.file) fail('file', 'Links don’t have a file.')
    if (r.type === 'slides' && !r.file && !r.url) fail('file', 'Upload the deck or add a link.')
    if (r.type === 'slides' && r.file && r.url) fail('url', 'Use either an upload or a link, not both.')
    if (r.pdfPreview && r.type !== 'pdf') fail('file', 'Only PDFs have a preview.')
  })

export const clientPayload = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, 'Client name is required.').max(100, 'Keep the name under 100 characters.'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(SLUG_MIN, `At least ${SLUG_MIN} characters.`)
      .max(SLUG_MAX, `At most ${SLUG_MAX} characters.`)
      .refine(isValidSlug, 'Lowercase letters, numbers, and single hyphens only (and not a reserved word).'),
    emails: z
      .array(z.object({email: emailField, label: z.string().trim().max(40).default(''), isPrimary: z.boolean()}))
      .min(1),
    hiddenResourceIds: z.array(z.uuid()),
    exclusiveResources: z.array(resourceInput),
  })
  .superRefine((a, ctx) => {
    if (a.emails.filter((e) => e.isPrimary).length !== 1)
      ctx.addIssue({code: 'custom', path: ['emails'], message: 'Add a primary email.'})
    const seen = new Set<string>()
    a.emails.forEach((e, i) => {
      if (seen.has(e.email))
        ctx.addIssue({code: 'custom', path: ['emails', i, 'email'], message: 'This email is listed twice.'})
      seen.add(e.email)
    })
  })

export type ClientPayload = z.infer<typeof clientPayload>
export type ClientInput = z.input<typeof clientPayload>
export type ResourceInput = z.infer<typeof resourceInput>
export type ResourceInputValue = z.input<typeof resourceInput>
