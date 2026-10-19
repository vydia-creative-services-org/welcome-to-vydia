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
| `/` | Instructions only: "open the link your Vydia rep sent you" (no artist list) | Everyone |
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
| D12 | **No Tailwind. Styling is CSS Modules**: each component has a co-located `Component.module.css`, and one global stylesheet holds only design tokens (CSS custom properties) and a base reset | Plan-review decision. Scoped class names with no build plugin, and plain CSS that anyone can read. Tokens keep colors, radii, and spacing consistent across modules. |
| D13 | **`/` is an instructions-only page, not an artist index.** It's public, reads nothing from Sanity, and tells the visitor to open the link their Vydia rep sent | Plan-review decision. Assume the visitor is an artist looking for their page. Internal viewers reach artist pages by direct URL or with Studio's "Open site" action. |
| D14 | **Videos are uploaded to Sanity** (no YouTube/Vimeo/Mux link option for the `video` type) | Plan-review decision, matches the research ("Sanity will store all … videos"). Storage and bandwidth still get measured (§15). |

---

## 2. Tech Stack and Packages

```bash
npx create-next-app@latest welcome-to-vydia --ts --no-tailwind --eslint --app --src-dir=false --import-alias "@/*"

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
- **CSS Modules** for all site styling (D12). No Tailwind, CSS-in-JS, or UI kit. Design tokens live in `app/(site)/globals.css` as CSS custom properties. **Source Sans 3** via `next/font` (closest match to the reference screenshot). Studio keeps Sanity's own `@sanity/ui` styling, which is separate from the site.
- **Sanity Studio v4+** embedded via `next-sanity/studio`.
- **Supabase**: Auth only. No tables are needed for the prototype. Supabase Storage is an optional backup for resource files (research, Tech Stack).

---

## 3. Project Structure

```
welcome-to-vydia/
├─ app/
│  ├─ (site)/                         # public site, own root layout
│  │  ├─ layout.tsx
│  │  ├─ globals.css                  # design tokens + base reset ONLY (D12)
│  │  ├─ page.tsx                     # "/" instructions only, public (D13)
│  │  ├─ [slug]/
│  │  │  ├─ page.tsx                  # artist page
│  │  │  ├─ page.module.css
│  │  │  └─ not-found.tsx             # identical page for unknown + denied
│  │  ├─ login/
│  │  │  ├─ page.tsx
│  │  │  ├─ LoginForm.tsx             # client component
│  │  │  ├─ LoginForm.module.css
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
├─ components/                        # every component has a co-located .module.css
│  ├─ PageShell.tsx / .module.css     # <main> width + spacing + Header
│  ├─ Header.tsx / .module.css
│  ├─ Notice.tsx / .module.css        # centered message card (no-access page, "/")
│  ├─ NoAccess.tsx
│  ├─ Intro.tsx
│  ├─ RichText.tsx / .module.css
│  ├─ ResourceSection.tsx / .module.css
│  ├─ ResourceCard.tsx / .module.css
│  ├─ CardBody.tsx                    # cover + badge + title + date (shared by both card kinds)
│  ├─ CardCover.tsx / .module.css
│  ├─ FileTypeBadge.tsx / .module.css
│  ├─ VideoCard.tsx / .module.css     # client: opens <dialog> player
│  └─ ui/controls.module.css          # shared button / input / message classes
├─ lib/
│  ├─ env.ts
│  ├─ access.ts                       # pure decision + server resolver
│  ├─ slug.ts                         # slugify + reserved list (shared w/ Studio)
│  ├─ safe-redirect.ts
│  ├─ format.ts                       # "Added on … at …"
│  ├─ cx.ts                           # join class names
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
      description: 'Upload the PDF, video, or slide deck. Videos: MP4 (H.264), 1080p max, to keep storage and bandwidth down.',
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
      description: 'For links and pitch forms. Slide decks can use a link (e.g. Google Slides) instead of an upload.',
      // PDFs and videos are always uploaded to Sanity (D14)
      hidden: ({document}) => document?.type === 'pdf' || document?.type === 'video',
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
      if (d.type === 'video' && !hasFile) return 'Upload the video file.'
      if (d.type === 'link' && !hasUrl) return 'Add a link URL.'
      if (d.type === 'slides' && !hasFile && !hasUrl) return 'Upload the deck or add a link.'
      if (d.type === 'slides' && hasFile && hasUrl) return 'Use either an upload or a link, not both.'
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

const PUBLIC_EXACT = ['/'] // instructions page, no data (D13)
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
  const isPublic =
    PUBLIC_EXACT.includes(path) || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))

  if (!signedIn && !isPublic) {
    // Same redirect for EVERY gated path: existing artist, missing artist, anything.
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
import {cx} from '@/lib/cx'
import ui from '@/components/ui/controls.module.css'
import styles from './LoginForm.module.css'
import {requestPasswordReset, signIn, signUp, type AuthState} from './actions'

type Mode = 'signin' | 'signup' | 'reset'

const TITLES: Record<Mode, string> = {signin: 'Sign in', signup: 'Create your login', reset: 'Reset password'}
const SUBMIT: Record<Mode, string> = {signin: 'Sign in', signup: 'Sign up', reset: 'Send reset link'}

export function LoginForm({next, linkError}: {next: string; linkError?: boolean}) {
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
    <div className={styles.card}>
      <h1 className={styles.title}>{TITLES[mode]}</h1>

      {linkError && !state.error && !state.message && (
        <p role="alert" className={cx(ui.error, styles.feedback)}>That link is invalid or expired. Please try again.</p>
      )}

      {mode !== 'reset' && (
        <>
          <button type="button" onClick={google} className={ui.button}>
            Continue with Google
          </button>
          <div className={styles.divider}>or</div>
        </>
      )}

      <form action={formAction} className={styles.form} key={mode}>
        <input type="hidden" name="next" value={next} />
        <label className={styles.field}>
          <span className="visually-hidden">Email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="Email" className={ui.input} />
        </label>
        {mode !== 'reset' && (
          <label className={styles.field}>
            <span className="visually-hidden">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="Password"
              className={ui.input}
            />
          </label>
        )}
        <button disabled={pending} className={cx(ui.button, ui.primary)}>
          {SUBMIT[mode]}
        </button>
      </form>

      {state.error && <p role="alert" className={cx(ui.error, styles.feedback)}>{state.error}</p>}
      {state.message && <p role="status" className={cx(ui.success, styles.feedback)}>{state.message}</p>}

      <div className={styles.footer}>
        {mode === 'signin' ? (
          <>
            <button type="button" className={ui.textButton} onClick={() => setMode('signup')}>First time? Sign up</button>
            <button type="button" className={ui.textButton} onClick={() => setMode('reset')}>Forgot password?</button>
          </>
        ) : (
          <button type="button" className={ui.textButton} onClick={() => setMode('signin')}>Back to sign in</button>
        )}
      </div>
    </div>
  )
}
```

```css
/* app/(site)/login/LoginForm.module.css */
.card {
  width: 100%;
  max-width: 384px;
  margin: 0 auto;
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.title {
  margin-bottom: var(--space-4);
  font-size: 20px;
  font-weight: 600;
}

.divider {
  margin: var(--space-4) 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.field {
  display: block;
}

.feedback {
  margin-top: var(--space-3);
}

.footer {
  margin-top: var(--space-4);
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}
```

```tsx
// app/(site)/login/page.tsx
import {PageShell} from '@/components/PageShell'
import {safeNext} from '@/lib/safe-redirect'
import {LoginForm} from './LoginForm'

export default async function LoginPage({searchParams}: {searchParams: Promise<{next?: string; error?: string}>}) {
  const {next, error} = await searchParams
  return (
    <PageShell>
      <LoginForm next={safeNext(next)} linkError={Boolean(error)} />
    </PageShell>
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
import {PageShell} from '@/components/PageShell'
import {Intro} from '@/components/Intro'
import {RichText} from '@/components/RichText'
import {ResourceSection} from '@/components/ResourceSection'
import styles from './page.module.css'

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
    <PageShell>
      <Intro value={page.intro} />
      {page.additionalInfo && (
        <section aria-label="Additional information" className={styles.additionalInfo}>
          <RichText value={page.additionalInfo} />
        </section>
      )}
      {page.sections.map((s) => (
        <ResourceSection key={s._id} section={s} />
      ))}
    </PageShell>
  )
}
```

```css
/* app/(site)/[slug]/page.module.css */
.additionalInfo {
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
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
import {PageShell} from './PageShell'
import {Notice} from './Notice'
import ui from './ui/controls.module.css'

export function NoAccess() {
  return (
    <PageShell>
      <Notice
        title="This page isn’t available"
        action={
          <form action="/auth/signout" method="post">
            <button className={ui.button}>Sign in with a different email</button>
          </form>
        }
      >
        This page doesn’t exist or your email doesn’t have access to it. If you think this is a mistake,
        contact your Vydia representative, or sign in with a different email.
      </Notice>
    </PageShell>
  )
}
```

`PageShell` and `Notice` are defined in §11.

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

### 9.4 Root `/`: instructions only (D13)

`/` is **not** an artist index. Assume whoever lands here is an artist who lost or mistyped their link. The page is fully static: it reads no session and makes no Sanity query, so it can't reveal anything about the roster. It's public (`PUBLIC_EXACT` in §8.2), so a signed-out visitor sees the instructions straight away instead of being bounced to a login form with nothing behind it.

```tsx
// app/(site)/page.tsx
import {PageShell} from '@/components/PageShell'
import {Notice} from '@/components/Notice'

export default function Home() {
  return (
    <PageShell>
      <Notice title="Looking for your Vydia resources?">
        Open the personal link your Vydia representative sent you. It looks like{' '}
        <strong>welcometovydia.com/your-artist-name</strong>. You’ll be asked to sign in with the email
        address Vydia has on file for you. Can’t find your link? Reach out to your Vydia representative.
      </Notice>
    </PageShell>
  )
}
```

Internal viewers don't need an index. They open an artist's page with the **Open site** action in Studio (§6.2) or by typing the URL. `isInternalViewer()` still grants them access to every `/[slug]`.

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
| Grid | **Grid, not horizontal scroll** (research): auto-fill columns, min 240px wide, which gives 1 column on phones and up to 4 at full width |
| Card | White, 1px `#E5E7EB` border, ≈8px radius, cover area on top (≈16:9), file-type badge overlapping the bottom-left of the cover, title (≈17px, medium), "Added on MMM D, YYYY at h:mm AM" pinned to the bottom in muted text |
| Badges | PDF: red `#E5322D` (Acrobat glyph). Video: plum `#8E1B5A` (play). Link: orange `#F5A524` (link). Slides: yellow `#F4B400` (slides glyph) |

### 11.0 Styling conventions (D12)

- **One `.module.css` per component**, in the same folder and with the same name (`ResourceCard.tsx` + `ResourceCard.module.css`). Next.js supports CSS Modules natively, so there's no extra config or PostCSS plugin.
- **`app/(site)/globals.css` holds only** design tokens (CSS custom properties), a small reset, and one utility (`.visually-hidden`). No component styles go there.
- **Modules use tokens, never raw values**, for color, radius, shadow, and spacing. One-off sizes (like `17px` titles) are fine inline.
- **Class names are camelCase** (`styles.coverImage`) so they work as JS properties.
- **Shared control styles** (buttons, inputs, form messages) live in `components/ui/controls.module.css` and are imported wherever they're needed. Modules can be imported by more than one component.
- **Breakpoints are plain media queries** at `640px` / `1024px`. Custom properties can't be used inside `@media`, so these two numbers are the convention. The card grid avoids breakpoints altogether with `auto-fill`.
- **Conditional classes** use a tiny helper instead of a dependency:

```ts
// lib/cx.ts
export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')
```

### 11.1 Layout, fonts, tokens

```tsx
// app/(site)/layout.tsx
import type {Metadata} from 'next'
import {Source_Sans_3} from 'next/font/google'
import './globals.css'

const sans = Source_Sans_3({subsets: ['latin'], variable: '--font-source-sans'})

export const metadata: Metadata = {title: 'Welcome to Vydia', robots: {index: false, follow: false}}

export default function SiteLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  )
}
```

```css
/* app/(site)/globals.css: tokens + reset ONLY. Component styles live in *.module.css. */
:root {
  /* color */
  --color-page: #f3f4f6;
  --color-surface: #ffffff;
  --color-border: #e5e7eb;
  --color-text: #262626;
  --color-heading: #404040;
  --color-text-muted: #6b7280;
  --color-ink: #121212;
  --color-danger: #dc2626;
  --color-success: #15803d;
  --color-badge-pdf: #e5322d;
  --color-badge-video: #8e1b5a;
  --color-badge-link: #f5a524;
  --color-badge-slides: #f4b400;

  /* shape */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 6px 16px rgb(0 0 0 / 0.08);

  /* spacing (4px scale) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-10: 40px;
  --space-16: 64px;

  /* layout */
  --content-width: 1150px;

  /* type */
  --font-sans: var(--font-source-sans), ui-sans-serif, system-ui, sans-serif;

  /* film grain used by the header and placeholder tiles */
  --grain:
    radial-gradient(ellipse at 30% 20%, rgb(255 255 255 / 0.06), transparent 60%),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.18'/></svg>");
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--color-page);
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, p, ul, ol {
  margin: 0;
}

img, video {
  display: block;
  max-width: 100%;
}

button, input {
  font: inherit;
  color: inherit;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

### 11.2 Page shell, header, notice, shared controls

```tsx
// components/PageShell.tsx
import {Header} from './Header'
import styles from './PageShell.module.css'

export function PageShell({children}: {children: React.ReactNode}) {
  return (
    <main className={styles.shell}>
      <Header />
      {children}
    </main>
  )
}
```

```css
/* components/PageShell.module.css */
.shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-16);
}

@media (min-width: 640px) {
  .shell {
    padding-inline: var(--space-6);
  }
}
```

```tsx
// components/Header.tsx
import Image from 'next/image'
import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <Image
        src="/vydia-logo.svg"
        alt="Vydia, a gamma company"
        width={1233}
        height={139}
        priority
        className={styles.logo}
      />
    </header>
  )
}
```

```css
/* components/Header.module.css */
.header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
  padding: 0 var(--space-6);
  border-radius: var(--radius-lg);
  background-color: var(--color-ink);
  background-image: var(--grain);
  box-shadow: var(--shadow-sm);
}

.logo {
  height: 28px;
  width: auto;
}

@media (min-width: 640px) {
  .header {
    height: 144px;
  }
  .logo {
    height: 40px;
  }
}
```

```tsx
// components/Notice.tsx   (centered message card used by NoAccess and "/")
import styles from './Notice.module.css'

export function Notice({title, children, action}: {title: string; children: React.ReactNode; action?: React.ReactNode}) {
  return (
    <div className={styles.notice}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.body}>{children}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
```

```css
/* components/Notice.module.css */
.notice {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-6);
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.body {
  margin-top: var(--space-2);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.action {
  margin-top: var(--space-4);
}
```

```css
/* components/ui/controls.module.css: shared by LoginForm, NoAccess, update-password */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
}

.button:hover {
  background: var(--color-page);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary {
  background: var(--color-ink);
  border-color: var(--color-ink);
  color: #fff;
}

.primary:hover {
  background: #000;
}

.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.button:focus-visible,
.input:focus-visible,
.textButton:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 2px;
}

.textButton {
  padding: 0;
  background: none;
  border: 0;
  color: var(--color-text-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.error {
  font-size: 14px;
  color: var(--color-danger);
}

.success {
  font-size: 14px;
  color: var(--color-success);
}
```

### 11.3 Intro and rich text

Element styles are scoped under one local class (`.richText p`, `.richText ul`), so the Portable Text serializers stay minimal and only links need a custom component.

```tsx
// components/RichText.tsx
import {PortableText, type PortableTextComponents, type PortableTextBlock} from '@portabletext/react'
import styles from './RichText.module.css'

const components: PortableTextComponents = {
  marks: {
    link: ({value, children}) => (
      <a href={value?.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  },
}

export function RichText({value}: {value: PortableTextBlock[]}) {
  return (
    <div className={styles.richText}>
      <PortableText value={value} components={components} />
    </div>
  )
}
```

```css
/* components/RichText.module.css */
.richText {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: 17px;
  line-height: 1.6;
}

.richText h3 {
  margin-top: var(--space-4);
  font-size: 18px;
  font-weight: 600;
}

.richText ul,
.richText ol {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: var(--space-6);
}

.richText strong {
  font-weight: 600;
}

.richText a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
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
import styles from './ResourceSection.module.css'

export function ResourceSection({section}: {section: Omit<SectionData, 'resources'> & {resources: ResourceCardData[]}}) {
  if (!section.resources.length) return null
  const headingId = `section-${section._id}`
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <div>
        <h2 id={headingId} className={styles.title}>{section.title}</h2>
        {section.subtitle && <p className={styles.subtitle}>{section.subtitle}</p>}
      </div>
      <ul className={styles.grid}>
        {section.resources.map((r) => (
          <li key={r._id} className={styles.item}>
            <ResourceCard resource={r} />
          </li>
        ))}
      </ul>
    </section>
  )
}
```

```css
/* components/ResourceSection.module.css */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-heading);
}

.subtitle {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
}

/* Grid, not horizontal scroll. auto-fill gives 1 to 4 columns with no breakpoints. */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex; /* lets cards in a row stretch to equal height */
}
```

```tsx
// components/FileTypeBadge.tsx
import {FileText, Link2, Play, Presentation} from 'lucide-react'
import type {ResourceType} from '@/sanity/schemaTypes/resource'
import {cx} from '@/lib/cx'
import styles from './FileTypeBadge.module.css'

const BADGES: Record<ResourceType, {Icon: typeof FileText; label: string}> = {
  pdf: {Icon: FileText, label: 'PDF'},
  video: {Icon: Play, label: 'Video'},
  link: {Icon: Link2, label: 'Link'},
  slides: {Icon: Presentation, label: 'Slide deck'},
}

export function FileTypeBadge({type, className}: {type: ResourceType; className?: string}) {
  const {Icon, label} = BADGES[type]
  return (
    <span className={cx(styles.badge, styles[type], className)}>
      <Icon aria-hidden className={styles.icon} strokeWidth={2.5} />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
```

```css
/* components/FileTypeBadge.module.css */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: #fff;
  box-shadow: 0 0 0 2px var(--color-surface); /* white ring where it overlaps the cover */
}

.icon {
  width: 16px;
  height: 16px;
}

.pdf    { background: var(--color-badge-pdf); }
.video  { background: var(--color-badge-video); }
.link   { background: var(--color-badge-link); }
.slides { background: var(--color-badge-slides); }
```

```tsx
// components/CardCover.tsx
import Image from 'next/image'
import {urlFor} from '@/lib/sanity/image'
import type {ResourceCardData} from '@/lib/sanity/types'
import styles from './CardCover.module.css'

/** cover photo → PDF preview (both arrive as `cover`) → branded placeholder */
export function CardCover({resource}: {resource: ResourceCardData}) {
  const {cover, title} = resource
  if (cover?.asset) {
    return (
      <Image
        src={urlFor(cover).width(800).height(450).fit('max').url()}
        alt={cover.alt ?? ''}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className={styles.image}
        placeholder={cover.asset.metadata?.lqip ? 'blur' : 'empty'}
        blurDataURL={cover.asset.metadata?.lqip}
      />
    )
  }
  // Mirrors the existing Seismic thumbnails: dark grain tile, uppercase title, small logo.
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderTitle}>{title}</span>
      <img src="/vydia-logo.svg" alt="" className={styles.placeholderLogo} />
    </div>
  )
}
```

```css
/* components/CardCover.module.css */
.image {
  object-fit: contain;
}

.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  text-align: center;
  background-color: var(--color-ink);
  background-image: var(--grain);
}

.placeholderTitle {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.placeholderLogo {
  height: 10px;
  width: auto;
  opacity: 0.8;
}
```

`CardBody` gets its own file with no `'use client'`, so the server-rendered link card and the client-side video card share it without ambiguity:

```tsx
// components/CardBody.tsx
import type {ResourceCardData} from '@/lib/sanity/types'
import {formatAddedOn} from '@/lib/format'
import {CardCover} from './CardCover'
import {FileTypeBadge} from './FileTypeBadge'
import styles from './ResourceCard.module.css'

export function CardBody({resource}: {resource: ResourceCardData}) {
  return (
    <>
      <div className={styles.cover}>
        <CardCover resource={resource} />
      </div>
      <div className={styles.body}>
        <FileTypeBadge type={resource.type} className={styles.badge} />
        <h3 className={styles.title}>{resource.title}</h3>
        <p className={styles.date}>{formatAddedOn(resource.addedOn)}</p>
      </div>
    </>
  )
}
```

```tsx
// components/ResourceCard.tsx
import type {ResourceCardData} from '@/lib/sanity/types'
import {CardBody} from './CardBody'
import {VideoCard} from './VideoCard'
import styles from './ResourceCard.module.css'

export function resourceHref(r: ResourceCardData): string | null {
  return r.type === 'link' ? r.url ?? null : r.fileUrl ?? r.url ?? null
}

export function ResourceCard({resource}: {resource: ResourceCardData}) {
  // Videos are always Sanity uploads (D14) and play in a modal.
  if (resource.type === 'video') {
    return resource.fileUrl ? <VideoCard resource={resource} /> : null
  }
  const href = resourceHref(resource)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.card}>
      <CardBody resource={resource} />
    </a>
  )
}
```

```css
/* components/ResourceCard.module.css: used by ResourceCard, CardBody, and VideoCard */
.card {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  text-align: left;
  text-decoration: none;
  color: inherit;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 2px;
}

.cover {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: var(--color-surface);
}

.body {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: var(--space-6) var(--space-5) var(--space-4);
}

.badge {
  position: absolute;
  top: calc(-1 * var(--space-4));
  left: var(--space-5);
}

.title {
  font-size: 17px;
  font-weight: 500;
  line-height: 1.35;
}

.date {
  margin-top: auto;
  padding-top: var(--space-6);
  font-size: 14px;
  color: var(--color-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
  .card:hover {
    transform: none;
  }
}
```

```tsx
// components/VideoCard.tsx
'use client'
import {useRef} from 'react'
import {X} from 'lucide-react'
import type {ResourceCardData} from '@/lib/sanity/types'
import {CardBody} from './CardBody'
import cardStyles from './ResourceCard.module.css'
import styles from './VideoCard.module.css'

export function VideoCard({resource}: {resource: ResourceCardData}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  return (
    <>
      <button type="button" className={cardStyles.card} onClick={() => dialog.current?.showModal()}>
        <CardBody resource={resource} />
      </button>
      <dialog ref={dialog} onClose={() => video.current?.pause()} className={styles.dialog} aria-label={resource.title}>
        <button type="button" onClick={() => dialog.current?.close()} className={styles.close} aria-label="Close">
          <X aria-hidden />
        </button>
        <video ref={video} src={resource.fileUrl!} controls preload="metadata" className={styles.video} />
      </dialog>
    </>
  )
}
```

```css
/* components/VideoCard.module.css */
.dialog {
  width: min(960px, 92vw);
  margin: auto;
  padding: 0;
  overflow: hidden;
  background: #000;
  border: 0;
  border-radius: var(--radius-lg);
}

.dialog::backdrop {
  background: rgb(0 0 0 / 0.7);
}

.close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 1;
  padding: var(--space-1);
  background: none;
  border: 0;
  color: #fff;
  cursor: pointer;
}

.video {
  width: 100%;
  aspect-ratio: 16 / 9;
}
```

> Video files stream straight from `cdn.sanity.io`, which supports HTTP range requests, so seeking works and `preload="metadata"` keeps a grid of video cards from downloading whole files on page load.

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

test('"/" is public, shows instructions, and lists no artists', async ({page}) => {
  const res = await page.goto('/')
  expect(res?.status()).toBe(200)
  await expect(page).toHaveURL('/') // no login redirect
  await expect(page.getByRole('heading', {name: 'Looking for your Vydia resources?'})).toBeVisible()
  await expect(page.locator('main a')).toHaveCount(0) // no artist links
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
- [ ] Uploaded videos play in the dialog, seeking works, and nothing downloads until play (`preload="metadata"`).
- [ ] `/` shows only the instructions, signed in or out, as an internal viewer or a client. No artist names anywhere.
- [ ] Keyboard: every card is focusable and opens with Enter, and the video dialog closes with Esc.
- [ ] Mobile layout (single column), and the header logo scales down.
- [ ] No Tailwind or global component classes: every component's styles live in its own `.module.css`, and `globals.css` contains only tokens, reset, and `.visually-hidden`.

---

## 14. Implementation To-Do List

The full build broken into phases and tasks. Each task points to the section of this plan that specifies it. Every phase ends with a **Done when** checkpoint; don't start a phase until the checkpoints it depends on pass.

**How to use this list**
- Task IDs (`3.4`) are stable, so reference them in commits and PRs (`feat(studio): change-URL action [3.4]`).
- 🧑‍🤝‍🧑 marks tasks that need someone else (product team, L&A, Google Workspace admin). Start those early because they block later phases.
- Phases 0, 2–3, and 6 can overlap. The critical path is **0 → 1 → 2 → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13**.

```
0 Accounts ─┬─► 1 Scaffold ─► 2 Schema ─┬─► 3 Studio UX ─► 4 Seed ──────────────┐
            │                           └─► 5 Data layer ─► 6 UI ─┐             │
            │                                                     ▼             ▼
            └──────────────────────────────► 7 Auth ─► 8 Access ─► 9 Cache ─► 10 Tests ─► 11 Deploy ─► 12 Migrate ─► 13 Handoff ─► 14 Post-prototype
```

---

### Phase 0: Accounts, access, and prerequisites

**Sanity** (§4.2)
- [x] **0.1** Create the Sanity project "Welcome to Vydia" and the `production` dataset.
- [x] **0.2** Set dataset visibility to **Private** (D2).
- [x] **0.3** Create a *Viewer* API token named `vercel-read` and store it in the password manager.
- [x] **0.4** Add CORS origins `http://localhost:3000` (allow credentials). The production origin is added in 11.6.
- [x] **0.5** 🧑‍🤝‍🧑 Invite `labelrelationships@vydia.com` and `creativeservices@vydia.com` with the **Editor** role. Confirm both can log in.
- [ ] **0.6** Check the current plan's asset storage, bandwidth, and API request quotas on sanity.io/pricing and write the numbers down (needed for 12.2).

**Supabase** (§4.3)
- [x] **0.7** Create the Supabase project (region close to Vercel's default, e.g. `us-east-1`).
- [x] **0.8** Auth → Providers → Email: enabled, **Confirm email ON**, minimum password length 8.
- [x] **0.9** Auth → Sessions: time-box **never**, inactivity timeout **never** (D11).
- [ ] **0.10** Auth → URL Configuration: Site URL `http://localhost:3000` for now. Redirect URLs `http://localhost:3000/**` and the Vercel preview pattern.
- [ ] **0.11** 🧑‍🤝‍🧑 Google Cloud: create an OAuth consent screen + OAuth client (web). Redirect URI `https://<project>.supabase.co/auth/v1/callback`. Paste the client ID/secret into Auth → Providers → Google.
- [ ] **0.12** 🧑‍🤝‍🧑 Choose an SMTP provider (Resend, SendGrid, or Vydia's existing one), verify the sending domain (SPF/DKIM), and enter the credentials in Auth → SMTP. Sender: `no-reply@welcometovydia.com` or similar.
- [ ] **0.13** Edit the **Confirm signup** and **Reset password** email templates to use the `token_hash` links from §4.3, with Vydia wording.

**Vercel and domain**
- [ ] **0.14** Create the Vercel project, link it to the GitHub repo, and set the framework preset to Next.js.
- [ ] **0.15** 🧑‍🤝‍🧑 Ask the product team for DNS control of (or records for) `welcometovydia.com`. The actual cutover happens in 11.4.

**Repo**
- [x] **0.16** Protect `main` (PRs required) and work on feature branches per phase.

**Done when:** all three dashboards are reachable, both shared Sanity logins work, a test confirmation email from Supabase arrives through the custom SMTP, and the Google provider is enabled.

**Current Status**
- Sanity: Viewer API token is created and saved, private dataset is set up, `labelrelationships@vydia.com` and `creativeservices@vydia.com` have not accepted their seats, I am the lone seat and admin at my personal account. I cannot find the asset storage, bandwidth, or API request quotas yet.
- Supabase: email is set, auth sessions are set, localhost configuration is set, vercel preview we are waiting on, waiting on premium vercel account.. No SMTP provider yet, we will use Resend jsut waiting on approval, use default supabase email for now.
- Google: Set up oauth client, added the information to Supabase to enable sign in with google.
- Vercel: waiting on Vercel premium account access, will recieve soon. DNS records will come much later as well.
- Repo: all good.

---

### Phase 1: Scaffold and conventions

- [x] **1.1** `npx create-next-app@latest . --ts --no-tailwind --eslint --app --src-dir=false --import-alias "@/*"` (§2). Confirm which Next version was installed (16 vs 15) and note it in the README; it decides `proxy.ts` vs `middleware.ts` and the `revalidateTag` signature.
- [ ] **1.2** Install dependencies from §2 (Sanity, Supabase, `@portabletext/react`, `lucide-react`, `server-only`, `pdfjs-dist`, Vitest, Playwright).
- [x] **1.3** Delete the starter page, starter CSS, and starter assets.
- [ ] **1.4** Create the route groups: `app/(site)/layout.tsx` and `app/studio/[[...tool]]/layout.tsx`, each with its own `<html>` root (§3, §6.4).
- [ ] **1.5** Write `app/(site)/globals.css`: tokens, reset, `.visually-hidden` (§11.1).
- [ ] **1.6** Load Source Sans 3 with `next/font` as `--font-source-sans` in the site layout (§11.1).
- [ ] **1.7** Add `lib/cx.ts` (§11.0) and `components/ui/controls.module.css` (§11.2).
- [ ] **1.8** Copy `docs/logo/gamma-vydia-white.svg` → `public/vydia-logo.svg`.
- [ ] **1.9** Add `lib/env.ts` and `sanity/env.ts` (§4.1). Create `.env.local` and `.env.example` (no secrets in git).
- [ ] **1.10** Add the shared slug helpers `lib/slug.ts` (§5.1).
- [ ] **1.11** Configure Vitest (`vitest.config.ts` with the `@/` alias) and add `npm run test`.
- [ ] **1.12** Add Prettier + `npm run lint` / `npm run typecheck` scripts.
- [ ] **1.13** Add a GitHub Actions workflow that runs lint, typecheck, and unit tests on every PR.
- [ ] **1.14** Write `tests/slug.test.ts` (§13.1) and make it pass.
- [ ] **1.15** Push and confirm Vercel builds a preview deployment.

**Done when:** `npm run dev` serves an empty page with the right font and background, CI is green, and Vercel produces a preview URL.

---

### Phase 2: Sanity content model

- [ ] **2.1** `sanity.cli.ts` with project/dataset and typegen config (§6.4).
- [ ] **2.2** Minimal `sanity.config.ts` (schema + `structureTool` only) and the embedded Studio route `app/studio/[[...tool]]/page.tsx` (§6.4). Confirm `/studio` loads and the shared login works locally.
- [ ] **2.3** `blockContent` type (§5.2).
- [ ] **2.4** `resource` type: title, type radio, file, url, cover image + alt, `pdfPreview` (plain image for now; custom input in 3.6), `addedOn` with `initialValue` now (§5.3).
- [ ] **2.5** `resource` conditional visibility: file hidden for links, url hidden for PDFs and videos (D14).
- [ ] **2.6** `resource` validation: mime type matches type, document-level file/url rules, title max length (§5.3).
- [ ] **2.7** `resource` preview (type label + date + thumbnail) and orderings (newest first, title).
- [ ] **2.8** `section` type: title, subtitle, ordered unique resource references, preview with count (§5.4).
- [ ] **2.9** `website` type: intro (required), sections (required, unique), `internalViewerEmails` with @vydia.com validation (§5.5).
- [ ] **2.10** `artist` type: field groups, name, slug with custom `slugify`, `isSlugAvailable` (current + previous slugs), reserved-word and pattern validation (§5.6).
- [ ] **2.11** `artist` hidden `slugLocked`, read-only `previousSlugs`, slug `readOnly` when locked.
- [ ] **2.12** `artist` `allowedEmails` with per-item email validation and the case-insensitive duplicate check.
- [ ] **2.13** `artist` `introOverride`, `additionalInfo`, `sectionOverride` (with the "replaces, doesn't add" description), hidden `customization` placeholder.
- [ ] **2.14** `artist` preview (`/slug · N allowed emails`).
- [ ] **2.15** Register everything in `schemaTypes/index.ts`.
- [ ] **2.16** Manually test every validation rule in Studio: wrong mime type, missing file, missing link, both file and link on a deck, invalid email, duplicate email in different case, reserved slug, duplicate slug.

**Done when:** every document type can be created, validated, and published in the local Studio, and each validation rule in 2.16 blocks publishing with a readable message.

---

### Phase 3: Studio editor experience

- [ ] **3.1** Desk structure: Website singleton pinned at top, Artists, Sections, Resources → All / Not in any section (§6.1).
- [ ] **3.2** Singleton guards: filter the `website` template from "new document", limit its actions to publish / discard / restore (§6.4).
- [ ] **3.3** `lockSlugOnPublish` wrapper around the publish action (§6.2). Test: publish a new artist → slug becomes read-only.
- [ ] **3.4** `changeUrlAction` (§6.2). Test: Change URL → old slug appears in Previous URLs → edit slug → publish → re-locks.
- [ ] **3.5** `openSiteAction` (§6.2). Test it opens `NEXT_PUBLIC_SITE_URL/<slug>` in a new tab.
- [ ] **3.6** `PdfPreviewInput` (§6.3): render page 1 with pdf.js, upload as an image asset, set the field.
- [ ] **3.7** `PdfPreviewInput` behaviour: auto-generate when a PDF has no preview, regenerate when the PDF is replaced, manual button, error message on failure.
- [ ] **3.8** Test the PDF preview with a portrait one-pager, a landscape deck exported to PDF, a large (>20 MB) PDF, and a password-protected PDF (should fail gracefully).
- [ ] **3.9** Decide where the pdf.js worker loads from (unpkg vs copied to `public/`) and finalise it (§6.3 note).
- [ ] **3.10** Vision tool loaded in development only.
- [ ] **3.11** Read every field title and description aloud as a non-developer would, and rewrite anything unclear.
- [ ] **3.12** Confirm strong references block deleting a resource that's still in a section, and a section that's still on the website or an artist.

**Done when:** you can run Flow 1 (create a microsite) and Flow 2 (edit resources → sections → website) from the research end to end in Studio without touching code, and the slug lock / Change URL / PDF preview all behave as specified.

---

### Phase 4: Seed and test content

- [ ] **4.1** Write `scripts/seed.ts` (§12) and run `npx sanity exec scripts/seed.ts --with-user-token`.
- [ ] **4.2** Confirm in Studio: the Website singleton has the intro text from the reference, plus the three sections in order.
- [ ] **4.3** Create test resources covering every case: PDF with cover, PDF without cover (auto preview), uploaded video, link (pitch form), slide deck as upload, slide deck as link, resource with a long title.
- [ ] **4.4** Add the test resources to the three sections.
- [ ] **4.5** Create test artists:
  - `test-artist`: default layout, your personal email allowed.
  - `test-override`: intro override, additional info, section override with one artist-specific section.
  - `test-renamed`: published, then renamed via Change URL (so it has a previous slug).
- [ ] **4.6** Create one resource that's in no section, and confirm it appears under "Not in any section".
- [ ] **4.7** Run `npx sanity typegen generate` and commit `lib/sanity/types.generated.ts`.

**Done when:** the dataset contains every content shape the site has to render, and the generated types compile.

---

### Phase 5: Server data layer

- [ ] **5.1** `lib/sanity/client.ts`: private client with token, `useCdn: false`, `perspective: 'published'` (§7.1).
- [ ] **5.2** `lib/sanity/fetch.ts`: `sanityFetch` with `force-cache` + type tags (§7.1).
- [ ] **5.3** `lib/sanity/queries.ts`: `ACCESS_QUERY`, resource and section projections, `ARTIST_PAGE_QUERY` (§7.2).
- [ ] **5.4** Swap the hand-written types (§7.3) for the generated ones where they match. Keep `ResourceCardData` and `SectionData` as named exports either way.
- [ ] **5.5** `lib/sanity/page.ts`: `getArtistPage` with the override rules (intro override, sections REPLACE) and dangling-reference filtering (§7.4).
- [ ] **5.6** `lib/sanity/image.ts` + `images.remotePatterns` for `cdn.sanity.io` in `next.config.ts` (§7.5). Confirm the `@sanity/image-url` export name for the installed version.
- [ ] **5.7** `lib/format.ts`: `formatAddedOn` in America/New_York (§11.4). Unit test: `2025-05-16T16:08:00Z` → `Added on May 16, 2025 at 12:08 PM`.
- [ ] **5.8** Unit-test `getArtistPage`'s override logic with a mocked `sanityFetch`: no override, intro override only, section override only, empty arrays treated as "no override", null references dropped.

**Done when:** a temporary server component can print the resolved data for `test-artist` and `test-override`, and the override unit tests pass.

---

### Phase 6: UI components (rendering, no auth yet)

Temporarily render `/[slug]` without the auth check (hard-code the artist ID lookup) so the UI can be built against real data. **This bypass is removed in 8.3.**

- [ ] **6.1** `PageShell` + `.module.css` (§11.2).
- [ ] **6.2** `Header` + `.module.css`: grain banner, centered logo, responsive height (§11.2).
- [ ] **6.3** `Notice` + `.module.css` (§11.2).
- [ ] **6.4** `RichText` + `.module.css`, and `Intro` (§11.3).
- [ ] **6.5** `ResourceSection` + `.module.css`: heading, optional subtitle, auto-fill grid (§11.4).
- [ ] **6.6** `FileTypeBadge` + `.module.css`: four colors, icons, screen-reader label (§11.4).
- [ ] **6.7** `CardCover` + `.module.css`: Sanity image with LQIP blur, branded placeholder tile (§11.4).
- [ ] **6.8** `CardBody` (shared) and `ResourceCard` + `.module.css`: link cards open in a new tab, card hover/focus states, reduced-motion handling (§11.4).
- [ ] **6.9** `VideoCard` + `.module.css`: `<dialog>` player, pause on close, Esc closes, focus returns to the card (§11.4).
- [ ] **6.10** Additional-info block styling (`[slug]/page.module.css`, §9.2).
- [ ] **6.11** Visual comparison with `docs/screenshots/sample website.png` side by side at 1440px: header proportions, intro typography, section titles, card border/radius/shadow, badge position, date line. Adjust tokens until it matches.
- [ ] **6.12** Responsive check at 375px, 768px, 1024px, 1440px: columns step 1 → 2 → 3 → 4 and the header logo scales.
- [ ] **6.13** Check all card states with the test content: with cover, auto PDF preview, placeholder, long title (wraps, date stays pinned), video, link, slides.
- [ ] **6.14** Grep for stray inline styles or global classes. Everything is in modules except tokens, reset, and `.visually-hidden` (D12).

**Done when:** `/test-artist` and `/test-override` render correctly against real Sanity data and match the reference at desktop and mobile sizes.

---

### Phase 7: Authentication

- [ ] **7.1** `lib/supabase/server.ts` and `lib/supabase/client.ts` (§8.1).
- [ ] **7.2** `lib/supabase/proxy.ts` + root `proxy.ts` (or `middleware.ts` on Next 15) with `PUBLIC_EXACT = ['/']`, the `/login` and `/auth` prefixes, and the matcher that excludes `/studio`, `/api/revalidate`, and static files (§8.2).
- [ ] **7.3** `lib/safe-redirect.ts` (§8.3) + unit tests: relative path OK, same-origin absolute OK, other origin → `/`, `//evil.com` → `/`, garbage → `/`.
- [ ] **7.4** Login server actions: `signIn`, `signUp` (same message whether the account exists or not), `requestPasswordReset` (§8.4).
- [ ] **7.5** `LoginForm` + `LoginForm.module.css`: sign-in / sign-up / reset modes, Google button, labelled inputs, error + success messages, invalid-link message (§8.4).
- [ ] **7.6** `login/page.tsx` using `PageShell` (§8.4).
- [ ] **7.7** `/auth/callback` route for Google (§8.5).
- [ ] **7.8** `/auth/confirm` route for email confirmation + recovery (§8.5).
- [ ] **7.9** `/auth/signout` route (POST, 303 to `/login`) (§8.5).
- [ ] **7.10** `/account/update-password` page: client form calling `updateUser({password})`, styled with `controls.module.css`.
- [ ] **7.11** Manually test every flow locally:
  - Sign up with email → confirmation email arrives → link lands on the original page, signed in.
  - Sign in before confirming → generic error.
  - Google sign-in → returns to `next`.
  - Forgot password → email → set a new password → signed in.
  - Sign out → back to `/login`.
- [ ] **7.12** Confirm the session cookie's max-age is long-lived (≈400 days) and that a session survives a browser restart.

**Done when:** every flow in 7.11 works on localhost, and every non-public route redirects to `/login?next=…` when signed out.

---

### Phase 8: Access control

- [ ] **8.1** `lib/access.ts`: `normalizeEmail`, `PERMANENT_VIEWERS` from env, `isInternalViewer`, `decideAccess`, `verifiedEmail`, `resolveArtistAccess` (§9.1).
- [ ] **8.2** `tests/access.test.ts` (§13.1): unknown, unapproved = unknown, case-insensitive + trim, permanent emails, internal viewers from the website, old-slug redirect only when allowed, no verified email.
- [ ] **8.3** Replace the Phase 6 bypass with the real `[slug]/page.tsx`: `getUser` → `resolveArtistAccess` → `notFound()` / `redirect()` / render (§9.2). **Remove the temporary bypass code.**
- [ ] **8.4** `[slug]/not-found.tsx` + `NoAccess` using `Notice`, with a "sign in with a different email" form (§9.2).
- [ ] **8.5** Static `metadata` with no artist name, and `noindex` on the site layout and artist page.
- [ ] **8.6** Root `/` instructions page: static, public, no session read, no Sanity query (§9.4, D13).
- [ ] **8.7** Manual matrix test, signed in as each persona against each slug:

  | Persona ↓ / Slug → | `test-artist` | old `test-renamed` slug | `does-not-exist` |
  |---|---|---|---|
  | Approved client | ✅ page | ↪ redirect to new slug | 404 NoAccess |
  | Unapproved client | 404 NoAccess | 404 NoAccess (no redirect) | 404 NoAccess |
  | `labelrelationships@` | ✅ page | ↪ redirect | 404 NoAccess |
  | Internal viewer from Website list | ✅ page | ↪ redirect | 404 NoAccess |
  | Signed out | → `/login` | → `/login` | → `/login` |

- [ ] **8.8** Diff the HTML of "unapproved on a real artist" against "anyone on a missing artist". It must be byte-identical apart from Next's per-request IDs.
- [ ] **8.9** Remove an email from `test-artist` in Studio and confirm that user loses access on the next load (it works once Phase 9 is done; until then, restart dev).
- [ ] **8.10** Mixed-case test: add `Jane.Doe@Example.com` in Studio, sign in as `jane.doe@example.com` → allowed.

**Done when:** every cell in the 8.7 matrix behaves as shown, 8.8 shows no difference, and the access unit tests pass.

---

### Phase 9: Caching and publish webhook

- [ ] **9.1** `/api/revalidate` route with `parseBody` signature check and type-tag revalidation (§10). Use the `revalidateTag` signature for the installed Next version.
- [ ] **9.2** Generate `SANITY_REVALIDATE_SECRET` and add it to `.env.local` and Vercel (Preview + Production).
- [ ] **9.3** Create the Sanity webhook pointed at the **preview** deployment first, with filter, projection `{_type}`, and the secret (§10).
- [ ] **9.4** Test on the preview deployment: edit a resource title → publish → reload `/test-artist` → new title shows within seconds.
- [ ] **9.5** Test each type: website intro, section order, artist allowed emails (revocation), resource delete.
- [ ] **9.6** Test a bad signature → 401, and an unknown `_type` → 400.
- [ ] **9.7** Check the webhook attempt log in sanity.io/manage shows 200s.

**Done when:** every edit type in 9.5 appears on the deployed preview without a redeploy.

---

### Phase 10: Testing and hardening

- [ ] **10.1** Create Supabase test users for e2e (`approved`, `outsider`) and a Playwright global setup that signs in and saves `storageState` files (gitignored).
- [ ] **10.2** Write `tests/e2e/access.spec.ts` (§13.2): signed-out redirects, `/` is public with no links, unknown vs forbidden identical, approved user sees content.
- [ ] **10.3** Add e2e tests: old slug redirects for an approved user, the video dialog opens and closes, link cards have `target="_blank"` and `rel="noopener noreferrer"`.
- [ ] **10.4** Run Playwright against the Vercel preview in CI (on PRs to `main`).
- [ ] **10.5** Security headers in `next.config.ts` for site routes: `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` minimal. Exclude `/studio` if they break it.
- [ ] **10.6** Confirm no server-only module ends up in a client bundle (`server-only` import errors would show at build). Grep the client build output for `SANITY_API_READ_TOKEN`.
- [ ] **10.7** Confirm the Sanity dataset rejects unauthenticated queries (`curl` the public API without a token → no documents).
- [ ] **10.8** Accessibility: keyboard-only walk-through (cards, video dialog, login form), axe/Lighthouse a11y ≥ 95, color contrast of the muted date text, alt text on cover images.
- [ ] **10.9** Performance: Lighthouse on `/test-artist` (mobile). LCP image is the header logo (`priority`), covers are lazy, no layout shift from cards.
- [ ] **10.10** Run the full manual QA checklist (§13.3) and record the results in the PR.

**Done when:** CI runs unit + e2e green against preview, every §13.3 item passes, and Lighthouse a11y ≥ 95.

---

### Phase 11: Production deploy and domain

- [ ] **11.1** Add all env vars to Vercel **Production** with production values (`NEXT_PUBLIC_SITE_URL=https://welcometovydia.com`).
- [ ] **11.2** Supabase: Site URL → `https://welcometovydia.com`, and add `https://welcometovydia.com/**` to the redirect URLs.
- [ ] **11.3** Google OAuth consent screen: add the production domain, and publish the app (out of "testing" mode) so any Google account can sign in.
- [ ] **11.4** 🧑‍🤝‍🧑 Add `welcometovydia.com` (and `www` → apex redirect) in Vercel. The product team creates the DNS records. Wait for SSL.
- [ ] **11.5** Point the Sanity webhook at `https://welcometovydia.com/api/revalidate` (or add a second production webhook and keep preview).
- [ ] **11.6** Add `https://welcometovydia.com` to Sanity CORS origins with credentials.
- [ ] **11.7** Smoke test production: `/` instructions, `/studio` login with both shared accounts, sign-up email arrives from the custom SMTP sender, Google login, `/test-artist` renders, publish → refresh works.
- [ ] **11.8** Delete or unpublish the test artists in production (or keep `test-artist` for monitoring, allowed only to your email).

**Done when:** the smoke test in 11.7 passes on the real domain.

---

### Phase 12: Seismic content migration

- [ ] **12.1** 🧑‍🤝‍🧑 Get the full Seismic asset list from L&A (the screenshot rows scroll, so there are more than shown in §12.1). Record title, type, section, original "Added on" date, and whether it has a custom thumbnail.
- [ ] **12.2** Add up the size of all the videos. Compare against the quotas from 0.6. If they don't fit, raise the Sanity plan upgrade **before** uploading (D14).
- [ ] **12.3** Re-encode any oversized videos to MP4/H.264 at 1080p max.
- [ ] **12.4** For each asset: create the Resource → upload the file or paste the link → set **Added on** to the Seismic date → add the cover photo if Seismic had one → check the auto PDF preview → publish.
- [ ] **12.5** Add each resource to its section in the Seismic order, and publish the sections.
- [ ] **12.6** Check "Not in any section" is empty (or only holds intentional leftovers).
- [ ] **12.7** Side-by-side check of a production artist page against the Seismic page: every resource is present, in order, with matching dates.
- [ ] **12.8** Spot-check every file opens (PDFs open in a new tab, videos play, links go to the right forms).
- [ ] **12.9** Check asset usage in sanity.io/manage after the upload and set a monthly reminder to re-check (§15).
- [ ] **12.10** 🧑‍🤝‍🧑 Create artist records for any current clients being moved off Seismic, with their allowed emails (or leave that to L&A as their first real task after the Loom).

**Done when:** the production site shows the full Seismic library and L&A agrees it matches.

---

### Phase 13: Handoff

- [ ] **13.1** Write `README.md`: what the app is, local setup, env vars, the deploy flow, where each dashboard lives, how to rotate the Sanity token and webhook secret.
- [ ] **13.2** Write a short `docs/editor-guide.md` (a text version of the Loom for quick reference).
- [ ] **13.3** Record the Loom walkthrough following the §16 outline (all 9 steps), using the production Studio.
- [ ] **13.4** 🧑‍🤝‍🧑 Present the prototype to L&A and Creative Services: live demo of Flow 1 and Flow 2, then the client view.
- [ ] **13.5** 🧑‍🤝‍🧑 Go through the open questions (§17) in that meeting and record the answers in this plan.
- [ ] **13.6** 🧑‍🤝‍🧑 Hand over credentials: confirm L&A and Creative Services know the shared Sanity logins, and who owns the Vercel/Supabase/Sanity accounts and billing going forward.
- [ ] **13.7** Sunset plan for the Seismic link: agree a date with L&A, and how existing clients get their new link.

**Done when:** L&A has created at least one real artist microsite on their own, without developer help.

---

### Phase 14: Post-prototype (after the review in 13.4)

Scope depends on the answers to §17. Placeholders:

- [ ] **14.1** Implement the agreed customization fields in `artist.customization` (e.g. profile picture, background image) and unhide the group.
- [ ] **14.2** Render the customization on the artist page (new components, each with its `.module.css`).
- [ ] **14.3** If per-person audit trails are required: request more Sanity seats or document the shared-login trade-off.
- [ ] **14.4** If sensitive files are ever uploaded: build the authenticated `/api/files/[id]` proxy (§15).
- [ ] **14.5** Re-check Sanity usage after one month of real traffic and adjust the plan if needed.

---

## 15. Risks and Mitigations

| Risk (research) | Mitigation in this plan |
|---|---|
| **URL stability**: renames break bookmarks | Slug generated once, locked on first publish (§6.2). Renaming the artist doesn't touch the slug. "Change URL…" keeps old slugs as redirects. Uniqueness checked across current + previous slugs, reserved words blocked, `slugify` handles accents/`&`/punctuation. |
| **"Added on" dates** reflect edits | Explicit `addedOn` field, initialised on create and editable for migration. GROQ falls back to `_createdAt`, never `_updatedAt`. |
| **Missing cover photos** | Three-step fallback: cover → auto PDF preview → branded grain tile that matches the existing thumbnail style. The card layout is identical in every case (fixed 16:9 cover box). |
| **Global edits look like failed publishes** | Type-tagged cache + signed webhook with immediate expiry (§10). Pages refresh within seconds. |
| **Sanity storage/bandwidth for videos** | **Decision: videos stay in Sanity** (D14). Still unverified whether the quotas are enough. Before migrating, check the current plan's asset storage and bandwidth on sanity.io/pricing against the total size of the Seismic videos. Keep files small: MP4/H.264 at 1080p max (guidance is in the field description). Cards use `preload="metadata"`, so bandwidth is only spent when someone presses play. Watch usage in sanity.io/manage after launch. If the numbers don't fit, the answer is a higher Sanity plan, not a different host. |
| **Public asset URLs** in a private dataset | Acceptable for client-facing collateral. If needed later: `/api/files/[id]` route that checks the session + an allowed artist before streaming from Sanity, with cards linking there instead of `cdn.sanity.io`. |
| **Roster enumeration** | Proxy gates every artist path before any Sanity lookup. Denied = unknown (§9.3). Static metadata. `noindex`. Private dataset. `/` is a static instructions page with no artist list for anyone (D13). |
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
8. **Troubleshooting**: "Client says they can't see the page" → check the email spelling on the artist and confirm they verified their email or used Google. "Client went to welcometovydia.com" → the home page only shows instructions, so resend their personal link.
9. **Viewing any artist's page yourself**: use *Open site* on the artist in Studio. There's no list of artists on the website itself.

---

## 17. Open Questions (carry into the prototype review)

From research:
- Is a single shared Sanity login per team acceptable (no individual change tracking)?
- Customization: artist profile picture? Custom background images? Anything else? (The `artist.customization` object is already in the schema, hidden, ready for this.)

Raised while planning:
- Is it fine that Sanity file URLs are public-if-known, or do we need the authenticated file proxy?
- Who owns the Supabase/Sanity/Vercel accounts long term (billing, seat changes)?
- Should the date line show for link-type resources (pitch forms)? The reference shows it, so the plan keeps it.

Resolved in plan review:
- ~~Should internal emails see an artist index at `/`?~~ **No.** `/` is a static instructions page for everyone (D13, §9.4).
- ~~Do videos stay in Sanity?~~ **Yes.** Upload only, no external video links (D14). Quotas still get checked before migration (§15).
- ~~Tailwind?~~ **No.** CSS Modules with shared tokens (D12, §11.0).

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
| Designated internal emails see every site | `website.internalViewerEmails`, §9.1. Reached via Studio "Open site" (§6.2), not an index |
| `/` gives instructions, no roster | §9.4 (D13) |
| Videos hosted in Sanity | `resource` video = upload only, §5.3 (D14) |
| Sign in before "doesn't exist" | Proxy §8.2 |
| Unknown vs. unapproved indistinguishable | §9.2–9.3, e2e §13.2 |
| Non-aggressive sessions | §4.3, §8.2 (D11) |
| Email confirmation for password sign-ups | §4.3, §8.5, `verifiedEmail()` |
| Case-insensitive email matching | `normalizeEmail`, Studio duplicate check |
| Publish webhook refreshes pages | §10 |
| L&A can manage without a developer | §6, §16 |
| Resource not in a section is invisible | §7.4 + "Not in any section" §6.1 |
