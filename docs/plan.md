# Welcome to Vydia Microsite: Implementation Plan

> Source of truth for requirements: [`docs/research.md`](./research.md).
> Visual reference: [`docs/screenshots/sample website.png`](./screenshots/sample%20website.png).
> Logo: [`docs/logo/gamma-vydia-white.svg`](./logo/gamma-vydia-white.svg) (1233×139, white, for dark backgrounds).

---

## 0. TL;DR

One Next.js (App Router) app on Vercel that serves three things:

| Route | What it is | Who can reach it |
|---|---|---|
| `/[slug]` | An artist's welcome page (header, intro, extra info, sections of resource cards) | Signed-in Supabase users whose verified email is on that artist's list, plus internal viewers |
| `/login`, `/auth/*` | Supabase Auth: email/password (with email confirmation) and Google | Everyone |
| `/studio` | Embedded Sanity Studio, where L&A edits content | The two shared Sanity seats |

Content lives in a **private** Sanity dataset with four document types: `artist`, `resource`, `section`, and `website` (a singleton). On each request the page reconciles the two systems: **Supabase answers "who is this?"** and **Sanity answers "is this email allowed here?"** Sanity content is cached in Next's data cache and invalidated by a Sanity publish webhook.

The security rule that drives most of the design: an unknown slug and a known slug the user can't access must produce **exactly the same response**, and **only after sign-in**.

---

## 1. Key Decisions (and why)

| # | Decision | Rationale / research reference |
|---|---|---|
| D1 | **Embed Sanity Studio at `/studio`** in the same Next app | One repo, one deploy, one domain. Studio routes are static and take precedence over `/[slug]`. `studio` goes on the reserved-slug list. |
| D2 | **Private Sanity dataset + server-only read token** | Allowed-email lists and the artist roster must never be queryable from the browser. All GROQ runs on the server. |
| D3 | **Gate in two layers**: `proxy.ts` sends anyone without a session to `/login` for *every* non-public path. Then `/[slug]/page.tsx` does the Sanity access check. | The proxy never touches Sanity, so it can't leak whether an artist exists ("sign in before the 'doesn't exist' error"). |
| D4 | **Denied and unknown both call `notFound()`** after one identical Sanity query | Same component, same status (404), same number of round-trips, so the two cases look the same and take the same time. |
| D5 | **Slug is generated once, locked on first publish, renames go through a "Change URL" action that saves the old slug to `previousSlugs`** | Bookmarks have to survive renames. Old slugs redirect (after the access check). Uniqueness is checked against current *and* previous slugs, so an old URL is never reused. |
| D6 | **Permanent internal emails live in code/env; other internal viewers live on the `website` singleton** | The two shared @vydia.com addresses always have access and can't be removed by mistake. Other "designated internal" emails can be edited in Studio. |
| D7 | **`addedOn` is an explicit datetime field**, initialised to "now" on create and editable | `_updatedAt` changes on every edit and `_createdAt` would be the migration date. Editors set the original Seismic date while migrating. |
| D8 | **PDF preview generated in Studio** (pdf.js renders page 1 in the editor's browser and uploads it as an image asset) | No native canvas dependency on Vercel, and the preview exists before publish. Card fallback chain: cover → PDF preview → branded placeholder. |
| D9 | **Sanity fetches tagged by document type, revalidated by webhook** | Editing a global resource updates every artist page right away ("publish webhook required"). |
| D10 | **Use `redirect()` (307), not `permanentRedirect()` (308), for old slugs** | Browsers cache 308s hard. A temporary redirect lets us fix an editor's mistake later. |
| D11 | **Long-lived sessions**: Supabase refresh tokens with no time-box or inactivity timeout, `@supabase/ssr` cookies (≈400-day max-age), refreshed by the proxy on every request | "Returning clients should not face aggressive session expirations." |

---

## 2. Tech Stack and Packages
3. 
<!-- no tailwind, use css components -->

```bash
npx create-next-app@latest welcome-to-vydia --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*"

# Sanity
npm i sanity next-sanity @sanity/image-url @sanity/icons @sanity/ui @sanity/vision styled-components @portabletext/react
# Supabase
npm i @supabase/supabase-js @supabase/ssr
# UI / utils
npm i lucide-react server-only pdfjs-dist
# Dev / test
npm i -D vitest @vitejs/plugin-react @playwright/test
```

- **Next.js 16** (App Router). Next 16 renamed `middleware.ts` to `proxy.ts` and changed the `revalidateTag` signature. If the project ends up on Next 15, rename the file back to `middleware.ts` and export `middleware` instead of `proxy`. Check both points against the installed version when scaffolding.
- **Tailwind CSS v4**, **Source Sans 3** via `next/font` (closest match to the reference screenshot).
- **Sanity Studio v4+** embedded via `next-sanity/studio`.
- **Supabase**: Auth only. No tables are needed for the prototype. Supabase Storage is an optional backup for resource files (research, Tech Stack).

---

## 3. Project Structure

```
welcome-to-vydia/
├─ app/
│  ├─ (site)/                         # public site, own root layout
│  │  ├─ layout.tsx
│  │  ├─ globals.css
│  │  ├─ page.tsx                     # "/" (generic landing; internal index optional)
│  │  ├─ [slug]/
│  │  │  ├─ page.tsx                  # artist page
│  │  │  └─ not-found.tsx             # identical page for unknown + denied
│  │  ├─ login/
│  │  │  ├─ page.tsx
│  │  │  ├─ LoginForm.tsx             # client component
│  │  │  └─ actions.ts                # server actions (sign in / sign up / reset)
│  │  ├─ account/update-password/page.tsx
│  │  └─ auth/
│  │     ├─ callback/route.ts         # Google OAuth code exchange
│  │     ├─ confirm/route.ts          # email confirmation + password recovery
│  │     └─ signout/route.ts
│  ├─ studio/[[...tool]]/
│  │  ├─ layout.tsx                   # studio root layout (no site CSS)
│  │  └─ page.tsx
│  └─ api/revalidate/route.ts         # Sanity webhook
├─ components/
│  ├─ Header.tsx
│  ├─ Intro.tsx
│  ├─ RichText.tsx
│  ├─ ResourceSection.tsx
│  ├─ ResourceCard.tsx
│  ├─ CardCover.tsx
│  ├─ FileTypeBadge.tsx
│  ├─ VideoCard.tsx                   # client: opens <dialog> player
│  └─ NoAccess.tsx
├─ lib/
│  ├─ env.ts
│  ├─ access.ts                       # pure decision + server resolver
│  ├─ slug.ts                         # slugify + reserved list (shared w/ Studio)
│  ├─ safe-redirect.ts
│  ├─ format.ts                       # "Added on … at …"
│  ├─ sanity/
│  │  ├─ client.ts
│  │  ├─ fetch.ts
│  │  ├─ queries.ts
│  │  ├─ image.ts
│  │  └─ types.ts                     # or generated by `sanity typegen`
│  └─ supabase/
│     ├─ server.ts
│     ├─ client.ts
│     └─ proxy.ts
├─ sanity/
│  ├─ env.ts
│  ├─ schemaTypes/
│  │  ├─ index.ts
│  │  ├─ blockContent.ts
│  │  ├─ artist.ts
│  │  ├─ resource.ts
│  │  ├─ section.ts
│  │  └─ website.ts
│  ├─ structure.ts
│  ├─ actions/
│  │  ├─ lockSlugOnPublish.ts
│  │  ├─ changeUrl.ts
│  │  └─ openSite.ts
│  └─ components/PdfPreviewInput.tsx
├─ scripts/seed.ts                    # creates website singleton + 3 sections
├─ public/vydia-logo.svg              # copy of docs/logo/gamma-vydia-white.svg
├─ proxy.ts
├─ sanity.config.ts
├─ sanity.cli.ts
├─ next.config.ts
└─ tests/
   ├─ access.test.ts
   ├─ slug.test.ts
   └─ e2e/access.spec.ts
```

---

## 4. Environment and Accounts

### 4.1 Environment variables

```bash
# .env.local  (mirror in Vercel → Project → Settings → Environment Variables)
NEXT_PUBLIC_SITE_URL=http://localhost:3000            # https://welcometovydia.com in prod

NEXT_PUBLIC_SANITY_PROJECT_ID=xxxxxxxx
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_READ_TOKEN=sk...                           # Viewer token, server only
SANITY_REVALIDATE_SECRET=long-random-string           # shared with the webhook

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Comma-separated, always allowed on every artist page (D6)
PERMANENT_VIEWER_EMAILS=labelrelationships@vydia.com,creativeservices@vydia.com
```

```ts
// lib/env.ts
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

export const SITE_URL = required('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL)
export const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
export const SUPABASE_KEY = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)
```

```ts
// sanity/env.ts  (imported by both Studio and server code, so no secrets here)
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
export const apiVersion = '2025-02-19'
```

### 4.2 Sanity project setup (sanity.io/manage)

1. Create the project and the `production` dataset, then set **dataset visibility to Private** (D2).
2. **API → Tokens**: create a *Viewer* token and store it as `SANITY_API_READ_TOKEN`.
3. **API → CORS origins**: add `http://localhost:3000` and `https://welcometovydia.com` with *Allow credentials* (needed by the embedded Studio).
4. **Members**: invite `labelrelationships@vydia.com` and `creativeservices@vydia.com` with the **Editor** role, not Administrator, so the shared logins can't change tokens, CORS, or webhooks.
5. **API → Webhooks**: see §9.

> ⚠️ Sanity asset URLs (`cdn.sanity.io/files/...`) are **publicly reachable even when the dataset is private**. They're unguessable content hashes, so anyone who has a URL can open the file, but nobody can enumerate them. For the prototype this is acceptable because the resources are client-facing collateral. If L&A ever uploads something sensitive, add an authenticated `/api/files/[id]` proxy (see §15).

### 4.3 Supabase project setup

| Setting | Value |
|---|---|
| Auth → Providers → Email | Enabled, **Confirm email = ON** |
| Auth → Providers → Google | Enabled. Create an OAuth client in Google Cloud with redirect URI `https://<project>.supabase.co/auth/v1/callback` |
| Auth → URL Configuration → Site URL | `https://welcometovydia.com` |
| Auth → URL Configuration → Redirect URLs | `http://localhost:3000/**`, `https://welcometovydia.com/**`, Vercel preview pattern |
| Auth → Sessions | Time-box user sessions: **never**. Inactivity timeout: **never** (D11) |
| Auth → SMTP | **Custom SMTP** (Resend, SendGrid, or Vydia's provider). The built-in sender is heavily rate-limited and will drop confirmation emails in production. |
| Auth → Email templates → Confirm signup | Link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}` |
| Auth → Email templates → Reset password | Link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .SiteURL }}/account/update-password` |

---

## 5. Sanity Content Model

### 5.1 Shared slug helpers (used by Studio and the site)

```ts
// lib/slug.ts
export const RESERVED_SLUGS = new Set([
  'studio', 'login', 'logout', 'auth', 'api', 'account', 'admin',
  '_next', 'static', 'favicon.ico', 'robots.txt', 'sitemap.xml',
])

/** "Beyoncé & The Band!" -> "beyonce-and-the-band" */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')            // "Guns N' Roses" -> "guns-n-roses"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

### 5.2 Rich text (`blockContent`)

```ts
// sanity/schemaTypes/blockContent.ts
import {defineArrayMember, defineType} from 'sanity'

export const blockContent = defineType({
  name: 'blockContent',
  title: 'Rich text',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Normal', value: 'normal'},
        {title: 'Heading', value: 'h3'},
      ],
      lists: [
        {title: 'Bullets', value: 'bullet'},
        {title: 'Numbered', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Bold', value: 'strong'},
          {title: 'Italic', value: 'em'},
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'Link',
            fields: [{name: 'href', type: 'url', validation: (r) => r.required().uri({scheme: ['http', 'https', 'mailto']})}],
          },
        ],
      },
    }),
  ],
})
```

### 5.3 `resource`

```ts
// sanity/schemaTypes/resource.ts
import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons'
import {apiVersion} from '../env'
import {PdfPreviewInput} from '../components/PdfPreviewInput'

export const RESOURCE_TYPES = [
  {title: 'PDF', value: 'pdf'},
  {title: 'Video', value: 'video'},
  {title: 'Link (pitch forms, external pages)', value: 'link'},
  {title: 'Slide deck', value: 'slides'},
] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]['value']

const MIME_RULES: Record<ResourceType, (mime: string) => boolean> = {
  pdf: (m) => m === 'application/pdf',
  video: (m) => m.startsWith('video/'),
  slides: (m) =>
    m === 'application/pdf' ||
    m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    m === 'application/vnd.ms-powerpoint' ||
    m === 'application/vnd.apple.keynote',
  link: () => false,
}

export const resource = defineType({
  name: 'resource',
  title: 'Resource',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (r) => r.required().max(120),
    }),
    defineField({
      name: 'type',
      type: 'string',
      options: {list: [...RESOURCE_TYPES], layout: 'radio'},
      initialValue: 'pdf',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'file',
      type: 'file',
      description: 'Upload the PDF, video, or slide deck.',
      hidden: ({document}) => document?.type === 'link',
      validation: (r) =>
        r.custom(async (file, ctx) => {
          const type = ctx.document?.type as ResourceType | undefined
          const ref = (file as {asset?: {_ref?: string}} | undefined)?.asset?._ref
          if (!type || type === 'link' || !ref) return true
          const mime = await ctx
            .getClient({apiVersion})
            .fetch<string | null>('*[_id == $ref][0].mimeType', {ref})
          return mime && MIME_RULES[type](mime)
            ? true
            : `This file (${mime ?? 'unknown type'}) doesn't match the "${type}" resource type.`
        }),
    }),
    defineField({
      name: 'url',
      title: 'Link URL',
      type: 'url',
      description: 'For links and pitch forms. Slide decks and videos can use a link (Google Slides, YouTube, Vimeo) instead of an upload.',
      hidden: ({document}) => document?.type === 'pdf',
      validation: (r) => r.uri({scheme: ['https', 'http']}),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover photo (optional)',
      type: 'image',
      options: {hotspot: true},
      description: 'Shown on the card. If empty, PDFs use their first page and everything else uses a branded Vydia tile.',
      fields: [defineField({name: 'alt', type: 'string', title: 'Alt text'})],
    }),
    defineField({
      name: 'pdfPreview',
      title: 'PDF first-page preview',
      type: 'image',
      description: 'Generated automatically when you upload a PDF. Only used when there is no cover photo.',
      hidden: ({document}) => document?.type !== 'pdf',
      components: {input: PdfPreviewInput},
    }),
    defineField({
      name: 'addedOn',
      title: 'Added on',
      type: 'datetime',
      description:
        'Shown on the card as "Added on …". Defaults to when this resource was created. Editing the resource later does NOT change it. When migrating from Seismic, set this to the original date.',
      initialValue: () => new Date().toISOString(),
      validation: (r) => r.required(),
    }),
  ],
  validation: (r) =>
    r.custom((doc) => {
      const d = doc as {type?: ResourceType; file?: {asset?: unknown}; url?: string} | undefined
      if (!d?.type) return true
      const hasFile = Boolean(d.file?.asset)
      const hasUrl = Boolean(d.url)
      if (d.type === 'pdf' && !hasFile) return 'Upload a PDF.'
      if (d.type === 'link' && !hasUrl) return 'Add a link URL.'
      if ((d.type === 'video' || d.type === 'slides') && !hasFile && !hasUrl)
        return 'Upload a file or add a link.'
      if (hasFile && hasUrl && d.type !== 'link') return 'Use either an upload or a link, not both.'
      return true
    }),
  orderings: [
    {title: 'Newest first', name: 'addedOnDesc', by: [{field: 'addedOn', direction: 'desc'}]},
    {title: 'Title', name: 'titleAsc', by: [{field: 'title', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'title', type: 'type', addedOn: 'addedOn', cover: 'coverImage', pdf: 'pdfPreview'},
    prepare: ({title, type, addedOn, cover, pdf}) => ({
      title,
      subtitle: [RESOURCE_TYPES.find((t) => t.value === type)?.title, addedOn?.slice(0, 10)]
        .filter(Boolean)
        .join(' · '),
      media: cover ?? pdf,
    }),
  },
})
```

### 5.4 `section`

```ts
// sanity/schemaTypes/section.ts
import {defineArrayMember, defineField, defineType} from 'sanity'
import {ThListIcon} from '@sanity/icons'

export const section = defineType({
  name: 'section',
  title: 'Section',
  type: 'document',
  icon: ThListIcon,
  fields: [
    defineField({name: 'title', type: 'string', validation: (r) => r.required().max(80)}),
    defineField({name: 'subtitle', title: 'Subtitle (optional)', type: 'text', rows: 2}),
    defineField({
      name: 'resources',
      type: 'array',
      description: 'Drag to reorder. Cards appear on the site in this order.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'resource'}]})],
      validation: (r) => r.unique(),
    }),
  ],
  preview: {
    select: {title: 'title', resources: 'resources'},
    prepare: ({title, resources}) => ({
      title,
      subtitle: `${resources?.length ?? 0} resource${resources?.length === 1 ? '' : 's'}`,
    }),
  },
})
```

### 5.5 `website` (singleton, `_id: "website"`)

```ts
// sanity/schemaTypes/website.ts
import {defineArrayMember, defineField, defineType} from 'sanity'
import {HomeIcon} from '@sanity/icons'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const website = defineType({
  name: 'website',
  title: 'Website (global layout)',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'intro',
      title: 'Intro text',
      type: 'blockContent',
      description: 'Shown on every artist page unless the artist has an intro override.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'sections',
      type: 'array',
      description: 'Default sections, in display order. Artists with a section override show their own sections instead.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'section'}]})],
      validation: (r) => r.required().min(1).unique(),
    }),
    defineField({
      name: 'internalViewerEmails',
      title: 'Internal viewers',
      type: 'array',
      description:
        'Vydia emails that can view EVERY artist page. labelrelationships@ and creativeservices@ always have access and don’t need to be listed.',
      of: [
        defineArrayMember({
          type: 'string',
          validation: (r) =>
            r.custom((v) =>
              !v || (EMAIL.test(v) && v.toLowerCase().endsWith('@vydia.com'))
                ? true
                : 'Must be a valid @vydia.com email',
            ),
        }),
      ],
      validation: (r) => r.unique(),
    }),
  ],
  preview: {prepare: () => ({title: 'Website (global layout)'})},
})
```

### 5.6 `artist`

```ts
// sanity/schemaTypes/artist.ts
import {defineArrayMember, defineField, defineType, type SlugValidationContext} from 'sanity'
import {UserIcon} from '@sanity/icons'
import {apiVersion} from '../env'
import {RESERVED_SLUGS, SLUG_PATTERN, slugify} from '../../lib/slug'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function isSlugAvailable(slug: string, ctx: SlugValidationContext) {
  const id = ctx.document?._id.replace(/^drafts\./, '')
  return ctx.getClient({apiVersion}).fetch<boolean>(
    `!defined(*[
      _type == "artist" &&
      !(_id in [$draft, $published]) &&
      (slug.current == $slug || $slug in previousSlugs)
    ][0]._id)`,
    {draft: `drafts.${id}`, published: id, slug},
  )
}

export const artist = defineType({
  name: 'artist',
  title: 'Artist',
  type: 'document',
  icon: UserIcon,
  groups: [
    {name: 'basics', title: 'Basics', default: true},
    {name: 'access', title: 'Access'},
    {name: 'content', title: 'Page content'},
    {name: 'advanced', title: 'Advanced'},
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Artist name',
      type: 'string',
      group: 'basics',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      group: 'basics',
      description:
        'welcometovydia.com/<this>. Click "Generate" after typing the name. Locked after the first publish because clients bookmark this link. Use "Change URL…" in the publish menu if you really need to change it.',
      options: {source: 'name', slugify, isUnique: isSlugAvailable},
      readOnly: ({document}) => Boolean(document?.slugLocked),
      validation: (r) =>
        r.required().custom((value) => {
          const s = value?.current
          if (!s) return true
          if (!SLUG_PATTERN.test(s)) return 'Only lowercase letters, numbers, and single dashes.'
          if (RESERVED_SLUGS.has(s)) return `"${s}" is reserved. Pick another URL.`
          return true
        }),
    }),
    defineField({name: 'slugLocked', type: 'boolean', hidden: true, initialValue: false}),
    defineField({
      name: 'allowedEmails',
      title: 'Allowed emails',
      type: 'array',
      group: 'access',
      description:
        'People who can view this page. Matching ignores upper/lower case. labelrelationships@vydia.com, creativeservices@vydia.com, and internal viewers (Website settings) always have access.',
      of: [
        defineArrayMember({
          type: 'string',
          validation: (r) => r.custom((v) => (!v || EMAIL.test(v.trim()) ? true : 'Not a valid email')),
        }),
      ],
      validation: (r) =>
        r.custom((list) => {
          const lower = ((list as string[] | undefined) ?? []).map((e) => e.trim().toLowerCase())
          return new Set(lower).size === lower.length ? true : 'Duplicate email (case-insensitive)'
        }),
    }),
    defineField({
      name: 'introOverride',
      title: 'Intro override (optional)',
      type: 'blockContent',
      group: 'content',
      description: 'Leave empty to use the global intro from Website settings.',
    }),
    defineField({
      name: 'additionalInfo',
      title: 'Additional info (optional)',
      type: 'blockContent',
      group: 'content',
      description: 'Shown directly below the intro, only on this artist’s page.',
    }),
    defineField({
      name: 'sectionOverride',
      title: 'Section override (optional)',
      type: 'array',
      group: 'content',
      description:
        'If you add ANY sections here, they REPLACE the global sections on this artist’s page (not added to them). Leave empty to use the global sections.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'section'}]})],
      validation: (r) => r.unique(),
    }),
    defineField({
      name: 'customization',
      type: 'object',
      group: 'content',
      hidden: true, // post-prototype: profile picture, background image, etc.
      fields: [defineField({name: 'placeholder', type: 'string'})],
    }),
    defineField({
      name: 'previousSlugs',
      title: 'Previous URLs',
      type: 'array',
      group: 'advanced',
      readOnly: true,
      description: 'Old URLs that redirect to the current one. Managed by "Change URL…".',
      of: [defineArrayMember({type: 'string'})],
    }),
  ],
  preview: {
    select: {title: 'name', slug: 'slug.current', emails: 'allowedEmails'},
    prepare: ({title, slug, emails}) => ({
      title,
      subtitle: `/${slug ?? '(no URL yet)'} · ${emails?.length ?? 0} allowed email(s)`,
    }),
  },
})
```

```ts
// sanity/schemaTypes/index.ts
import {artist} from './artist'
import {blockContent} from './blockContent'
import {resource} from './resource'
import {section} from './section'
import {website} from './website'

export const schemaTypes = [website, artist, section, resource, blockContent]
```

### 5.7 How the model maps to the page

```
website (singleton)
 ├─ intro ─────────────────────────────┐  overridden by artist.introOverride (if non-empty)
 ├─ sections[] → section ──────────────┤  REPLACED by artist.sectionOverride[] (if non-empty)
 │                ├─ title, subtitle   │
 │                └─ resources[] → resource {title, type, file|url, coverImage, pdfPreview, addedOn}
 └─ internalViewerEmails[]             │
                                       ▼
artist ── slug ──► /[slug]: Header → Intro → additionalInfo → Sections → Cards
```

---

## 6. Sanity Studio (editor experience)

The whole design goal here is that L&A can run it without a developer: a clear sidebar, plain-language field descriptions, and guardrails against the mistakes that would break bookmarks or hide content.

### 6.1 Desk structure

```ts
// sanity/structure.ts
import type {StructureResolver} from 'sanity/structure'
import {DocumentsIcon, HomeIcon, WarningOutlineIcon} from '@sanity/icons'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Welcome to Vydia')
    .items([
      S.listItem()
        .title('Website (global layout)')
        .id('website')
        .icon(HomeIcon)
        .child(S.document().schemaType('website').documentId('website').title('Website (global layout)')),
      S.divider(),
      S.documentTypeListItem('artist').title('Artists'),
      S.documentTypeListItem('section').title('Sections'),
      S.listItem()
        .title('Resources')
        .icon(DocumentsIcon)
        .child(
          S.list()
            .title('Resources')
            .items([
              S.listItem().title('All resources').child(S.documentTypeList('resource').title('All resources')),
              S.listItem()
                .title('Not in any section')
                .icon(WarningOutlineIcon)
                .child(
                  S.documentList()
                    .title('Not in any section (not visible on any page)')
                    .schemaType('resource')
                    .filter('_type == "resource" && count(*[_type == "section" && references(^._id)]) == 0'),
                ),
            ]),
        ),
    ])
```

The "Not in any section" list makes the research's three-layer rule visible: *a resource not assigned to a section will not be visible on any page*.

### 6.2 Document actions

**Lock the slug on first publish** (D5). This patches the draft, then runs the normal publish:

```ts
// sanity/actions/lockSlugOnPublish.ts
import {useDocumentOperation, type DocumentActionComponent} from 'sanity'

export function lockSlugOnPublish(original: DocumentActionComponent): DocumentActionComponent {
  const Action: DocumentActionComponent = (props) => {
    const {patch} = useDocumentOperation(props.id, props.type)
    const result = original(props)
    if (!result) return null
    return {
      ...result,
      onHandle: () => {
        const draft = props.draft as {slugLocked?: boolean} | null
        if (draft && !draft.slugLocked) patch.execute([{set: {slugLocked: true}}])
        result.onHandle?.()
      },
    }
  }
  Action.action = original.action
  return Action
}
```

**Change URL…** unlocks the slug and saves the current one as a redirect:

```ts
// sanity/actions/changeUrl.ts
import {useState} from 'react'
import {useDocumentOperation, type DocumentActionComponent} from 'sanity'

type ArtistDoc = {slug?: {current?: string}; slugLocked?: boolean; previousSlugs?: string[]}

export const changeUrlAction: DocumentActionComponent = (props) => {
  const {patch} = useDocumentOperation(props.id, props.type)
  const [open, setOpen] = useState(false)
  const doc = (props.draft ?? props.published) as ArtistDoc | null
  const current = doc?.slug?.current
  if (!doc?.slugLocked || !current) return null

  return {
    label: 'Change URL…',
    tone: 'caution',
    onHandle: () => setOpen(true),
    dialog: open && {
      type: 'confirm',
      message: `Clients may have bookmarked /${current}. It will keep working as a redirect to the new URL. After confirming, edit the URL field and publish.`,
      onCancel: () => setOpen(false),
      onConfirm: () => {
        patch.execute([
          {setIfMissing: {previousSlugs: []}},
          {insert: {after: 'previousSlugs[-1]', items: [current]}},
          {set: {slugLocked: false}},
        ])
        setOpen(false)
        props.onComplete()
      },
    },
  }
}
```

**Open site** covers Flow 1, step 7 ("the site is live"):

```ts
// sanity/actions/openSite.ts
import type {DocumentActionComponent} from 'sanity'
import {LaunchIcon} from '@sanity/icons'

export const openSiteAction: DocumentActionComponent = (props) => {
  const slug = (props.published as {slug?: {current?: string}} | null)?.slug?.current
  if (!slug) return null
  return {
    label: 'Open site',
    icon: LaunchIcon,
    onHandle: () => window.open(`${process.env.NEXT_PUBLIC_SITE_URL}/${slug}`, '_blank', 'noopener'),
  }
}
```

### 6.3 PDF first-page preview input (D8)

```tsx
// sanity/components/PdfPreviewInput.tsx
import {useCallback, useEffect, useRef, useState} from 'react'
import {set, useClient, useFormValue, type ObjectInputProps} from 'sanity'
import {Button, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {apiVersion} from '../env'

async function renderFirstPage(url: string): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const pdf = await pdfjs.getDocument({url}).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({scale: 1.5})
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({canvas, canvasContext: canvas.getContext('2d')!, viewport}).promise
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85),
  )
}

export function PdfPreviewInput(props: ObjectInputProps) {
  const {onChange, value, renderDefault} = props
  const client = useClient({apiVersion})
  const fileRef = useFormValue(['file', 'asset', '_ref']) as string | undefined
  const type = useFormValue(['type']) as string | undefined
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const seenRef = useRef(fileRef)

  const generate = useCallback(async () => {
    if (!fileRef) return
    setStatus('working')
    try {
      const url = await client.fetch<string>('*[_id == $id][0].url', {id: fileRef})
      const blob = await renderFirstPage(url)
      const asset = await client.assets.upload('image', blob, {filename: 'pdf-preview.jpg'})
      onChange(set({_type: 'image', asset: {_type: 'reference', _ref: asset._id}}))
      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }, [client, fileRef, onChange])

  // Auto-generate when a PDF is present but has no preview, or when the PDF is replaced.
  useEffect(() => {
    if (type !== 'pdf' || !fileRef) return
    const replaced = seenRef.current !== fileRef
    if (replaced || !value?.asset) {
      seenRef.current = fileRef
      void generate()
    }
  }, [type, fileRef]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack space={3}>
      {renderDefault(props)}
      <Flex gap={3} align="center">
        <Button
          text={value?.asset ? 'Regenerate from PDF' : 'Generate from PDF'}
          mode="ghost"
          disabled={!fileRef || status === 'working'}
          onClick={generate}
        />
        {status === 'working' && <Spinner muted />}
        {status === 'error' && (
          <Text size={1} muted>
            Couldn’t render the PDF. The card will use the branded tile instead.
          </Text>
        )}
      </Flex>
    </Stack>
  )
}
```

> Note: `pdfjs-dist` v5 accepts `canvas` in `render()`; older versions only take `canvasContext`. Passing both works on either. Loading the worker from unpkg avoids bundler worker-URL problems inside the embedded Studio. If Vydia prefers no third-party CDN, copy the worker into `public/` and point `workerSrc` at `/pdf.worker.min.mjs`.

### 6.4 Studio config

```ts
// sanity.config.ts
'use client'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {apiVersion, dataset, projectId} from './sanity/env'
import {schemaTypes} from './sanity/schemaTypes'
import {structure} from './sanity/structure'
import {lockSlugOnPublish} from './sanity/actions/lockSlugOnPublish'
import {changeUrlAction} from './sanity/actions/changeUrl'
import {openSiteAction} from './sanity/actions/openSite'

const SINGLETONS = new Set(['website'])
const SINGLETON_ACTIONS = new Set(['publish', 'discardChanges', 'restore'])

export default defineConfig({
  name: 'default',
  title: 'Welcome to Vydia',
  basePath: '/studio',
  projectId,
  dataset,
  plugins: [
    structureTool({structure}),
    ...(process.env.NODE_ENV === 'development' ? [visionTool({defaultApiVersion: apiVersion})] : []),
  ],
  schema: {
    types: schemaTypes,
    // No "New Website" button: there's exactly one.
    templates: (templates) => templates.filter(({schemaType}) => !SINGLETONS.has(schemaType)),
  },
  document: {
    actions: (prev, {schemaType}) => {
      if (SINGLETONS.has(schemaType)) return prev.filter(({action}) => action && SINGLETON_ACTIONS.has(action))
      if (schemaType === 'artist') {
        return [
          ...prev.map((a) => (a.action === 'publish' ? lockSlugOnPublish(a) : a)),
          changeUrlAction,
          openSiteAction,
        ]
      }
      return prev
    },
    newDocumentOptions: (prev, {creationContext}) =>
      creationContext.type === 'global' ? prev.filter((t) => !SINGLETONS.has(t.templateId)) : prev,
  },
})
```

```ts
// sanity.cli.ts
import {defineCliConfig} from 'sanity/cli'
export default defineCliConfig({
  api: {projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET},
  typegen: {path: './{app,components,lib}/**/*.{ts,tsx}', generates: './lib/sanity/types.generated.ts'},
})
```

```tsx
// app/studio/[[...tool]]/page.tsx
import {NextStudio} from 'next-sanity/studio'
import config from '../../../sanity.config'

export const dynamic = 'force-static'
export {metadata, viewport} from 'next-sanity/studio'

export default function StudioPage() {
  return <NextStudio config={config} />
}
```

```tsx
// app/studio/[[...tool]]/layout.tsx   (separate root layout: no site CSS or fonts)
export default function StudioLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body style={{margin: 0}}>{children}</body>
    </html>
  )
}
```

> Strong references give us a free guardrail: Sanity won't let an editor delete a resource that a section still uses (it shows "referenced by…"). Same for sections used by `website` or an artist.

---

## 7. Data Layer (server)

### 7.1 Client and cached fetch

```ts
// lib/sanity/client.ts
import 'server-only'
import {createClient} from 'next-sanity'
import {apiVersion, dataset, projectId} from '@/sanity/env'

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,               // Next's data cache is our cache; avoid CDN lag after publish
  perspective: 'published',    // never serve drafts
  token: process.env.SANITY_API_READ_TOKEN, // private dataset
})
```

```ts
// lib/sanity/fetch.ts
import 'server-only'
import type {QueryParams} from 'next-sanity'
import {sanity} from './client'

export type SanityTag = 'artist' | 'resource' | 'section' | 'website'

export function sanityFetch<T>(query: string, params: QueryParams, tags: SanityTag[]) {
  return sanity.fetch<T>(query, params, {cache: 'force-cache', next: {tags}})
}
```

### 7.2 Queries

```ts
// lib/sanity/queries.ts
import {defineQuery} from 'next-sanity'

/**
 * ACCESS LOOKUP. Must have the same shape and cost for unknown and known slugs.
 * Always fetches both the artist (possibly null) and the internal viewer list.
 */
export const ACCESS_QUERY = defineQuery(`{
  "artist": *[_type == "artist" && (slug.current == $slug || $slug in previousSlugs)][0]{
    _id,
    "slug": slug.current,
    allowedEmails
  },
  "internalViewers": *[_id == "website"][0].internalViewerEmails
}`)

const RESOURCE_PROJECTION = `{
  _id,
  title,
  type,
  url,
  "addedOn": coalesce(addedOn, _createdAt),
  "fileUrl": file.asset->url,
  "fileName": file.asset->originalFilename,
  "cover": coalesce(coverImage, pdfPreview){
    alt,
    hotspot,
    crop,
    asset->{_id, url, metadata{lqip, dimensions}}
  }
}`

const SECTION_PROJECTION = `{
  _id,
  title,
  subtitle,
  "resources": resources[]->${RESOURCE_PROJECTION}
}`

/** PAGE CONTENT. Only run after access is granted. */
export const ARTIST_PAGE_QUERY = defineQuery(`{
  "website": *[_id == "website"][0]{
    intro,
    "sections": sections[]->${SECTION_PROJECTION}
  },
  "artist": *[_type == "artist" && _id == $artistId][0]{
    name,
    introOverride,
    additionalInfo,
    "sectionOverride": sectionOverride[]->${SECTION_PROJECTION}
  }
}`)
```

### 7.3 Types

Generate them with `npx sanity typegen generate` (it reads the `defineQuery` calls). Until then, the hand-written equivalent is:

```ts
// lib/sanity/types.ts
import type {PortableTextBlock} from '@portabletext/react'
import type {ResourceType} from '@/sanity/schemaTypes/resource'

export type CardImage = {
  alt?: string
  hotspot?: unknown
  crop?: unknown
  asset: {_id: string; url: string; metadata?: {lqip?: string; dimensions?: {width: number; height: number}}}
} | null

export type ResourceCardData = {
  _id: string
  title: string
  type: ResourceType
  url?: string | null
  addedOn: string
  fileUrl?: string | null
  fileName?: string | null
  cover: CardImage
}

export type SectionData = {_id: string; title: string; subtitle?: string | null; resources: (ResourceCardData | null)[] | null}

export type ArtistPageData = {
  website: {intro: PortableTextBlock[]; sections: (SectionData | null)[] | null} | null
  artist: {
    name: string
    introOverride?: PortableTextBlock[] | null
    additionalInfo?: PortableTextBlock[] | null
    sectionOverride?: (SectionData | null)[] | null
  } | null
}
```

### 7.4 Resolving the rendered page (override rules)

```ts
// lib/sanity/page.ts
import 'server-only'
import {sanityFetch} from './fetch'
import {ARTIST_PAGE_QUERY} from './queries'
import type {ArtistPageData, ResourceCardData, SectionData} from './types'

const nonEmpty = <T,>(arr: T[] | null | undefined): arr is T[] => Array.isArray(arr) && arr.length > 0

export async function getArtistPage(artistId: string) {
  const data = await sanityFetch<ArtistPageData>(
    ARTIST_PAGE_QUERY,
    {artistId},
    ['website', 'section', 'resource', 'artist'],
  )
  const {website, artist} = data

  // Rendering sequence step 2: artist intro override, else global intro
  const intro = nonEmpty(artist?.introOverride) ? artist!.introOverride! : website?.intro ?? []

  // Step 4: section override REPLACES global sections (never appends)
  const rawSections = nonEmpty(artist?.sectionOverride) ? artist!.sectionOverride! : website?.sections ?? []

  // Drop dangling refs (unpublished/deleted sections or resources)
  const sections = rawSections
    .filter((s): s is SectionData => Boolean(s))
    .map((s) => ({...s, resources: (s.resources ?? []).filter((r): r is ResourceCardData => Boolean(r))}))

  return {
    artistName: artist?.name ?? '',
    intro,
    additionalInfo: nonEmpty(artist?.additionalInfo) ? artist!.additionalInfo! : null,
    sections,
  }
}
```

### 7.5 Images

```ts
// lib/sanity/image.ts
import {createImageUrlBuilder} from '@sanity/image-url'
import {dataset, projectId} from '@/sanity/env'

const builder = createImageUrlBuilder({projectId, dataset})
export const urlFor = (source: Parameters<typeof builder.image>[0]) => builder.image(source).auto('format')
```

```ts
// next.config.ts
import type {NextConfig} from 'next'

const config: NextConfig = {
  images: {remotePatterns: [{protocol: 'https', hostname: 'cdn.sanity.io'}]},
}
export default config
```

---

## 8. Authentication (Supabase)

### 8.1 Clients

```ts
// lib/supabase/server.ts
import 'server-only'
import {createServerClient} from '@supabase/ssr'
import {cookies} from 'next/headers'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({name, value, options}) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component: the proxy handles refresh, safe to ignore.
        }
      },
    },
  })
}
```

```ts
// lib/supabase/client.ts
import {createBrowserClient} from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
```

### 8.2 Proxy: refresh the session and gate everything (D3, D11)

```ts
// lib/supabase/proxy.ts
import {createServerClient} from '@supabase/ssr'
import {NextResponse, type NextRequest} from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/auth']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({request})

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({name, value}) => request.cookies.set(name, value))
          response = NextResponse.next({request})
          toSet.forEach(({name, value, options}) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // Do not put code between createServerClient and getClaims (session refresh happens here).
  const {data} = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))

  if (!signedIn && !isPublic) {
    // Same redirect for EVERY path: existing artist, missing artist, "/", anything.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', path)
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return response
}
```

```ts
// proxy.ts
import type {NextRequest} from 'next/server'
import {updateSession} from '@/lib/supabase/proxy'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Everything except Next internals, static files, Studio, and the webhook.
    '/((?!_next/static|_next/image|favicon.ico|studio|api/revalidate|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
```

### 8.3 Safe `next` redirects (no open redirect)

```ts
// lib/safe-redirect.ts
import {SITE_URL} from './env'

/** Accepts "/foo" or "https://welcometovydia.com/foo"; anything else → "/". */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/'
  try {
    const url = new URL(raw, SITE_URL)
    if (url.origin !== new URL(SITE_URL).origin) return '/'
    if (url.pathname.startsWith('//')) return '/'
    return `${url.pathname}${url.search}`
  } catch {
    return '/'
  }
}
```

### 8.4 Login page

```ts
// app/(site)/login/actions.ts
'use server'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {safeNext} from '@/lib/safe-redirect'
import {SITE_URL} from '@/lib/env'

export type AuthState = {error?: string; message?: string}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const {error} = await supabase.auth.signInWithPassword({
    email: String(form.get('email')).trim(),
    password: String(form.get('password')),
  })
  if (error) return {error: 'Invalid email or password, or your email isn’t confirmed yet.'}
  redirect(safeNext(form.get('next') as string))
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const next = safeNext(form.get('next') as string)
  const {error} = await supabase.auth.signUp({
    email: String(form.get('email')).trim(),
    password: String(form.get('password')),
    options: {emailRedirectTo: `${SITE_URL}${next}`},
  })
  if (error) return {error: error.message}
  // Same message whether or not the email already has an account (no account enumeration).
  return {message: 'Check your inbox for a confirmation link to finish signing up.'}
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(String(form.get('email')).trim(), {
    redirectTo: `${SITE_URL}/account/update-password`,
  })
  return {message: 'If that email has an account, a reset link is on its way.'}
}
```

```tsx
// app/(site)/login/LoginForm.tsx
'use client'
import {useActionState, useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {requestPasswordReset, signIn, signUp, type AuthState} from './actions'

type Mode = 'signin' | 'signup' | 'reset'

export function LoginForm({next}: {next: string}) {
  const [mode, setMode] = useState<Mode>('signin')
  const action = mode === 'signin' ? signIn : mode === 'signup' ? signUp : requestPasswordReset
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {})

  async function google() {
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`},
    })
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your login' : 'Reset password'}
      </h1>

      {mode !== 'reset' && (
        <>
          <button onClick={google} className="w-full rounded-md border px-4 py-2 font-medium hover:bg-neutral-50">
            Continue with Google
          </button>
          <div className="my-4 text-center text-sm text-neutral-500">or</div>
        </>
      )}

      <form action={formAction} className="space-y-3" key={mode}>
        <input type="hidden" name="next" value={next} />
        <input name="email" type="email" required autoComplete="email" placeholder="Email"
               className="w-full rounded-md border px-3 py-2" />
        {mode !== 'reset' && (
          <input name="password" type="password" required minLength={8}
                 autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                 placeholder="Password" className="w-full rounded-md border px-3 py-2" />
        )}
        <button disabled={pending} className="w-full rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50">
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
        </button>
      </form>

      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.message && <p role="status" className="mt-3 text-sm text-green-700">{state.message}</p>}

      <div className="mt-4 flex justify-between text-sm text-neutral-600">
        {mode === 'signin' ? (
          <>
            <button onClick={() => setMode('signup')}>First time? Sign up</button>
            <button onClick={() => setMode('reset')}>Forgot password?</button>
          </>
        ) : (
          <button onClick={() => setMode('signin')}>Back to sign in</button>
        )}
      </div>
    </div>
  )
}
```

```tsx
// app/(site)/login/page.tsx
import {Header} from '@/components/Header'
import {safeNext} from '@/lib/safe-redirect'
import {LoginForm} from './LoginForm'

export default async function LoginPage({searchParams}: {searchParams: Promise<{next?: string; error?: string}>}) {
  const {next, error} = await searchParams
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-6">
      <Header />
      {error && <p role="alert" className="text-center text-sm text-red-600">That link is invalid or expired. Please try again.</p>}
      <LoginForm next={safeNext(next)} />
    </main>
  )
}
```

### 8.5 Auth route handlers

```ts
// app/(site)/auth/callback/route.ts   (Google OAuth, PKCE)
import {NextResponse, type NextRequest} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {safeNext} from '@/lib/safe-redirect'

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  if (code) {
    const supabase = await createClient()
    const {error} = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
```

```ts
// app/(site)/auth/confirm/route.ts   (email confirmation + password recovery)
import type {EmailOtpType} from '@supabase/supabase-js'
import {redirect} from 'next/navigation'
import type {NextRequest} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {safeNext} from '@/lib/safe-redirect'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const tokenHash = sp.get('token_hash')
  const type = sp.get('type') as EmailOtpType | null
  const next = safeNext(sp.get('redirect_to') ?? sp.get('next'))

  if (tokenHash && type) {
    const supabase = await createClient()
    const {error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash})
    if (!error) redirect(next)
  }
  redirect('/login?error=confirm')
}
```

```ts
// app/(site)/auth/signout/route.ts
import {NextResponse, type NextRequest} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), {status: 303})
}
```

`/account/update-password` is a small client form that calls `supabase.auth.updateUser({password})` and then redirects to `/`.

---

## 9. Access Control (the core security logic)

### 9.1 Pure decision function (unit-testable)

```ts
// lib/access.ts
import 'server-only'
import type {User} from '@supabase/supabase-js'
import {sanityFetch} from './sanity/fetch'
import {ACCESS_QUERY} from './sanity/queries'

export const normalizeEmail = (e: string) => e.trim().toLowerCase()

const PERMANENT_VIEWERS = new Set(
  (process.env.PERMANENT_VIEWER_EMAILS ?? 'labelrelationships@vydia.com,creativeservices@vydia.com')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean),
)

export type AccessLookup = {
  artist: {_id: string; slug: string; allowedEmails?: string[] | null} | null
  internalViewers?: string[] | null
}

export type AccessDecision =
  | {status: 'granted'; artistId: string}
  | {status: 'redirect'; canonicalSlug: string}
  | {status: 'denied'} // used for BOTH unknown artist and unapproved user

export function isInternalViewer(email: string, internalViewers: string[] | null | undefined) {
  const e = normalizeEmail(email)
  return PERMANENT_VIEWERS.has(e) || (internalViewers ?? []).some((v) => normalizeEmail(v) === e)
}

export function decideAccess(requestedSlug: string, email: string | null, lookup: AccessLookup): AccessDecision {
  const {artist} = lookup
  if (!email || !artist) return {status: 'denied'}

  const e = normalizeEmail(email)
  const allowed =
    isInternalViewer(e, lookup.internalViewers) ||
    (artist.allowedEmails ?? []).some((a) => normalizeEmail(a) === e)

  if (!allowed) return {status: 'denied'}
  // Redirect only AFTER access is confirmed, so old slugs don't leak existence.
  if (artist.slug !== requestedSlug) return {status: 'redirect', canonicalSlug: artist.slug}
  return {status: 'granted', artistId: artist._id}
}

/** A verified email from Supabase, or null. Email/password users need a confirmed email. */
export function verifiedEmail(user: User | null): string | null {
  if (!user?.email) return null
  if (!user.email_confirmed_at) return null // Google users are confirmed by the provider
  return user.email
}

export async function resolveArtistAccess(rawSlug: string, user: User | null): Promise<AccessDecision> {
  const slug = decodeURIComponent(rawSlug).toLowerCase()
  // Always run the SAME query, even if the user has no verified email, to keep timing uniform.
  const lookup = await sanityFetch<AccessLookup>(ACCESS_QUERY, {slug}, ['artist', 'website'])
  return decideAccess(slug, verifiedEmail(user), lookup)
}
```

### 9.2 The artist page

```tsx
// app/(site)/[slug]/page.tsx
import type {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {resolveArtistAccess} from '@/lib/access'
import {getArtistPage} from '@/lib/sanity/page'
import {Header} from '@/components/Header'
import {Intro} from '@/components/Intro'
import {RichText} from '@/components/RichText'
import {ResourceSection} from '@/components/ResourceSection'

// Static title: we never put the artist's name in metadata (it would leak on denial paths).
export const metadata: Metadata = {title: 'Welcome to Vydia', robots: {index: false, follow: false}}

export default async function ArtistPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params

  const supabase = await createClient()
  const {data: {user}} = await supabase.auth.getUser() // authoritative check against Supabase
  if (!user) redirect(`/login?next=/${encodeURIComponent(slug)}`)

  const access = await resolveArtistAccess(slug, user)
  if (access.status === 'denied') notFound()                 // unknown OR unapproved → identical
  if (access.status === 'redirect') redirect(`/${access.canonicalSlug}`) // D10: 307, not 308

  const page = await getArtistPage(access.artistId)

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-6 sm:px-6">
      <Header />
      <Intro value={page.intro} />
      {page.additionalInfo && (
        <section aria-label="Additional information" className="rounded-lg border border-neutral-200 bg-white p-5">
          <RichText value={page.additionalInfo} />
        </section>
      )}
      {page.sections.map((s) => (
        <ResourceSection key={s._id} section={s} />
      ))}
    </main>
  )
}
```

```tsx
// app/(site)/[slug]/not-found.tsx
import {NoAccess} from '@/components/NoAccess'
export default function NotFound() {
  return <NoAccess />
}
```

```tsx
// components/NoAccess.tsx   (ONE component for both cases. Never branch on the reason.)
import {Header} from './Header'

export function NoAccess() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-6">
      <Header />
      <div className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">This page isn’t available</h1>
        <p className="mt-2 text-neutral-600">
          This page doesn’t exist or your email doesn’t have access to it. If you think this is a mistake,
          contact your Vydia representative, or sign in with a different email.
        </p>
        <form action="/auth/signout" method="post" className="mt-4">
          <button className="rounded-md border px-4 py-2 font-medium hover:bg-neutral-50">
            Sign in with a different email
          </button>
        </form>
      </div>
    </main>
  )
}
```

### 9.3 Why unknown and denied are indistinguishable

| Signal | Unknown slug | Known slug, email not allowed |
|---|---|---|
| Before sign-in | Proxy → `302 /login?next=/x` | Proxy → `302 /login?next=/x` |
| After sign-in: status | `404` via `notFound()` | `404` via `notFound()` |
| After sign-in: body | `<NoAccess/>` | `<NoAccess/>` |
| After sign-in: `<title>` | Static "Welcome to Vydia" | Static "Welcome to Vydia" |
| Sanity work | 1 × `ACCESS_QUERY` (same shape, cached) | 1 × `ACCESS_QUERY` (same shape, cached) |
| Old-slug redirect | n/a | Only issued *after* access is granted |

Optional hardening: wrap the denied path in a constant minimum duration (for example `await Promise.all([work, sleep(150)])`) if timing measurements ever show a difference. With identical queries and a shared cache, that shouldn't be necessary.

### 9.4 Root `/`

```tsx
// app/(site)/page.tsx
import Link from 'next/link'
import {createClient} from '@/lib/supabase/server'
import {isInternalViewer, verifiedEmail} from '@/lib/access'
import {sanityFetch} from '@/lib/sanity/fetch'
import {Header} from '@/components/Header'

export default async function Home() {
  const supabase = await createClient()
  const {data: {user}} = await supabase.auth.getUser()
  const email = verifiedEmail(user)

  const {internalViewers, artists} = await sanityFetch<{
    internalViewers: string[] | null
    artists: {name: string; slug: string}[]
  }>(
    `{"internalViewers": *[_id == "website"][0].internalViewerEmails,
      "artists": *[_type == "artist" && defined(slug.current)] | order(name asc){name, "slug": slug.current}}`,
    {},
    ['artist', 'website'],
  )
  const internal = email ? isInternalViewer(email, internalViewers) : false

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-6">
      <Header />
      {internal ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => (
            <li key={a.slug}>
              <Link className="block rounded-md border bg-white p-3 hover:bg-neutral-50" href={`/${a.slug}`}>{a.name}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-neutral-600">Open the link your Vydia representative sent you to see your resources.</p>
      )}
    </main>
  )
}
```

The roster is only rendered for internal viewers (the research says they can view every site). Clients only ever see the generic message.

---

## 10. Cache Invalidation Webhook (D9)

```ts
// app/api/revalidate/route.ts
import {revalidateTag} from 'next/cache'
import {NextResponse, type NextRequest} from 'next/server'
import {parseBody} from 'next-sanity/webhook'
import type {SanityTag} from '@/lib/sanity/fetch'

const TAGS = new Set<SanityTag>(['artist', 'resource', 'section', 'website'])

export async function POST(req: NextRequest) {
  const {isValidSignature, body} = await parseBody<{_type?: string}>(
    req,
    process.env.SANITY_REVALIDATE_SECRET,
    true, // wait for Content Lake eventual consistency before revalidating
  )
  if (!isValidSignature) return new NextResponse('Invalid signature', {status: 401})
  if (!body?._type || !TAGS.has(body._type as SanityTag)) return new NextResponse('Ignored', {status: 400})

  // Next 16: second arg is required. {expire: 0} = expire immediately, so the next
  // visitor gets fresh content rather than stale-while-revalidate.
  // (On Next 15 this is just `revalidateTag(body._type)`.)
  revalidateTag(body._type, {expire: 0})
  return NextResponse.json({revalidated: body._type, now: Date.now()})
}
```

**Sanity → API → Webhooks → Create:**

| Field | Value |
|---|---|
| URL | `https://welcometovydia.com/api/revalidate` |
| Dataset | `production` |
| Trigger on | Create, Update, Delete |
| Filter | `_type in ["artist", "resource", "section", "website"]` |
| Projection | `{_type}` |
| Drafts | Off |
| HTTP method | POST |
| Secret | `SANITY_REVALIDATE_SECRET` |

Tagging by type is coarse but correct, and at this scale (tens of artists) it costs almost nothing. Editing one resource refreshes every page that shows it, which is exactly the "global editing impact" behaviour the research asks for. Revoking someone's email (an `artist` update) also takes effect on their next request.

---

## 11. UI Components (recreating the reference)

Visual spec taken from the screenshot:

| Element | Spec |
|---|---|
| Page | Light gray background `#F3F4F6`, content max-width ≈ 1150px, generous vertical spacing |
| Header | Full-width rounded (≈12px) near-black banner with subtle grain texture, white logo centered, ≈140px tall on desktop |
| Intro | Regular body text, bullets with **bold** section names followed by " - description" |
| Section title | Medium-weight, ≈18px, dark gray, no subtitle in reference (optional subtitle below in muted text) |
| Grid | **Grid, not horizontal scroll** (research): 1 / 2 / 3 / 4 columns at sm / md / lg |
| Card | White, 1px `#E5E7EB` border, ≈8px radius, cover area on top (≈16:9), file-type badge overlapping the bottom-left of the cover, title (≈17px, medium), "Added on MMM D, YYYY at h:mm AM" pinned to the bottom in muted text |
| Badges | PDF: red `#E5322D` (Acrobat glyph). Video: plum `#8E1B5A` (play). Link: orange `#F5A524` (link). Slides: yellow `#F4B400` (slides glyph) |

### 11.1 Layout and fonts

```tsx
// app/(site)/layout.tsx
import type {Metadata} from 'next'
import {Source_Sans_3} from 'next/font/google'
import './globals.css'

const sans = Source_Sans_3({subsets: ['latin'], variable: '--font-sans'})

export const metadata: Metadata = {title: 'Welcome to Vydia', robots: {index: false, follow: false}}

export default function SiteLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-[#F3F4F6] font-sans text-neutral-800 antialiased">{children}</body>
    </html>
  )
}
```

```css
/* app/(site)/globals.css */
@import 'tailwindcss';

@theme {
  --font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --color-badge-pdf: #e5322d;
  --color-badge-video: #8e1b5a;
  --color-badge-link: #f5a524;
  --color-badge-slides: #f4b400;
}

/* Subtle film-grain used by the header and placeholder tiles */
.grain {
  background-color: #121212;
  background-image:
    radial-gradient(ellipse at 30% 20%, rgb(255 255 255 / 0.06), transparent 60%),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.18'/></svg>");
}
```

### 11.2 Header

```tsx
// components/Header.tsx
import Image from 'next/image'

export function Header() {
  return (
    <header className="grain flex h-24 items-center justify-center rounded-xl px-6 shadow-sm sm:h-36">
      <Image
        src="/vydia-logo.svg"
        alt="Vydia, a gamma company"
        width={1233}
        height={139}
        priority
        className="h-7 w-auto sm:h-10"
      />
    </header>
  )
}
```

### 11.3 Intro and rich text

```tsx
// components/RichText.tsx
import {PortableText, type PortableTextComponents, type PortableTextBlock} from '@portabletext/react'

const components: PortableTextComponents = {
  block: {
    normal: ({children}) => <p className="leading-relaxed">{children}</p>,
    h3: ({children}) => <h3 className="mt-4 text-lg font-semibold">{children}</h3>,
  },
  list: {
    bullet: ({children}) => <ul className="ml-6 list-disc space-y-1">{children}</ul>,
    number: ({children}) => <ol className="ml-6 list-decimal space-y-1">{children}</ol>,
  },
  marks: {
    strong: ({children}) => <strong className="font-semibold">{children}</strong>,
    link: ({value, children}) => (
      <a href={value?.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {children}
      </a>
    ),
  },
}

export function RichText({value}: {value: PortableTextBlock[]}) {
  return (
    <div className="space-y-2 text-[17px]">
      <PortableText value={value} components={components} />
    </div>
  )
}
```

```tsx
// components/Intro.tsx
import type {PortableTextBlock} from '@portabletext/react'
import {RichText} from './RichText'

export function Intro({value}: {value: PortableTextBlock[]}) {
  if (!value.length) return null
  return (
    <section aria-label="Introduction">
      <RichText value={value} />
    </section>
  )
}
```

### 11.4 Section, card, cover, badge

```ts
// lib/format.ts
const TZ = 'America/New_York' // fixed so server output is deterministic

const date = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ})
const time = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', timeZone: TZ})

/** "Added on May 16, 2025 at 12:08 PM" */
export function formatAddedOn(iso: string) {
  const d = new Date(iso)
  return `Added on ${date.format(d)} at ${time.format(d)}`
}
```

```tsx
// components/ResourceSection.tsx
import type {SectionData, ResourceCardData} from '@/lib/sanity/types'
import {ResourceCard} from './ResourceCard'

export function ResourceSection({section}: {section: Omit<SectionData, 'resources'> & {resources: ResourceCardData[]}}) {
  if (!section.resources.length) return null
  const headingId = `section-${section._id}`
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div>
        <h2 id={headingId} className="text-lg font-medium text-neutral-700">{section.title}</h2>
        {section.subtitle && <p className="mt-1 text-neutral-500">{section.subtitle}</p>}
      </div>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {section.resources.map((r) => (
          <li key={r._id} className="flex">
            <ResourceCard resource={r} />
          </li>
        ))}
      </ul>
    </section>
  )
}
```

```tsx
// components/FileTypeBadge.tsx
import {FileText, Link2, Play, Presentation} from 'lucide-react'
import type {ResourceType} from '@/sanity/schemaTypes/resource'

const STYLES: Record<ResourceType, {bg: string; Icon: typeof FileText; label: string}> = {
  pdf: {bg: 'bg-badge-pdf', Icon: FileText, label: 'PDF'},
  video: {bg: 'bg-badge-video', Icon: Play, label: 'Video'},
  link: {bg: 'bg-badge-link', Icon: Link2, label: 'Link'},
  slides: {bg: 'bg-badge-slides', Icon: Presentation, label: 'Slide deck'},
}

export function FileTypeBadge({type, className = ''}: {type: ResourceType; className?: string}) {
  const {bg, Icon, label} = STYLES[type]
  return (
    <span className={`inline-flex size-8 items-center justify-center rounded-md text-white ring-2 ring-white ${bg} ${className}`}>
      <Icon aria-hidden className="size-4" strokeWidth={2.5} />
      <span className="sr-only">{label}</span>
    </span>
  )
}
```

```tsx
// components/CardCover.tsx
import Image from 'next/image'
import {urlFor} from '@/lib/sanity/image'
import type {ResourceCardData} from '@/lib/sanity/types'

/** cover photo → PDF preview (both arrive as `cover`) → branded placeholder */
export function CardCover({resource}: {resource: ResourceCardData}) {
  const {cover, title} = resource
  if (cover?.asset) {
    return (
      <Image
        src={urlFor(cover).width(800).height(450).fit('max').url()}
        alt={cover.alt ?? ''}
        fill
        sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
        className="object-contain"
        placeholder={cover.asset.metadata?.lqip ? 'blur' : 'empty'}
        blurDataURL={cover.asset.metadata?.lqip}
      />
    )
  }
  // Mirrors the existing Seismic thumbnails: dark grain tile, uppercase title, small logo.
  return (
    <div className="grain absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="line-clamp-3 text-lg font-bold uppercase leading-tight tracking-wide text-white">{title}</span>
      <img src="/vydia-logo.svg" alt="" className="h-2.5 w-auto opacity-80" />
    </div>
  )
}
```

```tsx
// components/ResourceCard.tsx
import type {ResourceCardData} from '@/lib/sanity/types'
import {formatAddedOn} from '@/lib/format'
import {CardCover} from './CardCover'
import {FileTypeBadge} from './FileTypeBadge'
import {VideoCard} from './VideoCard'

export function resourceHref(r: ResourceCardData): string | null {
  return r.type === 'link' ? r.url ?? null : r.fileUrl ?? r.url ?? null
}

export function CardBody({resource}: {resource: ResourceCardData}) {
  return (
    <>
      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-white">
        <CardCover resource={resource} />
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-4 pt-6">
        <FileTypeBadge type={resource.type} className="absolute -top-4 left-5" />
        <h3 className="text-[17px] font-medium leading-snug text-neutral-800">{resource.title}</h3>
        <p className="mt-auto pt-6 text-sm text-neutral-500">{formatAddedOn(resource.addedOn)}</p>
      </div>
    </>
  )
}

const CARD =
  'flex w-full flex-col rounded-lg border border-neutral-200 bg-white text-left shadow-sm transition ' +
  'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900'

export function ResourceCard({resource}: {resource: ResourceCardData}) {
  // Uploaded videos play in a modal; linked videos (YouTube/Vimeo) just open the link.
  if (resource.type === 'video' && resource.fileUrl) {
    return <VideoCard resource={resource} className={CARD} />
  }
  const href = resourceHref(resource)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={CARD}>
      <CardBody resource={resource} />
    </a>
  )
}
```

```tsx
// components/VideoCard.tsx
'use client'
import {useRef} from 'react'
import {X} from 'lucide-react'
import type {ResourceCardData} from '@/lib/sanity/types'
import {CardBody} from './ResourceCard'

export function VideoCard({resource, className}: {resource: ResourceCardData; className: string}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  return (
    <>
      <button type="button" className={className} onClick={() => dialog.current?.showModal()}>
        <CardBody resource={resource} />
      </button>
      <dialog
        ref={dialog}
        onClose={() => video.current?.pause()}
        className="m-auto w-[min(960px,92vw)] rounded-xl bg-black p-0 backdrop:bg-black/70"
        aria-label={resource.title}
      >
        <button onClick={() => dialog.current?.close()} className="absolute right-3 top-3 z-10 text-white" aria-label="Close">
          <X />
        </button>
        <video ref={video} src={resource.fileUrl!} controls preload="metadata" className="aspect-video w-full" />
      </dialog>
    </>
  )
}
```

> `CardBody` is shared by a Server Component (`ResourceCard`) and a Client Component (`VideoCard`). Both use only serializable props and no server-only imports, so this works. If the bundler complains, move `CardBody` into its own file without `'use client'`.

---

## 12. Seeding the Initial Content

Run once against the dataset with `npx sanity exec scripts/seed.ts --with-user-token`. It creates the `website` singleton with the exact intro text from the reference and the three initial sections, empty and ready for L&A to fill.

```ts
// scripts/seed.ts
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-02-19'})
const key = () => Math.random().toString(36).slice(2, 10)

const bullet = (bold: string, rest: string) => ({
  _type: 'block', _key: key(), style: 'normal', listItem: 'bullet', level: 1, markDefs: [],
  children: [
    {_type: 'span', _key: key(), text: bold, marks: ['strong']},
    {_type: 'span', _key: key(), text: ` - ${rest}`, marks: []},
  ],
})

const sections = [
  {_id: 'section-platform', title: 'Vydia Platform Resources'},
  {_id: 'section-pitch-forms', title: 'Playlisting and Sync Pitch Forms'},
  {_id: 'section-additional', title: 'Additional Services'},
]

async function main() {
  const tx = client.transaction()
  for (const s of sections) tx.createIfNotExists({_type: 'section', resources: [], ...s})
  tx.createIfNotExists({
    _id: 'website',
    _type: 'website',
    intro: [
      {
        _type: 'block', _key: key(), style: 'normal', markDefs: [],
        children: [{_type: 'span', _key: key(), text: 'Welcome to Vydia! Check out the resources below to get started:', marks: []}],
      },
      bullet('Vydia Platform Resources', "Here you'll find a full guide to Vydia's platform along with video tutorials to help you get familiar with the platform."),
      bullet('Playlisting and Sync Pitch Forms', "Leverage Vydia's playlisting and sync services to promote your upcoming and existing releases. Get started by filling out one of the forms below."),
      bullet('Additional Services', 'Learn about all that Vydia has to offer including pub admin, physical distribution, and broadcast distribution services.'),
    ],
    sections: sections.map((s) => ({_type: 'reference', _ref: s._id, _key: key()})),
    internalViewerEmails: [],
  })
  await tx.commit()
  console.log('Seeded website singleton + 3 sections')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

### 12.1 Seismic asset migration (manual, by L&A or me)

Inventory from the reference screenshot (the real list may be longer because the rows scroll):

| Section | Resource | Type | Original "Added on" |
|---|---|---|---|
| Vydia Platform Resources | Vydia Guide Book | PDF | (from Seismic) |
| | How to Upload Content | Video | (from Seismic) |
| | How to Create a New Album | Video | (from Seismic) |
| | How to Add a Payee | Video | (from Seismic) |
| Playlisting and Sync Pitch Forms | LS Best Practices for Pitching | PDF | May 16, 2025 12:08 PM |
| | Video Pitch Form | Link | Mar 27, 2026 5:43 PM |
| | Audio Pitch Form | Link | Mar 27, 2026 5:54 PM |
| | Sync Pitch Form | Link | Mar 27, 2026 |
| Additional Services | Pub Admin One Sheet | PDF | Oct 23, 2024 1:15 PM |
| | Physical Distribution & E-Commerce \| Pitch Deck | Slides | Oct 23, 2024 1:16 PM |
| | Broadcast Distribution Pricing | PDF | Oct 23, 2024 1:16 PM |

Checklist per asset: download from Seismic → create the Resource → upload the file (or paste the link) → **set "Added on" to the Seismic date** → add a cover photo where Seismic had a custom thumbnail → add it to the section.

---

## 13. Testing

### 13.1 Unit (Vitest)

```ts
// tests/access.test.ts
import {describe, expect, it, vi} from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/sanity/fetch', () => ({sanityFetch: vi.fn()}))
import {decideAccess} from '@/lib/access'

const artist = {_id: 'a1', slug: 'jane-doe', allowedEmails: ['Jane@Example.com']}

describe('decideAccess', () => {
  it('denies unknown artists', () => {
    expect(decideAccess('nope', 'jane@example.com', {artist: null})).toEqual({status: 'denied'})
  })
  it('denies unapproved emails with the SAME result as unknown', () => {
    expect(decideAccess('jane-doe', 'eve@example.com', {artist})).toEqual(
      decideAccess('nope', 'eve@example.com', {artist: null}),
    )
  })
  it('matches emails case-insensitively and trims', () => {
    expect(decideAccess('jane-doe', '  JANE@example.COM ', {artist}).status).toBe('granted')
  })
  it('always allows the permanent internal emails', () => {
    expect(decideAccess('jane-doe', 'LabelRelationships@vydia.com', {artist}).status).toBe('granted')
  })
  it('allows internal viewers from the website singleton', () => {
    expect(decideAccess('jane-doe', 'ops@vydia.com', {artist, internalViewers: ['OPS@vydia.com']}).status).toBe('granted')
  })
  it('redirects old slugs only when allowed', () => {
    expect(decideAccess('old-name', 'jane@example.com', {artist})).toEqual({status: 'redirect', canonicalSlug: 'jane-doe'})
    expect(decideAccess('old-name', 'eve@example.com', {artist})).toEqual({status: 'denied'})
  })
  it('denies when there is no verified email', () => {
    expect(decideAccess('jane-doe', null, {artist})).toEqual({status: 'denied'})
  })
})
```

```ts
// tests/slug.test.ts
import {expect, it} from 'vitest'
import {slugify} from '@/lib/slug'

it.each([
  ['Beyoncé', 'beyonce'],
  ['Guns N’ Roses', 'guns-n-roses'],
  ['Simon & Garfunkel', 'simon-and-garfunkel'],
  ['  A$AP Rocky!! ', 'a-ap-rocky'],
  ['múm', 'mum'],
])('%s -> %s', (input, out) => expect(slugify(input)).toBe(out))
```

### 13.2 End-to-end (Playwright, against a preview deployment with test users)

```ts
// tests/e2e/access.spec.ts
import {expect, test} from '@playwright/test'

test('signed-out users are sent to login for real AND fake slugs', async ({page}) => {
  for (const slug of ['test-artist', 'definitely-not-real-xyz']) {
    await page.goto(`/${slug}`)
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2F${slug}`))
  }
})

test.describe('signed in as an unapproved user', () => {
  test.use({storageState: 'tests/e2e/.auth/outsider.json'})

  test('unknown and forbidden render identically', async ({page}) => {
    const a = await page.goto('/test-artist')
    const htmlA = await page.locator('main').innerHTML()
    const b = await page.goto('/definitely-not-real-xyz')
    const htmlB = await page.locator('main').innerHTML()
    expect(a?.status()).toBe(404)
    expect(b?.status()).toBe(404)
    expect(htmlA).toBe(htmlB)
    await expect(page).toHaveTitle('Welcome to Vydia')
  })
})

test.describe('signed in as an approved user', () => {
  test.use({storageState: 'tests/e2e/.auth/approved.json'})

  test('sees intro and cards', async ({page}) => {
    await page.goto('/test-artist')
    await expect(page.getByText('Welcome to Vydia!')).toBeVisible()
    await expect(page.getByRole('heading', {name: 'Vydia Platform Resources'})).toBeVisible()
    await expect(page.getByText(/^Added on /).first()).toBeVisible()
  })
})
```

### 13.3 Manual QA checklist

- [ ] Email sign-up sends a confirmation email (custom SMTP), and the link lands on the original `/[slug]`.
- [ ] Signing in before confirming fails with a generic message.
- [ ] Google sign-in works and returns to `next`.
- [ ] Session survives closing the browser and returning a week later (check cookie max-age).
- [ ] Publishing a resource change in Studio shows on the site within seconds without redeploying (webhook delivered: Sanity → Webhooks → attempts log).
- [ ] Removing an email from an artist revokes access on the next page load.
- [ ] Artist intro override and section override work; clearing them falls back to the global versions.
- [ ] Card with no cover photo: PDF shows its first page; link/video/slides show the branded tile.
- [ ] "Added on" doesn't change after editing a resource.
- [ ] Renaming an artist doesn't change the URL. "Change URL…" keeps the old URL redirecting.
- [ ] Reserved slug (`studio`) and duplicate/previous slugs are rejected in Studio.
- [ ] Studio: can't create a second Website or delete it. Can't delete a resource still used in a section.
- [ ] Keyboard: every card is focusable and opens with Enter, and the video dialog closes with Esc.
- [ ] Mobile layout (single column), and the header logo scales down.

---

## 14. Implementation Phases

Each phase ends in something demoable.

**Phase 0: Accounts and plumbing**
- [ ] Sanity project + private dataset, Viewer token, CORS, two Editor seats
- [ ] Supabase project: email confirm ON, Google provider, session settings, custom SMTP, email templates
- [ ] Vercel project linked to repo, env vars for Preview and Production
- [ ] Ask the product team for DNS for `welcometovydia.com` (Vercel domain)

**Phase 1: Scaffold**
- [ ] `create-next-app`, Tailwind v4, Source Sans 3, route groups `(site)` + `studio`
- [ ] Copy `docs/logo/gamma-vydia-white.svg` → `public/vydia-logo.svg`
- [ ] `lib/env.ts`, `sanity/env.ts`, ESLint/Prettier, Vitest config

**Phase 2: Sanity schema and Studio**
- [ ] `blockContent`, `resource`, `section`, `website`, `artist` (§5)
- [ ] Desk structure with singleton + "Not in any section" (§6.1)
- [ ] Document actions: lock slug, change URL, open site (§6.2)
- [ ] `PdfPreviewInput` (§6.3)
- [ ] Run `scripts/seed.ts`, create one test artist + a few test resources
- [ ] `sanity typegen generate`

**Phase 3: Page rendering (no auth yet; temporarily bypass the proxy locally)**
- [ ] Queries + `getArtistPage` override logic (§7)
- [ ] Header, Intro, RichText, ResourceSection, ResourceCard, CardCover, FileTypeBadge, VideoCard (§11)
- [ ] Pixel-compare against `docs/screenshots/sample website.png`

**Phase 4: Authentication**
- [ ] Supabase clients, `proxy.ts` (§8.1–8.2)
- [ ] Login page (password, sign-up, reset, Google), `/auth/callback`, `/auth/confirm`, `/auth/signout`, `/account/update-password`

**Phase 5: Access control**
- [ ] `lib/access.ts` + unit tests (§9.1, §13.1)
- [ ] `[slug]/page.tsx` + shared `not-found.tsx` / `NoAccess` (§9.2)
- [ ] Old-slug redirect after access check
- [ ] Root `/` with internal-only index (§9.4)

**Phase 6: Caching and webhook**
- [ ] `sanityFetch` with tags, `/api/revalidate`, Sanity webhook (§10)
- [ ] Verify end to end on a Vercel preview

**Phase 7: Hardening and QA**
- [ ] Playwright suite (§13.2), manual checklist (§13.3)
- [ ] Security headers in `next.config.ts` (`X-Frame-Options: DENY` on site routes, `Referrer-Policy: same-origin`)
- [ ] Lighthouse/a11y pass

**Phase 8: Launch**
- [ ] Production domain, Supabase Site URL + redirect URLs updated, webhook URL pointing to production
- [ ] Migrate Seismic assets (§12.1), set original "Added on" dates
- [ ] Measure Sanity asset storage/bandwidth after the videos are uploaded (see risks)

**Phase 9: Handoff**
- [ ] Loom walkthrough (outline in §16)
- [ ] Present the prototype and work through the open questions (§17)

---

## 15. Risks and Mitigations

| Risk (research) | Mitigation in this plan |
|---|---|
| **URL stability**: renames break bookmarks | Slug generated once, locked on first publish (§6.2). Renaming the artist doesn't touch the slug. "Change URL…" keeps old slugs as redirects. Uniqueness checked across current + previous slugs, reserved words blocked, `slugify` handles accents/`&`/punctuation. |
| **"Added on" dates** reflect edits | Explicit `addedOn` field, initialised on create and editable for migration. GROQ falls back to `_createdAt`, never `_updatedAt`. |
| **Missing cover photos** | Three-step fallback: cover → auto PDF preview → branded grain tile that matches the existing thumbnail style. The card layout is identical in every case (fixed 16:9 cover box). |
| **Global edits look like failed publishes** | Type-tagged cache + signed webhook with immediate expiry (§10). Pages refresh within seconds. |
| **Sanity storage/bandwidth for videos** | Unverified. Check the current plan quotas on sanity.io/pricing before migrating. The `resource` schema already accepts a **link** for videos (unlisted YouTube/Vimeo) as a zero-code fallback. Next options: Mux via `sanity-plugin-mux-input`, or Supabase Storage as the research suggested. |
| **Public asset URLs** in a private dataset | Acceptable for client-facing collateral. If needed later: `/api/files/[id]` route that checks the session + an allowed artist before streaming from Sanity, with cards linking there instead of `cdn.sanity.io`. |
| **Roster enumeration** | Proxy gates every path before any Sanity lookup. Denied = unknown (§9.3). Static metadata. `noindex`. Private dataset. |
| **Email confirmations not arriving** | Custom SMTP is required for production (Supabase default sender is rate-limited). |
| **Shared Sanity login: no per-person audit trail** | Open question for L&A (§17). Studio history still shows *what* changed and when. |
| **Editors can't see that a resource is orphaned** | "Not in any section" list in Studio (§6.1). |

---

## 16. Loom Walkthrough Outline (for L&A and Creative Services)

1. **Tour** (1 min): sidebar = Website, Artists, Sections, Resources. "Resources go into Sections, Sections go into the Website."
2. **Create a new microsite** (Flow 1): New Artist → name → Generate URL → allowed emails (internal emails are automatic) → optional intro override / additional info → Publish → *Open site*.
3. **Add a resource** (Flow 2): New Resource → title → type → upload/link → (optional cover) → check the auto PDF preview → "Added on" (and when to change it) → Publish.
4. **Put it on the page**: open a Section → add the resource → drag to reorder → Publish. Show the "Not in any section" list.
5. **Global layout**: Website → intro text → section order → internal viewers.
6. **Per-artist overrides**: section override *replaces* the global sections, and how to undo it (clear the field).
7. **Things not to do**: why the URL locks, how "Change URL…" works, and that edits to a shared resource change every artist's page.
8. **Troubleshooting**: "Client says they can't see the page" → check the email spelling on the artist and confirm they verified their email or used Google.

---

## 17. Open Questions (carry into the prototype review)

From research:
- Is a single shared Sanity login per team acceptable (no individual change tracking)?
- Customization: artist profile picture? Custom background images? Anything else? (The `artist.customization` object is already in the schema, hidden, ready for this.)

Raised while planning:
- Should the two permanent internal emails also be allowed to **see the artist index** at `/`? (Planned: yes.)
- Do videos stay in Sanity, or move to Mux/YouTube once storage is measured?
- Is it fine that Sanity file URLs are public-if-known, or do we need the authenticated file proxy?
- Who owns the Supabase/Sanity/Vercel accounts long term (billing, seat changes)?
- Should the date line show for link-type resources (pitch forms)? The reference shows it, so the plan keeps it.

---

## 18. Requirements Traceability

| Research requirement | Where it's handled |
|---|---|
| Page = header + intro + sections of cards | §9.2, §11 |
| Header with Vydia logo, fixed branding | §11.2 |
| Global rich-text intro, editable | `website.intro` §5.5, seed §12 |
| Artist intro override | `artist.introOverride`, §7.4 |
| Additional info under intro | `artist.additionalInfo`, §9.2 |
| Section override replaces (not appends) | §7.4 |
| Card: cover / PDF preview fallback, title, "Added on" | §5.3, §6.3, §11.4 |
| Types: PDF, video, link, slides | `resource.type` §5.3 |
| Pitch forms are link cards | `type: 'link'` |
| Grid, not horizontal scroll; keep file-type icons | §11.4 |
| URL `welcometovydia.com/[artist-name]`, stable | §5.1, §5.6, §6.2 |
| Two shared @vydia.com emails always have access | `PERMANENT_VIEWER_EMAILS`, §9.1 |
| Designated internal emails see every site | `website.internalViewerEmails`, §9.1, §9.4 |
| Sign in before "doesn't exist" | Proxy §8.2 |
| Unknown vs. unapproved indistinguishable | §9.2–9.3, e2e §13.2 |
| Non-aggressive sessions | §4.3, §8.2 (D11) |
| Email confirmation for password sign-ups | §4.3, §8.5, `verifiedEmail()` |
| Case-insensitive email matching | `normalizeEmail`, Studio duplicate check |
| Publish webhook refreshes pages | §10 |
| L&A can manage without a developer | §6, §16 |
| Resource not in a section is invisible | §7.4 + "Not in any section" §6.1 |
