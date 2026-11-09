# Iteration Two: Implementation Plan

> Spec: [`docs/iteration-two.md`](./iteration-two.md). Builds on [`docs/plan.md`](./plan.md) (D1–D15) and [`docs/sign-in-plan.md`](./sign-in-plan.md) (D16–D22). Decisions here continue the numbering from **D23**.
>
> **Owner decisions (2026-11-09):** admins see artist pages directly (D32); magic links sign in straight away with no Continue page (D33); per-artist additional info is dropped (D41); the sender address stays a placeholder for now (§11); public, unguessable image URLs are fine, including for exclusive resources (D35); covers keep the same blur-up style as today (D42); abandoned uploads are cleaned by a manual sweep (D43); `labelservices@` and `creativeservices@` are both seeded as admins (D44). See §17.
>
> **Supabase project:** iteration two runs on the **new** project `lsihwkbnrheczirlkswo` (already in `.env.local`). Its auth, email, and Google settings have to be set up again, see §12.
>
> Next.js in this repo is 16.4 (`cacheComponents` on, `proxy.ts` instead of middleware). The Next-specific parts of this plan were checked against `node_modules/next/dist/docs/` (Proxy, Server Actions, `refresh()`, Authentication with Cache Components).

---

## 0. TL;DR

Iteration one is a Sanity-backed microsite. Sanity holds artists, resources, and allow-lists, and Supabase handles sign-in. Iteration two moves **everything into Supabase**, removes Sanity at runtime, and adds an **admin panel** inside the Next app:

| Area | Today (iteration one) | Iteration two |
|---|---|---|
| Content + access data | Sanity (private dataset, cached with `'use cache'`, webhook revalidation) | Supabase Postgres + Storage, read **per request with the visitor's JWT under RLS**. No server cache. |
| Editing | Sanity Studio at `/studio` | `/admin` (Google SSO, `admins` table, `@vydia.com` only) |
| Artist sign-in | `/login` page: Google **or** magic link. The response never says whether an email is approved. | Inline on `/[slug]`: magic link **only**. The server checks *email × slug* **before** sending and shows an explicit "not approved" message. |
| Signed-out visitor on `/[slug]` | Proxy redirects to `/login?next=…` | `/[slug]` renders the **Enter your email** screen in place, with no redirect |
| Denied / unknown slug | Identical "This page isn't available" screen with a sign-out button | Identical **Enter your email** screen. No sign-out, no "no access" page. |
| Internal viewers | `PERMANENT_VIEWER_EMAILS` + Website → Internal viewers | Gone. Admins (Google) can preview any page. Nobody else gets blanket access. |
| Slug renames | `previousSlugs`, old URLs redirect | No history. An old slug behaves like any unknown slug. Admins see a warning before saving. |
| Per-artist resources | `resourceOverride` **replaces** the global list | Main resources minus per-artist **hides**, plus per-artist **exclusive** resources |
| Grid view | One flat grid | **Grouped by category** |
| Extra artist text | `additionalInfo` rich text | Dropped (D41) |
| Email link | Opens a "Finish signing in" page; **Continue** creates the session | Opens the session directly (GET), then redirects to `/[slug]` (D33) |
| Admins on artist pages | n/a (Studio users were permanent viewers) | Admins signed in with Google see every artist page directly (D32) |

The security model in one sentence: **Postgres RLS is the gate**. Every artist-page load runs one RPC as the signed-in user. RLS returns the artist only if the user's verified email is linked to it *right now*, so removing an email takes effect on the next load even though sessions never expire.

---

## 1. How the current app works (baseline)

This is what we're changing. File references are to the current tree.

### 1.1 Request flow today

```
GET /lil-example
  └─ proxy.ts → lib/supabase/proxy.ts updateSession()
       ├─ getClaims() refreshes the Supabase session, re-sets 400-day cookies
       └─ no claims and path not in ['/', '/login*', '/auth*'] → 307 /login?next=/lil-example
  └─ app/(site)/[slug]/page.tsx  (instant = false)
       └─ loadArtistPage(slug) (React cache(), shared with generateMetadata)
            ├─ supabase.auth.getUser()        → no user → redirect /login
            ├─ resolveArtistAccess(slug,user) → lib/access.ts
            │    └─ sanityFetch(ACCESS_QUERY)  ('use cache', cacheLife max, tags artist/website)
            │    └─ decideAccess(): permanent viewers ∪ internal viewers ∪ artist.allowedEmails
            ├─ denied   → notFound() → [slug]/not-found.tsx → <NoAccess/> (200 under PPR, see D15)
            ├─ redirect → previous slug → redirect(/canonical)
            └─ granted  → getArtistPage(artistId) (lib/sanity/page.ts: override REPLACES website.resources)
  └─ <ViewModeProvider><PageShell fullscreen artistName><ResourceViews/></PageShell></ViewModeProvider>
```

### 1.2 Sign-in today

- `app/(site)/login/actions.ts` `sendMagicLink`: returns `{sentTo}` immediately. In `after()` it checks `canSignIn(email)` (approved on **any** artist) and calls `signInWithOtp` with the stateless client (`lib/supabase/stateless.ts`, implicit flow, token-hash links).
- `signInWithGoogle`: a server action with the PKCE verifier cookie set by `Set-Cookie` (D21). `/auth/callback` signs out unapproved Google accounts (D20).
- `/auth/confirm` is a page with a **Continue** button (D18, against email scanners). `confirmSignIn` calls `verifyOtp({type:'email', token_hash})`.
- Sessions never expire: no Supabase time-box or inactivity timeout, plus `@supabase/ssr` 400-day cookies refreshed by the proxy (D11). There's no browser Supabase client (D21).

### 1.3 UI today

- `PageShell` → `Header` (greeting `"{artist} | Welcome to Vydia"`, a view toggle when inside `ViewModeProvider`) + `Footer`.
- `ResourceViews` → `ResourceCarousel` (3D cover-flow on a native scroll-snap container, with inertia, drag, trackpad and backdrop crossfade) or `ResourceGrid` (flat `<ul>`). View switches use View Transitions keyed on `data-morph-id={resource._id}` (`ViewMode.tsx`).
- Cards: `ResourceCard` → `<a target=_blank>` for pdf/link/slides, `VideoCard` (`<dialog>` + `<video>`) for video. `CardCover` uses the Sanity image builder (`urlFor`, `coverSource` for crop/hotspot) and the Sanity `lqip`. The fallback is a branded tile.
- Styling: CSS Modules + tokens in `app/(site)/globals.css` (D12, no Tailwind).

### 1.4 What survives, what changes, what goes

| Keep as-is | Change | Delete |
|---|---|---|
| `PageShell`, `Header`, `Footer`, `ResourceCarousel`, `VideoCard`, `ViewMode`, `useScrollInertia`, CSS tokens | `[slug]/page.tsx`, `ResourceGrid` (categories), `ResourceViews`, `CardCover`/`CardBody`/`ResourceCard` (Supabase URLs, type label), `lib/supabase/proxy.ts` (gate `/admin` only), `/auth/confirm` (page + action → one GET route handler, failures go to the expired screen), `lib/slug.ts` (3–60 chars), `lib/access.ts` (→ small helpers), `next.config.ts` (image host), e2e fixtures | `/login/*`, `/auth/callback` (moves to admin), `/auth/signout`, `NoAccess`, `[slug]/not-found.tsx`, `RichText`, `/studio`, `/api/revalidate`, `lib/sanity/*`, `sanity.config.ts`, `sanity.cli.ts`, `sanity/*` **except `sanity/schema.json`**, `scripts/seed.ts` |

---

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D23 | **Supabase is the only runtime data source.** Sanity is read once by `scripts/migrate-sanity.ts`, then the Sanity packages and Studio are removed. `sanity/schema.json` stays in the repo as the frozen field contract. | Spec: "The app reads Sanity once, for the migration, and never at runtime" and "`/sanity/schema.json` is the source of truth". |
| D24 | **RLS is the access gate. Artist data is read with the visitor's own JWT, never with a privileged key.** One `security invoker` RPC (`get_artist_page`) returns the artist plus visible resources, or `null`. | "Enforced with Supabase RLS, not just in the UI." The query sees the live `artist_emails` rows on every request. |
| D25 | **No server-side caching of artist data.** Drop `'use cache'`, `cacheTag`, and the revalidate webhook. | Cached data can't depend on the caller's JWT (`'use cache'` can't read cookies), and "changes apply to every artist immediately". At this scale one indexed RPC per load is cheap. |
| D26 | **One `resources` table for main and exclusive resources.** `artist_id IS NULL` means main, otherwise exclusive to that artist. Hides go in `artist_hidden_resources`. | One shape maps 1:1 to the Sanity `resource` type, and one query renders the page. A check trigger keeps hides pointing only at main resources. |
| D27 | **Field names: Sanity's camelCase names are canonical.** TS domain types use them exactly (`coverImage`, `pdfPreview`, `addedOn`, `sortOrder`). Postgres uses the snake_case spelling of the same name (`cover_image`, …). One mapping table, plus a unit test that reads `sanity/schema.json` to enforce it. | Unquoted Postgres identifiers fold to lowercase (`coverImage` → `coverimage`), so a literal camelCase column would need quoting everywhere. A mechanical, tested mapping keeps "same names" without that cost. |
| D28 | **The Sanity schema gains `category` (required string) and `sortOrder` (integer) first**, before the migration. `schema.json` is re-extracted. | Spec: "add it to the Sanity schema first so the 1:1 mapping holds". |
| D29 | **The sign-in pre-check runs with a server-only secret key** (`SUPABASE_SECRET_KEY`, used only in `lib/supabase/service.ts`) through a `security definer` RPC that isn't granted to `anon`/`authenticated`. | If the publishable key could call `email_can_access_slug`, anyone could probe *email × slug* pairs straight against PostgREST and skip our rate limit. This **reverses** iteration one's "the app never reads the service key". |
| D30 | **A "Before User Created" auth hook (Postgres function) blocks self-signup at the source.** Email-provider users are created only if the email is on some artist and isn't an admin. Google users only if listed in `admins`. | Success state: "no user is created in Supabase" for unapproved emails, and "a non-admin Google account is rejected". This replaces D20's sign-in-then-sign-out. |
| D31 | **`is_admin()` requires an OAuth (`amr` method `oauth`) session plus a row in `admins` plus `@vydia.com`.** Magic-link requests for admin emails are refused. | "Admins sign in only with Google SSO." Supabase auto-links identities by email, so without the `amr` check a magic-link session for an admin address would carry admin rights. |
| D32 | **Admins see every artist page directly** while signed in with Google. `can_view_artist()` and `resources_read` include `is_admin()`, so `/[slug]` renders the resources page for them, and the admin detail page links to it ("Open page"). | **Owner decision.** It replaces the old permanent/internal viewers for label services, and no separate preview route is needed. |
| D33 | **The email link signs in directly. This reverses D18.** `/auth/confirm` becomes a GET route handler: `verifyOtp({token_hash})` → session cookies → redirect to `/[slug]`. The Continue page and its server action are deleted. Any failure redirects to "This link has expired". Links are still verified by `token_hash` (D19), so they work in any browser. | **Owner decision**, matching the spec's "Artist clicks the magic link → session is created → redirected". Accepted trade-off: an email security scanner that opens links (Outlook Safe Links, Mimecast) can spend the single-use token first, and the artist then sees the expired screen and requests a new link (§16). |
| D34 | **Rate-limit `sendLink`** per IP (20 per 10 min) and per email (one send per 60 s), in a `private` schema that only the secret key can reach. | The form now tells you whether an email is approved for a slug, by design. That makes it a pair-probing oracle unless it's throttled. The 60 s per-email cooldown is a business rule. |
| D35 | **Files go in a private bucket (`resource-files`) and are served through `/api/resources/[id]/file`.** That route checks RLS with the visitor's JWT, then 302s to a 1-hour signed URL. **Images go in a public bucket (`resource-images`)** under unguessable UUID paths, for main **and** exclusive resources. | Exclusive PDFs and decks must never reach other artists. Cover images have to work with `next/image` (its optimizer fetches without cookies). **Owner decision:** a public but unguessable image URL is acceptable, including covers and PDF first-page previews of exclusive resources. |
| D36 | **Uploads go straight from the admin's browser to Storage via signed upload URLs.** The URL is issued by an admin-checked server action. | Server Actions cap request bodies at 1 MB and Vercel functions at about 4.5 MB, and videos are far larger. |
| D37 | **Create *and* edit both save through one transactional RPC, `save_artist(payload jsonb)`.** It upserts the artist and replaces its emails, hides, and exclusive resources. | Spec: the create is "all or nothing (RPC)". The edit screen also has a single **Save**, so the same atomicity applies there. |
| D38 | **Categories are normalized on write.** A trigger reuses the existing spelling when a new category matches one case-insensitively, and the UI groups by `lower(trim(category))` too. | "getting started" and "Getting Started" group together, and every page shows one canonical label. |
| D39 | **Orphaned storage objects are queued by a DB trigger and removed by the server action** after a successful save or delete. | It runs on cascades (artist delete) and on file replacement without extra bookkeeping in each action. |
| D40 | **`zod` (v4) validates every action payload and the migration input.** It shares the same rules as the DB checks. | Server actions are public endpoints. Field errors come back to the form before Postgres raises. |
| D41 | **Per-artist additional info (`additionalInfo`) is dropped.** There's no column, no admin field, and nothing under the grid. `RichText`, `@portabletext/react`, and the grid's `additionalInfo` slot are deleted. The migration doesn't read it. | **Owner decision.** It isn't in the spec. |
| D42 | **Covers keep today's blur-up style.** Each image stores its LQIP (a tiny base64 JPEG like Sanity's `metadata.lqip`) in `cover_image_lqip` / `pdf_preview_lqip`. The migration copies Sanity's LQIP as-is. Admin uploads generate it in the browser. `CardCover` keeps `placeholder="blur"` and the carousel backdrop keeps its instant placeholder layer. | **Owner decision:** the style should be the same. These are asset-metadata columns (Sanity keeps LQIP on the asset, not the document), so the field contract (§5) is unchanged. |
| D43 | **Abandoned uploads are cleaned by a manual sweep** (`npm run storage:sweep`, dry run by default). Deletes and replacements are already cleaned automatically (D39). | **Owner decision.** No cron job needed at this volume. |
| D44 | **`labelservices@vydia.com` and `creativeservices@vydia.com` are both seeded into `admins`** by the migration. Individuals (e.g. `mason.omara@`, `erica.johnson@`) are added by hand in the table editor. | **Owner decision.** They were permanent viewers in iteration one. As admins they keep seeing every artist page (D32) and can also edit. They must be real Google Workspace accounts to sign in. |

---

## 3. Target architecture

### 3.1 Routes

| Route | Type | Access | Notes |
|---|---|---|---|
| `/` | page | public | Instructions (copy updated: "open the link label services sent you") |
| `/[slug]` | page | everyone | Resources page **or** Enter your email. Always 200, never redirects. |
| `/auth/confirm` | route handler (GET) | public | `verifyOtp` → session → 302 `/[slug]`, or 302 `/auth/expired` |
| `/auth/expired` | page | public | "This link has expired" + button back to `/[slug]` |
| `/api/resources/[id]/file` | route handler | RLS | 302 to a signed URL, 404 otherwise |
| `/admin/login` | page | public | **Sign in with Google**, `?error=no-access` → "You don't have access." |
| `/admin/auth/callback` | route handler | public | PKCE exchange → `claim_admin_profile()` → `/admin` or sign out |
| `/admin/auth/signout` | route handler (POST) | admin | Admin-only sign-out (artists have none) |
| `/admin` | page | admin | Artist index |
| `/admin/artists/new` | page | admin | New artist form |
| `/admin/artists/[id]` | page | admin | Welcome link + Copy, edit form, Delete |
| `/admin/resources` | page | admin | Main resources by category, CRUD, drag to reorder |

### 3.2 Directory layout

```
app/
  (site)/                         root layout #1 (dark, Public Sans), unchanged layout.tsx
    page.tsx                      instructions
    [slug]/page.tsx               resources | <EnterEmail/>
    [slug]/EnterEmail.tsx         client: form, sent state, 60 s resend
    [slug]/actions.ts             sendLink server action
    auth/confirm/route.ts         GET: verifyOtp → redirect (D33)
    auth/expired/page.tsx
  (admin)/                        root layout #2 (light, desktop-first)
    layout.tsx
    admin.css
    admin/login/{page.tsx,actions.ts}
    admin/auth/callback/route.ts
    admin/auth/signout/route.ts
    admin/(panel)/layout.tsx      requireAdmin() + nav (Artists, Resources) + avatar
    admin/(panel)/page.tsx        artist index
    admin/(panel)/artists/new/page.tsx
    admin/(panel)/artists/[id]/page.tsx
    admin/(panel)/artists/actions.ts
    admin/(panel)/resources/page.tsx
    admin/(panel)/resources/actions.ts
    admin/(panel)/uploads/actions.ts
  api/resources/[id]/file/route.ts
components/                       artist-side components (existing)
components/admin/                 ArtistForm, EmailRows, MainResourcePicker, ResourceEditor,
                                  CategoryInput, SortableResourceList, CopyLinkButton, ConfirmDialog
lib/
  supabase/{server,proxy,stateless,service,database.types}.ts
  resources/{types,mapping,group,schema}.ts
  artist-page.ts                  getArtistPage() (server-only)
  admin/{auth,storage,upload}.ts
  validation.ts                   zod schemas shared by actions + migration
  slug.ts, email.ts, env.ts, form.ts, safe-redirect.ts, greeting.ts, cx.ts, format.ts
supabase/
  config.toml                     local dev + auth hook wiring
  migrations/20261110000000_iteration_two.sql
  tests/rls.test.sql              pgTAP
  templates/{magic-link,confirm-signup}.html
scripts/
  migrate-sanity.ts               one-time
  e2e-fixtures.ts                 rewritten for Supabase
sanity/schema.json                frozen contract (kept)
```

Two root layouts (`(site)` and `(admin)`) are fine: Next does a full page load when you cross them, and admin CSS never leaks into the artist pages. The static `admin` segment wins over `[slug]`, and `admin` is already in `RESERVED_SLUGS`.

### 3.3 Artist request flow (new)

```
GET /lil-example
  └─ proxy: updateSession() refreshes cookies. Artist paths are NEVER redirected.
  └─ [slug]/page.tsx → getArtistPage('lil-example')    (React cache, shared with metadata)
       ├─ slug fails SLUG_PATTERN / reserved     → null
       ├─ no claims (signed out)                 → null
       └─ rpc('get_artist_page', {p_slug})        (security invoker → RLS)
             ├─ artist row invisible (unknown / deleted / renamed / not linked) → null
             └─ {artist:{id,name}, resources:[...main − hidden..., ...exclusive...]}
  ├─ null   → <PageShell><EnterEmail slug/></PageShell>     title "Welcome to Vydia"
  └─ page   → <ViewModeProvider><PageShell artistName><ResourceViews groups/></…>

POST (server action sendLink {email, slug})
  ├─ invalid email                          → {status:'invalid'}
  ├─ IP over 20/10 min                      → {status:'rate-limited'}
  ├─ rpc email_can_access_slug (secret key) → false → {status:'not-approved'}   ← same for unknown slug
  ├─ per-email cooldown active              → {status:'sent'} (no new email)
  └─ signInWithOtp({email, emailRedirectTo: SITE_URL/slug, shouldCreateUser:true}) → {status:'sent'}

Email → GET /auth/confirm?token_hash…&redirect_to=https://welcometovydia.com/lil-example
  └─ verifyOtp → new session cookies (replace any previous session) → 302 /lil-example
  └─ failure (expired, used, bogus) → 302 /auth/expired?next=/lil-example
```

---

## 4. Database (one migration)

`supabase/migrations/20261109212557_iteration_two.sql` is the source of truth. The SQL in this section was the design; building and testing it found the following changes, which the migration has and the snippets below don't:

- `resources_read` calls a new `security definer` function, `can_view_main_resource(id)`. The inline `artist_emails` subquery shown in §4.4 would have hidden every main resource from artist users.
- `private.queue_resource_garbage` is `security definer` (§4.2).
- `save_artist` deletes with `not exists` instead of `not in`, and rejects a payload with a missing email or resource id (§4.6).
- Every function is explicitly revoked from `public` and `anon` before it is granted to the roles that need it, and `is_admin()` coalesces a null email to false.
- Config changes (like the auth hook) need `supabase stop && supabase start`, not `db reset`.

The schema is managed with the Supabase CLI. Local dev runs `supabase start`. `supabase db push` needs `--remote` to touch the hosted project.

### 4.1 Types, domains, tables

```sql
-- Emails are always stored trimmed + lowercase; comparisons are plain equality.
create domain public.email_address as text
  check (value = lower(btrim(value)) and value ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');

-- Must match RESOURCE_TYPES in lib/resources/types.ts and sanity/schema.json (tests/schema-parity.test.ts).
create type public.resource_type as enum ('pdf', 'video', 'link', 'slides');

create table public.admins (
  email        public.email_address primary key check (email like '%@vydia.com'),
  display_name text,
  avatar_url   text,
  user_id      uuid unique references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  last_sign_in_at timestamptz
);
comment on table public.admins is 'Managed by hand in the Supabase table editor. Add the email; name/avatar fill in on first Google sign-in.';

create table public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 100),
  slug       text not null unique
             check (char_length(slug) between 3 and 60
                    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                    -- keep in sync with RESERVED_SLUGS in lib/slug.ts
                    and slug not in ('admin', 'api', 'auth', 'login', 'logout', 'account', 'studio', 'static')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artist_emails (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists (id) on delete cascade,
  email      public.email_address not null,
  label      text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (artist_id, email)
);
create unique index artist_emails_one_primary on public.artist_emails (artist_id) where is_primary;
create index artist_emails_email on public.artist_emails (email);

create table public.resources (
  id                  uuid primary key default gen_random_uuid(),
  artist_id           uuid references public.artists (id) on delete cascade,  -- null = main resource
  title               text not null check (char_length(btrim(title)) between 1 and 120),
  type                public.resource_type not null,
  file                text,   -- object path in bucket resource-files
  url                 text check (url ~ '^https?://'),
  cover_image         text,   -- object path in bucket resource-images
  cover_image_alt     text,
  cover_image_hotspot jsonb check (cover_image_hotspot is null or (cover_image_hotspot ? 'x' and cover_image_hotspot ? 'y')),
  cover_image_lqip    text check (cover_image_lqip is null or (cover_image_lqip like 'data:image/%' and char_length(cover_image_lqip) <= 4096)),  -- D42
  pdf_preview         text,   -- object path in bucket resource-images
  pdf_preview_lqip    text check (pdf_preview_lqip is null or (pdf_preview_lqip like 'data:image/%' and char_length(pdf_preview_lqip) <= 4096)),  -- D42
  category            text not null check (char_length(btrim(category)) > 0),
  sort_order          integer not null default 0,
  added_on            timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Same per-type rules as the Sanity document validation (sanity/schemaTypes/resource.ts).
  constraint resources_target check (
    case type
      when 'pdf'    then file is not null and url is null
      when 'video'  then file is not null and url is null
      when 'link'   then url  is not null and file is null
      when 'slides' then (file is null) <> (url is null)
    end
  ),
  constraint resources_preview_only_pdf check (pdf_preview is null or type = 'pdf')
);
create index resources_main_order on public.resources (sort_order) where artist_id is null;
create index resources_artist on public.resources (artist_id, sort_order) where artist_id is not null;
create index resources_category_key on public.resources (lower(category));

create table public.artist_hidden_resources (
  artist_id   uuid not null references public.artists (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  primary key (artist_id, resource_id)
);

-- D44: the two shared inboxes are admins from day one. Everyone else is added by hand in the table editor.
insert into public.admins (email, display_name) values
  ('labelservices@vydia.com', 'Label Services'),
  ('creativeservices@vydia.com', 'Creative Services')
on conflict (email) do nothing;
```

### 4.2 Triggers

```sql
create schema if not exists private;  -- not exposed through PostgREST

-- updated_at
create or replace function private.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger artists_touch   before update on public.artists   for each row execute function private.touch_updated_at();
create trigger resources_touch before update on public.resources for each row execute function private.touch_updated_at();

-- D38: reuse the existing spelling of a category that matches case-insensitively.
create or replace function private.normalize_category() returns trigger language plpgsql as $$
declare existing text;
begin
  new.category := regexp_replace(btrim(new.category), '\s+', ' ', 'g');
  select r.category into existing
    from public.resources r
   where lower(r.category) = lower(new.category) and r.id <> new.id
   order by r.created_at
   limit 1;
  if existing is not null then new.category := existing; end if;
  return new;
end $$;
create trigger resources_category before insert or update of category on public.resources
  for each row execute function private.normalize_category();

-- New main resources go to the end of the list.
create or replace function private.default_sort_order() returns trigger language plpgsql as $$
begin
  if new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order
      from public.resources where artist_id is not distinct from new.artist_id;
  end if;
  return new;
end $$;
create trigger resources_sort before insert on public.resources
  for each row execute function private.default_sort_order();

-- Hides may only point at main resources.
create or replace function private.check_hide_target() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.resources where id = new.resource_id and artist_id is not null) then
    raise exception 'Only main resources can be hidden' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger hides_main_only before insert or update on public.artist_hidden_resources
  for each row execute function private.check_hide_target();

-- D39: queue storage objects that are no longer referenced.
create table private.storage_garbage (
  bucket text not null,
  path   text not null,
  queued_at timestamptz not null default now(),
  primary key (bucket, path)
);

create or replace function private.queue_resource_garbage() returns trigger language plpgsql as $$
begin
  insert into private.storage_garbage (bucket, path)
  select g.bucket, g.path from (values
    ('resource-files',  old.file,        case when tg_op = 'DELETE' then null else new.file end),
    ('resource-images', old.cover_image, case when tg_op = 'DELETE' then null else new.cover_image end),
    ('resource-images', old.pdf_preview, case when tg_op = 'DELETE' then null else new.pdf_preview end)
  ) as g(bucket, path, replacement)
  where g.path is not null and g.path is distinct from g.replacement
  on conflict do nothing;
  return null;
end $$;
create trigger resources_garbage after update or delete on public.resources
  for each row execute function private.queue_resource_garbage();
```

Row-level triggers also fire for rows removed by `on delete cascade`, so deleting an artist queues all of its exclusive files.

### 4.3 Identity helpers

```sql
create or replace function public.jwt_email() returns text
language sql stable set search_path = '' as $$
  select lower(nullif(auth.jwt() ->> 'email', ''))
$$;

-- D31: admin = Google (oauth) session + listed in admins + @vydia.com.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.jwt_email() like '%@vydia.com'
     and exists (select 1 from public.admins a where a.email = public.jwt_email())
     and exists (
       select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
        where m ->> 'method' = 'oauth' or m #>> '{}' = 'oauth'
     )
$$;

create or replace function public.can_view_artist(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.artist_emails ae
                  where ae.artist_id = target and ae.email = public.jwt_email())
$$;
```

`auth.jwt() ->> 'email'` only holds an email the user has verified: the magic link or Google proved it. Access is still computed from `artist_emails` at query time. The session only says *who* you are, never *what you can see*.

### 4.4 Row Level Security

```sql
alter table public.admins                  enable row level security;
alter table public.artists                 enable row level security;
alter table public.artist_emails           enable row level security;
alter table public.resources               enable row level security;
alter table public.artist_hidden_resources enable row level security;

revoke all on all tables in schema public from anon;

-- admins: you can read your own row; writes only via the dashboard (service role).
create policy admins_self on public.admins for select to authenticated
  using (email = public.jwt_email() and public.is_admin());

-- artists
create policy artists_read on public.artists for select to authenticated
  using (public.can_view_artist(id));
create policy artists_insert on public.artists for insert to authenticated with check (public.is_admin());
create policy artists_update on public.artists for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy artists_delete on public.artists for delete to authenticated using (public.is_admin());

-- artist_emails: artist users never read the list (their page never shows emails).
create policy emails_admin_all on public.artist_emails for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- resources
create policy resources_read on public.resources for select to authenticated using (
  public.is_admin()
  -- exclusive: only the owning artist's people
  or (artist_id is not null and public.can_view_artist(artist_id))
  -- main: visible if at least one of *your* artists doesn't hide it
  or (artist_id is null and exists (
        select 1 from public.artist_emails ae
         where ae.email = public.jwt_email()
           and not exists (select 1 from public.artist_hidden_resources h
                            where h.artist_id = ae.artist_id and h.resource_id = resources.id)))
);
create policy resources_insert on public.resources for insert to authenticated with check (public.is_admin());
create policy resources_update on public.resources for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy resources_delete on public.resources for delete to authenticated using (public.is_admin());

-- hides
create policy hides_read on public.artist_hidden_resources for select to authenticated
  using (public.can_view_artist(artist_id));
create policy hides_admin_write on public.artist_hidden_resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

Someone linked only to Artist A, using the publishable key and their own JWT straight against PostgREST, gets: A's row, A's exclusives, and every main resource A doesn't hide. They don't get B's name, B's exclusives, or any email list. That matches "An artist user can read only the artists their email is attached to, and only those artists' resources."

### 4.5 RPCs

```sql
-- Artist page in one round trip. security INVOKER: RLS decides; no access ⇒ null.
create or replace function public.get_artist_page(p_slug text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'artist', jsonb_build_object('id', a.id, 'name', a.name),
    'resources', coalesce((
      select jsonb_agg(to_jsonb(r) order by (r.artist_id is not null), r.sort_order, r.added_on, r.id)
        from public.resources r
       where (r.artist_id = a.id)
          or (r.artist_id is null and not exists (
                select 1 from public.artist_hidden_resources h
                 where h.artist_id = a.id and h.resource_id = r.id))
    ), '[]'::jsonb))
  from public.artists a
  where a.slug = lower(btrim(p_slug))
$$;
revoke execute on function public.get_artist_page(text) from public, anon;
grant  execute on function public.get_artist_page(text) to authenticated;

-- Sign-in pre-check (D29). Never granted to anon/authenticated.
create or replace function public.email_can_access_slug(p_slug text, p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.artists a
             join public.artist_emails ae on ae.artist_id = a.id
            where a.slug = lower(btrim(p_slug)) and ae.email = lower(btrim(p_email)))
     and not exists (select 1 from public.admins ad where ad.email = lower(btrim(p_email)))
$$;
revoke execute on function public.email_can_access_slug(text, text) from public, anon, authenticated;
grant  execute on function public.email_can_access_slug(text, text) to service_role;

-- Rate limiting (D34).
create table private.rate_limits (
  key text not null, window_start timestamptz not null, hits integer not null default 1,
  primary key (key, window_start)
);
create table private.link_sends (email text primary key, sent_at timestamptz not null);

create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window interval) returns boolean
language sql volatile security definer set search_path = '' as $$
  insert into private.rate_limits as r (key, window_start)
  values (p_key, date_bin(p_window, now(), timestamptz 'epoch'))
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits <= p_limit
$$;

-- true = you may send now (and the cooldown starts); false = still inside 60 s.
create or replace function public.claim_link_send(p_email text) returns boolean
language sql volatile security definer set search_path = '' as $$
  with claimed as (
    insert into private.link_sends as s (email, sent_at) values (lower(btrim(p_email)), now())
    on conflict (email) do update set sent_at = now()
      where s.sent_at < now() - interval '60 seconds'
    returning 1
  ) select exists (select 1 from claimed)
$$;
revoke execute on function public.hit_rate_limit(text, integer, interval), public.claim_link_send(text)
  from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, interval), public.claim_link_send(text) to service_role;

-- Admin profile sync on Google sign-in; returns whether the caller is an admin.
create or replace function public.claim_admin_profile() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then return false; end if;
  update public.admins
     set user_id = auth.uid(),
         display_name = coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', display_name),
         avatar_url   = coalesce(auth.jwt() -> 'user_metadata' ->> 'avatar_url', avatar_url),
         last_sign_in_at = now()
   where email = public.jwt_email();
  return true;
end $$;
grant execute on function public.claim_admin_profile() to authenticated;

-- Reorder main resources: ids in their new order (D: drag-to-reorder).
create or replace function public.reorder_main_resources(ids uuid[]) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.resources r set sort_order = o.ord
    from unnest(ids) with ordinality as o(id, ord)
   where r.id = o.id and r.artist_id is null;
end $$;
grant execute on function public.reorder_main_resources(uuid[]) to authenticated;

-- Storage cleanup queue: an admin takes the queued paths and deletes them via the Storage API.
create or replace function public.take_storage_garbage() returns table (bucket text, path text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query delete from private.storage_garbage g returning g.bucket, g.path;
end $$;
grant execute on function public.take_storage_garbage() to authenticated;
```

### 4.6 `save_artist` (create + edit, all or nothing)

The payload uses the app's camelCase names, already validated by zod (§9.4). The RPC re-checks the invariants that can't be skipped.

```sql
create or replace function public.save_artist(payload jsonb) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_id      uuid := nullif(payload ->> 'id', '')::uuid;
  v_emails  jsonb := coalesce(payload -> 'emails', '[]');
  v_hidden  jsonb := coalesce(payload -> 'hiddenResourceIds', '[]');
  v_excl    jsonb := coalesce(payload -> 'exclusiveResources', '[]');
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;

  if (select count(*) from jsonb_array_elements(v_emails) e where (e ->> 'isPrimary')::boolean) <> 1 then
    raise exception 'exactly one primary email is required' using errcode = '23514';
  end if;
  if (select count(*) <> count(distinct lower(btrim(e ->> 'email'))) from jsonb_array_elements(v_emails) e) then
    raise exception 'duplicate email' using errcode = '23505', constraint = 'artist_emails_artist_id_email_key';
  end if;

  -- 1. artist
  if v_id is null then
    insert into public.artists (name, slug, created_by)
    values (btrim(payload ->> 'name'), payload ->> 'slug', auth.uid())
    returning id into v_id;
  else
    update public.artists set name = btrim(payload ->> 'name'), slug = payload ->> 'slug' where id = v_id;
    if not found then raise exception 'artist not found' using errcode = 'P0002'; end if;
  end if;

  -- 2. emails: replace the set. Clear primaries first so the partial unique index can't trip mid-statement.
  delete from public.artist_emails
   where artist_id = v_id
     and email not in (select lower(btrim(e ->> 'email')) from jsonb_array_elements(v_emails) e);
  update public.artist_emails set is_primary = false where artist_id = v_id;
  insert into public.artist_emails (artist_id, email, label, is_primary)
  select v_id, lower(btrim(e ->> 'email')), nullif(btrim(e ->> 'label'), ''), (e ->> 'isPrimary')::boolean
    from jsonb_array_elements(v_emails) e
  on conflict (artist_id, email) do update set label = excluded.label, is_primary = excluded.is_primary;

  -- 3. hides: replace the set (the trigger rejects non-main ids).
  delete from public.artist_hidden_resources where artist_id = v_id;
  insert into public.artist_hidden_resources (artist_id, resource_id)
  select v_id, h::uuid from jsonb_array_elements_text(v_hidden) h
  on conflict do nothing;

  -- 4. exclusive resources: delete the removed ones, upsert the rest (ids are generated client-side, D36).
  delete from public.resources
   where artist_id = v_id
     and id not in (select (r ->> 'id')::uuid from jsonb_array_elements(v_excl) r);

  insert into public.resources as t
    (id, artist_id, title, type, file, url, cover_image, cover_image_alt, cover_image_lqip,
     pdf_preview, pdf_preview_lqip, category, sort_order, added_on)
  select (r ->> 'id')::uuid, v_id, btrim(r ->> 'title'), (r ->> 'type')::public.resource_type,
         nullif(r ->> 'file', ''), nullif(r ->> 'url', ''), nullif(r ->> 'coverImage', ''),
         nullif(r ->> 'coverImageAlt', ''), nullif(r ->> 'coverImageLqip', ''),
         nullif(r ->> 'pdfPreview', ''), nullif(r ->> 'pdfPreviewLqip', ''), r ->> 'category',
         ord::integer, coalesce((r ->> 'addedOn')::timestamptz, now())
    from jsonb_array_elements(v_excl) with ordinality as x(r, ord)
  on conflict (id) do update set
    title = excluded.title, type = excluded.type, file = excluded.file, url = excluded.url,
    cover_image = excluded.cover_image, cover_image_alt = excluded.cover_image_alt,
    cover_image_lqip = excluded.cover_image_lqip, pdf_preview = excluded.pdf_preview,
    pdf_preview_lqip = excluded.pdf_preview_lqip, category = excluded.category,
    sort_order = excluded.sort_order, added_on = excluded.added_on
  where t.artist_id = v_id;   -- never lets an artist payload overwrite a main resource or another artist's row

  return v_id;
end $$;
grant execute on function public.save_artist(jsonb) to authenticated;
```

**Delete artist** needs no RPC: `delete from artists where id = $1` under RLS cascades to emails, hides, and exclusives, and the garbage trigger queues their files. The slug is free to reuse right away.

### 4.7 Auth hook: no self-signup (D30)

Written to match Supabase's "Before User Created" hook docs (read 2026-11-09):
- The event is `{metadata: {uuid, time, name, ip_address}, user: {id, email, app_metadata: {provider, providers}, …}}`. The user row doesn't exist yet.
- Return `{}` to allow. Return `{"error": {"http_code": 403, "message": "…"}}` to block.
- Postgres hooks have a 2-second timeout.
- The hook is available on the Free and Pro plans.

The docs recommend a plain function (no `security definer`) with explicit grants to `supabase_auth_admin`, plus RLS policies that let that role read the tables the hook queries.

```sql
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_email    text := lower(btrim(event -> 'user' ->> 'email'));
  v_provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', 'email');
  v_is_admin boolean := exists (select 1 from public.admins where email = v_email);
begin
  if v_provider = 'google' and v_is_admin then
    return '{}'::jsonb;
  end if;
  if v_provider = 'email' and not v_is_admin
     and exists (select 1 from public.artist_emails where email = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Not approved'));
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;

-- The hook runs as supabase_auth_admin, so that role needs read access (both indexed lookups, well under 2 s).
grant select on public.admins, public.artist_emails to supabase_auth_admin;
create policy admins_auth_hook on public.admins for select to supabase_auth_admin using (true);
create policy artist_emails_auth_hook on public.artist_emails for select to supabase_auth_admin using (true);
```

```toml
# supabase/config.toml (local dev). Key follows the documented [auth.hook.<name>] pattern.
[auth.hook.before_user_created]
enabled = true
uri = "pg-functions://postgres/public/hook_before_user_created"
```

On the hosted project, enable it under **Auth → Hooks → Before User Created → Postgres → `public.hook_before_user_created`** (§12).

The docs leave three things unspecified, so they're verified on the new project before building on them (§12.3):
1. Which sign-up paths fire the hook: `signInWithOtp` with `shouldCreateUser`, Google OAuth, and admin `createUser`/`generate_link`. The plan assumes the first two do. The e2e fixtures attach emails to artists *before* creating users, so they pass either way.
2. How a rejected Google sign-in reaches our redirect URL. `/admin/auth/callback` treats any request without a `code` as "You don't have access.", so the exact query parameters don't matter.
3. Whether `signInWithOtp` sessions carry `amr` method `otp` or `magiclink`. Both are documented values, and the code accepts either (§7.5). `is_admin()` only accepts `oauth`.

The hook only runs when a user is **created**. Existing users who've been removed from every artist can still get a link by calling the Auth API directly, but RLS shows them nothing, so all they reach is the Enter your email screen.

### 4.8 Storage buckets and policies

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resource-files', 'resource-files', false, 1073741824,  -- 1 GB; also raise the project-wide limit (§12)
   array['application/pdf', 'video/mp4', 'video/quicktime', 'video/webm',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint', 'application/vnd.apple.keynote']),
  ('resource-images', 'resource-images', true, 5242880,   -- 5 MB (spec)
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admins manage resource objects" on storage.objects for all to authenticated
  using (bucket_id in ('resource-files', 'resource-images') and public.is_admin())
  with check (bucket_id in ('resource-files', 'resource-images') and public.is_admin());

-- A viewer can sign a URL for a file only if they can read a resource pointing at it (RLS on resources applies).
create policy "viewers read visible files" on storage.objects for select to authenticated
  using (bucket_id = 'resource-files'
         and exists (select 1 from public.resources r where r.file = storage.objects.name));
```

Object paths: `{resourceId}/{kind}-{uuid}.{ext}`, where `kind` ∈ `file | cover | preview`. The resource id prefix keeps a resource's objects together, and the random suffix lets a replacement upload never collide with or be served as the old object.

---

## 5. Sanity → Supabase field contract (D27, D28)

### 5.1 Add the missing fields to Sanity first

`sanity/schemaTypes/resource.ts`, then `npm run typegen` to re-extract `sanity/schema.json`:

```ts
defineField({
  name: 'category',
  type: 'string',
  description: 'Groups this card in grid view, e.g. "Getting Started". Upper/lower case is ignored when grouping.',
  validation: (rule) => rule.required(),
}),
defineField({
  name: 'sortOrder',
  title: 'Sort order',
  type: 'number',
  description: 'Position on the page, lowest first. The Supabase migration fills it from the Website order when empty.',
  validation: (rule) => rule.integer().min(0),
}),
```

Label services then fill in **category** for every resource on Website → Resources in Studio. The migration refuses resources without one (§10).

### 5.2 Mapping

| Sanity (`resource`) | Sanity rule | Postgres (`resources`) | TS (`Resource`) |
|---|---|---|---|
| `_id` | system | `id uuid` (deterministic from `_id` for migrated rows) | `id` |
| `title` | string, required, max 120 | `title text not null` 1–120 | `title: string` |
| `type` | `pdf \| video \| link \| slides`, required | `type resource_type` enum | `type: ResourceType` |
| `file` | file asset; required for pdf/video; slides = file **xor** url | `file text` (path in `resource-files`) + `resources_target` check | `file: string \| null` |
| `url` | url, http/https | `url text` check `^https?://` | `url: string \| null` |
| `coverImage` | image `{asset, alt, hotspot, crop}`, optional | `cover_image` (path), `cover_image_alt`, `cover_image_hotspot jsonb`, `cover_image_lqip` (asset metadata, D42). **Crop is baked into the migrated image.** | `coverImage: {path, alt, hotspot, lqip} \| null` |
| `pdfPreview` | image, auto-generated, pdf only | `pdf_preview text` + `resources_preview_only_pdf`, `pdf_preview_lqip` (asset metadata, D42) | `pdfPreview: {path, lqip} \| null` |
| `addedOn` | datetime, required, default now | `added_on timestamptz not null default now()` | `addedOn: string` |
| `category` *(new)* | string, required | `category text not null` | `category: string` |
| `sortOrder` *(new)* | integer ≥ 0 | `sort_order integer not null` | `sortOrder: number` |
| *(relationship)* | Sanity modelled this as `artist.resourceOverride[]` | `artist_id uuid null` (null = main) | `artistId: string \| null` |

`pdfPreview.source` is internal to Studio and isn't migrated. Sanity's `lqip` is asset metadata (`asset->metadata.lqip`), not a document field. It's carried over as the `*_lqip` columns so covers look the same (D42). Image dimensions aren't used by any component and aren't stored.

### 5.3 Correct the sample data in `iteration-two.md`

The spec says the schema wins over the sample data. Two samples disagree with it:

- The main resource sample is `type: "video"` with `url`, but Sanity requires an uploaded **file** for videos (D14) and hides `url`. It's also `cover_image`/`sort_order` where the schema names are `coverImage`/`sortOrder`.
- Corrected samples:

```js
// Main resource
{ title: "Vydia Dashboard Walkthrough", type: "video", file: "walkthrough.mp4", category: "Getting Started", coverImage: "walkthrough.jpg", sortOrder: 1 }
// Exclusive resource (artist relationship + schema fields)
{ artist: "lil-example", title: "Q1 Release Plan", type: "pdf", file: "q1-plan.pdf", category: "Your Releases" }
```

Task 1.7 updates the spec doc to match.

### 5.4 TS types and mapping

```ts
// lib/resources/types.ts  (RESOURCE_TYPES moves here from sanity/schemaTypes/resource.ts)
export const RESOURCE_TYPES = [
  {title: 'PDF', value: 'pdf'},
  {title: 'Video', value: 'video'},
  {title: 'Link (pitch forms, external pages)', value: 'link'},
  {title: 'Slide deck', value: 'slides'},
] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]['value']

export type Hotspot = {x: number; y: number}

/** Field names match sanity/schema.json exactly (D27). */
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

/** What the artist-side components render. Storage details are resolved on the server. */
export type ResourceCardData = {
  id: string
  title: string
  type: ResourceType
  category: string
  href: string               // link url, or /api/resources/{id}/file
  cover: {src: string; alt: string; position: string; lqip: string | null} | null
}
```

```ts
// lib/resources/mapping.ts
import type {Database} from '@/lib/supabase/database.types'
import type {Hotspot, Resource, ResourceCardData} from './types'
import {SUPABASE_URL} from '@/lib/env'

type Row = Database['public']['Tables']['resources']['Row']

/** Sanity field → Postgres column. tests/schema-parity.test.ts checks this against sanity/schema.json. */
export const RESOURCE_FIELD_MAP = {
  title: 'title',
  type: 'type',
  file: 'file',
  url: 'url',
  coverImage: 'cover_image',
  pdfPreview: 'pdf_preview',
  addedOn: 'added_on',
  category: 'category',
  sortOrder: 'sort_order',
} as const satisfies Record<string, keyof Row>

// Compile-time: the DB enum and RESOURCE_TYPES must be the same union.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
const _enumParity: Equal<Database['public']['Enums']['resource_type'], Resource['type']> = true
void _enumParity

export const publicImageUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/resource-images/${path.split('/').map(encodeURIComponent).join('/')}`

export function fromRow(row: Row): Resource {
  return {
    id: row.id,
    artistId: row.artist_id,
    title: row.title,
    type: row.type,
    file: row.file,
    url: row.url,
    coverImage: row.cover_image
      ? {
          path: row.cover_image,
          alt: row.cover_image_alt,
          hotspot: (row.cover_image_hotspot as Hotspot | null) ?? null,
          lqip: row.cover_image_lqip,
        }
      : null,
    pdfPreview: row.pdf_preview ? {path: row.pdf_preview, lqip: row.pdf_preview_lqip} : null,
    category: row.category,
    sortOrder: row.sort_order,
    addedOn: row.added_on,
  }
}

export function toCard(resource: Resource): ResourceCardData | null {
  const href = resource.type === 'link' || (resource.type === 'slides' && resource.url)
    ? resource.url
    : resource.file ? `/api/resources/${resource.id}/file` : null
  if (!href) return null
  const image = resource.coverImage ?? resource.pdfPreview
  return {
    id: resource.id,
    title: resource.title,
    type: resource.type,
    category: resource.category,
    href,
    cover: image && {
      src: publicImageUrl(image.path),
      alt: resource.coverImage?.alt ?? '',
      position: resource.coverImage?.hotspot
        ? `${resource.coverImage.hotspot.x * 100}% ${resource.coverImage.hotspot.y * 100}%`
        : 'center',
      lqip: image.lqip,
    },
  }
}
```

Generate DB types with `npm run db:types` (`supabase gen types typescript --local`, then prettier), and type every client as `createServerClient<Database>(…)`.

---

## 6. Supabase clients, env, proxy

### 6.1 Env

```bash
# .env.example
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://lsihwkbnrheczirlkswo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Server only (D29). Used by lib/supabase/service.ts and the migration/sweep/e2e scripts. Never NEXT_PUBLIC.
SUPABASE_SECRET_KEY=
# CLI only: supabase link / gen types / db push.
SUPABASE_PROJECT_ID=lsihwkbnrheczirlkswo
```

`.env.local` already points at the new project and already has `SUPABASE_PROJECT_ID`. It still holds the **legacy** `SUPABASE_SERVICE_ROLE_KEY` (a JWT `eyJ…` key), which the iteration-one e2e scripts read. Add `SUPABASE_SECRET_KEY` with a new `sb_secret_…` key from the new project (API Keys → Secret keys). Keep both until the e2e scripts are rewritten (task 10.2), then delete the legacy one (task 13.3). New secret keys can be rotated or revoked one at a time without affecting the publishable key. The legacy JWT keys can't.

Removed: `NEXT_PUBLIC_SANITY_*`, `SANITY_API_READ_TOKEN`, `SANITY_REVALIDATE_SECRET`, `PERMANENT_VIEWER_EMAILS`, and `SUPABASE_SERVICE_ROLE_KEY` (renamed to `SUPABASE_SECRET_KEY`; use the new `sb_secret_…` key). The migration script still needs the Sanity variables while it runs (§10).

### 6.2 Service client (the only privileged code path)

```ts
// lib/supabase/service.ts
import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {SUPABASE_URL} from '@/lib/env'
import type {Database} from './database.types'

const secret = process.env.SUPABASE_SECRET_KEY
if (!secret) throw new Error('Missing env var SUPABASE_SECRET_KEY')

/** Only for email_can_access_slug, hit_rate_limit and claim_link_send. Never for reading artist data. */
export const createServiceClient = () =>
  createClient<Database>(SUPABASE_URL, secret, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
  })
```

`lib/supabase/server.ts` and `stateless.ts` stay as they are, plus the `<Database>` generic.

### 6.3 Proxy: refresh everywhere, gate only `/admin`

The Next 16 docs recommend Proxy for *optimistic* checks only. The real check is `requireAdmin()` in the panel layout and in every action.

```ts
// lib/supabase/proxy.ts
import {createServerClient} from '@supabase/ssr'
import {NextResponse, type NextRequest} from 'next/server'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'

const ADMIN_PUBLIC = ['/admin/login', '/admin/auth/callback']

export const needsAdminSession = (path: string) =>
  (path === '/admin' || path.startsWith('/admin/')) && !ADMIN_PUBLIC.includes(path)

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({request})
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({name, value}) => request.cookies.set(name, value))
        response = NextResponse.next({request})
        toSet.forEach(({name, value, options}) => response.cookies.set(name, value, options))
      },
    },
  })

  // Refreshes the session and re-issues the 400-day cookies on every request (D11).
  const {data} = await supabase.auth.getClaims()

  if (!data?.claims && needsAdminSession(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = ''
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }
  // Artist paths are never redirected: /[slug] decides between resources and Enter your email.
  return response
}
```

`proxy.ts`: drop `studio|api/revalidate` from the matcher's exclusions.

### 6.4 Slug and email helpers

```ts
// lib/slug.ts (changes)
export const SLUG_MIN = 3
export const SLUG_MAX = 60
export const RESERVED_SLUGS = new Set(['admin', 'api', 'auth', 'login', 'logout', 'account', 'studio', 'static',
  '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml'])

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const isValidSlug = (slug: string) =>
  slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug)

export function normalizeSlug(raw: string) {
  try { return decodeURIComponent(raw).trim().toLowerCase() } catch { return raw.trim().toLowerCase() }
}
```

```ts
// lib/email.ts (moved from lib/access.ts and sanity/schemaTypes/shared.ts)
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const normalizeEmail = (email: string) => email.trim().toLowerCase()
```

---

## 7. Artist side

### 7.1 Data access

```ts
// lib/artist-page.ts
import 'server-only'
import {cache} from 'react'
import {groupByCategory, type CategoryGroup} from '@/lib/resources/group'
import {fromRow, toCard} from '@/lib/resources/mapping'
import type {ResourceCardData} from '@/lib/resources/types'
import {isValidSlug, normalizeSlug} from '@/lib/slug'
import type {Database} from '@/lib/supabase/database.types'
import {createClient} from '@/lib/supabase/server'

export type ArtistPage = {artistName: string; groups: CategoryGroup<ResourceCardData>[]}

/**
 * null for every "no access" case (signed out, unknown, deleted, renamed, not linked). Callers must not
 * branch on why. Shared by generateMetadata and the page, so each request runs the RPC once.
 */
export const getArtistPage = cache(async (rawSlug: string): Promise<ArtistPage | null> => {
  const slug = normalizeSlug(rawSlug)
  if (!isValidSlug(slug)) return null

  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  if (!auth?.claims) return null

  const {data, error} = await supabase.rpc('get_artist_page', {p_slug: slug})
  if (error) {
    console.error('get_artist_page failed:', error.code)
    return null // fail closed: same screen as no access
  }
  if (!data) return null

  const page = data as {artist: {id: string; name: string}; resources: Database['public']['Tables']['resources']['Row'][]}
  const cards = page.resources.map(fromRow).map(toCard).filter((c): c is ResourceCardData => c !== null)
  return {artistName: page.artist.name, groups: groupByCategory(cards)}
})
```

```ts
// lib/resources/group.ts
export type CategoryGroup<T> = {key: string; category: string; items: T[]}

/** Groups by case-insensitive category, keeping first-appearance order (main resources come first, D38). */
export function groupByCategory<T extends {category: string}>(items: T[]): CategoryGroup<T>[] {
  const groups = new Map<string, CategoryGroup<T>>()
  for (const item of items) {
    const category = item.category.trim().replace(/\s+/g, ' ')
    const key = category.toLowerCase()
    let group = groups.get(key)
    if (!group) groups.set(key, (group = {key, category, items: []}))
    group.items.push(item)
  }
  return [...groups.values()]
}
```

### 7.2 `/[slug]` page

```tsx
// app/(site)/[slug]/page.tsx
import type {Metadata} from 'next'
import {PageShell} from '@/components/PageShell'
import {ResourceViews} from '@/components/ResourceViews'
import {ViewModeProvider} from '@/components/ViewMode'
import {getArtistPage} from '@/lib/artist-page'
import {greeting} from '@/lib/greeting'
import {normalizeSlug} from '@/lib/slug'
import {EnterEmail} from './EnterEmail'

export const instant = false

export async function generateMetadata({params}: PageProps<'/[slug]'>): Promise<Metadata> {
  const page = await getArtistPage((await params).slug)
  // No access ⇒ plain title: the artist's name must never appear (spec: "Never shows the artist's name").
  return {title: greeting(page?.artistName), robots: {index: false, follow: false}}
}

export default async function ArtistRoute({params}: PageProps<'/[slug]'>) {
  const {slug} = await params
  const page = await getArtistPage(slug)

  if (!page) {
    return (
      <PageShell>
        <EnterEmail slug={normalizeSlug(slug)} />
      </PageShell>
    )
  }

  return (
    <ViewModeProvider>
      <PageShell fullscreen artistName={page.artistName}>
        <ResourceViews groups={page.groups} />
      </PageShell>
    </ViewModeProvider>
  )
}
```

`not-found.tsx` is deleted, since nothing on the artist side calls `notFound()` any more. Unknown and denied visitors get **byte-identical** HTML for a given URL: same component, same title, same status (200), and the same single RPC round trip for signed-in visitors.

### 7.3 `sendLink` server action

```ts
// app/(site)/[slug]/actions.ts
'use server'
import {headers} from 'next/headers'
import {EMAIL_PATTERN, normalizeEmail} from '@/lib/email'
import {SITE_URL} from '@/lib/env'
import {field} from '@/lib/form'
import {isValidSlug, normalizeSlug} from '@/lib/slug'
import {createServiceClient} from '@/lib/supabase/service'
import {createStatelessClient} from '@/lib/supabase/stateless'

export type LinkState =
  | {status: 'idle'}
  | {status: 'invalid'}
  | {status: 'not-approved'}
  | {status: 'rate-limited'}
  | {status: 'error'}
  | {status: 'sent'; email: string}

const IP_LIMIT = 20
const IP_WINDOW = '10 minutes'

export async function sendLink(_: LinkState, form: FormData): Promise<LinkState> {
  const email = normalizeEmail(field(form, 'email'))
  const slug = normalizeSlug(field(form, 'slug'))
  if (!EMAIL_PATTERN.test(email)) return {status: 'invalid'}

  const service = createServiceClient()
  // On Vercel the first x-forwarded-for hop is set by the platform, not the client.
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const {data: underLimit} = await service.rpc('hit_rate_limit', {p_key: `link:ip:${ip}`, p_limit: IP_LIMIT, p_window: IP_WINDOW})
  if (underLimit === false) return {status: 'rate-limited'}

  // Unknown, deleted, renamed, and reserved slugs all fall through to the same answer as a wrong email.
  const {data: approved, error} = await service.rpc('email_can_access_slug', {p_slug: slug, p_email: email})
  if (error) {
    console.error('email_can_access_slug failed:', error.code)
    return {status: 'error'}
  }
  if (!approved || !isValidSlug(slug)) return {status: 'not-approved'}

  // 60 s per email (business rule). Inside the window, report "sent" again without sending.
  const {data: maysend} = await service.rpc('claim_link_send', {p_email: email})
  if (!maysend) return {status: 'sent', email}

  const {error: sendError} = await createStatelessClient().auth.signInWithOtp({
    email,
    options: {shouldCreateUser: true, emailRedirectTo: `${SITE_URL}/${slug}`},
  })
  if (sendError && sendError.code !== 'over_email_send_rate_limit') {
    console.error('Magic link not sent:', sendError.code ?? sendError.message)
    return {status: 'error'}
  }
  return {status: 'sent', email}
}
```

How this differs from iteration one's `sendMagicLink`: no `after()`. The spec *wants* the approved/not-approved answer shown, so the work runs inline and errors reach the user. The answer that must stay hidden is "does this slug exist", and both "unknown slug" and "wrong email" take exactly the same code path (one RPC returning `false`).

### 7.4 Enter your email screen

```tsx
// app/(site)/[slug]/EnterEmail.tsx
'use client'
import {useActionState, useEffect, useState} from 'react'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {sendLink, type LinkState} from './actions'
import styles from './EnterEmail.module.css'

const RESEND_AFTER_MS = 60_000
type ClientState = LinkState & {sentAt?: number}

async function submit(prev: ClientState, form: FormData): Promise<ClientState> {
  const next = await sendLink(prev, form)
  // Keep the original timestamp when a resend lands inside the cooldown.
  if (next.status !== 'sent') return next
  return {...next, sentAt: prev.status === 'sent' && prev.sentAt && Date.now() - prev.sentAt < RESEND_AFTER_MS ? prev.sentAt : Date.now()}
}

function useSecondsLeft(sentAt?: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sentAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [sentAt])
  return sentAt ? Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000)) : 0
}

const MESSAGES: Partial<Record<LinkState['status'], string>> = {
  'not-approved':
    'This email isn’t approved to view this page. Please contact Vydia label services if you’re having trouble.',
  invalid: 'Enter your full email address.',
  'rate-limited': 'Too many attempts. Please wait a few minutes and try again.',
  error: 'Something went wrong sending your link. Please try again.',
}

export function EnterEmail({slug}: {slug: string}) {
  const [state, action, pending] = useActionState<ClientState, FormData>(submit, {status: 'idle'})
  // Controlled, so React's post-action form reset doesn't clear the input after "not approved".
  const [email, setEmail] = useState('')
  const secondsLeft = useSecondsLeft(state.status === 'sent' ? state.sentAt : undefined)

  if (state.status === 'sent') {
    return (
      <div className={styles.panel}>
        <p role="status" className={styles.sent}>Email sent, check your inbox</p>
        <form action={action}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="email" value={state.email} />
          <button disabled={pending || secondsLeft > 0} className={ui.button}>
            {secondsLeft > 0 ? `Resend email (${secondsLeft}s)` : 'Resend email'}
          </button>
        </form>
      </div>
    )
  }

  const message = MESSAGES[state.status]
  return (
    <div className={styles.panel}>
      <form action={action} className={styles.form}>
        <input type="hidden" name="slug" value={slug} />
        <label className={styles.field}>
          <span className="visually-hidden">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cx(ui.input, styles.input)}
          />
        </label>
        <button disabled={pending} className={cx(ui.button, ui.primary)}>Send link</button>
      </form>
      {message && <p role="alert" className={cx(ui.error, styles.message)}>{message}</p>}
    </div>
  )
}
```

`EnterEmail.module.css`: a centered single-column panel (`max-width: 384px`, vertically centered in `PageShell`), reusing the dark tokens and `LoginForm.module.css` spacing. It's mobile-first, and the input and button are full-width under 480px.

### 7.5 Confirm (direct sign-in) and expired

The email link signs the artist in on the GET itself (D33). Delete `app/(site)/auth/confirm/page.tsx` and `actions.ts`: a segment can't have both a `page.tsx` and a `route.ts`. The email template's link doesn't change (§11), so links already sitting in inboxes keep working.

```ts
// app/(site)/auth/confirm/route.ts
import {NextResponse, type NextRequest} from 'next/server'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

const JUST_SIGNED_IN_S = 60
const NO_STORE = {'Cache-Control': 'no-store'}

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  // redirect_to is the absolute emailRedirectTo (SITE_URL/slug); safeNext reduces it to a same-site path.
  const next = safeNext(searchParams.get('redirect_to'))
  const expired = () =>
    NextResponse.redirect(`${origin}/auth/expired?next=${encodeURIComponent(next)}`, {headers: NO_STORE})

  const tokenHash = searchParams.get('token_hash')
  if (!tokenHash) return expired()

  const supabase = await createClient()
  // verifyOtp writes the new session's cookies through cookies(), and Next attaches them to this response.
  // They replace any session for another email (spec: "the new session replaces the old one").
  const {error} = await supabase.auth.verifyOtp({type: 'email', token_hash: tokenHash})
  if (!error) return NextResponse.redirect(`${origin}${next}`, {headers: NO_STORE})

  // Opening the same link twice (a double click, or a second tab) spends the token on the first request.
  // Let the second through only if a magic-link session was created moments ago in this browser, so an
  // old session for a different email can't hide an expired link.
  const {data} = await supabase.auth.getClaims()
  const now = Date.now() / 1000
  const fresh = (data?.claims?.amr ?? []).some(
    (m) => typeof m === 'object' && (m.method === 'otp' || m.method === 'magiclink') && now - m.timestamp < JUST_SIGNED_IN_S,
  )
  return fresh ? NextResponse.redirect(`${origin}${next}`, {headers: NO_STORE}) : expired()
}
```

```tsx
// app/(site)/auth/expired/page.tsx
import Link from 'next/link'
import {Notice} from '@/components/Notice'
import {PageShell} from '@/components/PageShell'
import ui from '@/components/ui/controls.module.css'
import {safeNext} from '@/lib/safe-redirect'

export const instant = false

export default async function ExpiredPage({searchParams}: PageProps<'/auth/expired'>) {
  const {next} = await searchParams
  const back = safeNext(typeof next === 'string' ? next : null)
  return (
    <PageShell>
      <Notice title="This link has expired" action={<Link href={back} className={ui.button}>Send a new link</Link>}>
        Sign-in links work once and expire after an hour.
      </Notice>
    </PageShell>
  )
}
```

Because the GET now creates the session, nothing on the confirm path may be prefetched or cached: the route always returns `no-store` redirects, and nothing in the app links to `/auth/confirm`.

### 7.6 Files route

```ts
// app/api/resources/[id]/file/route.ts
import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'

const SIGNED_URL_TTL_S = 60 * 60 // long enough to scrub a video

export async function GET(_: Request, ctx: RouteContext<'/api/resources/[id]/file'>) {
  const {id} = await ctx.params
  const supabase = await createClient()
  // RLS: returns the row only if the visitor can see this resource right now.
  const {data} = await supabase.from('resources').select('file').eq('id', id).maybeSingle()
  if (!data?.file) return new NextResponse('Not found', {status: 404, headers: {'Cache-Control': 'no-store'}})

  const {data: signed, error} = await supabase.storage.from('resource-files').createSignedUrl(data.file, SIGNED_URL_TTL_S)
  if (error || !signed) return new NextResponse('Not found', {status: 404, headers: {'Cache-Control': 'no-store'}})
  return NextResponse.redirect(signed.signedUrl, {status: 302, headers: {'Cache-Control': 'private, no-store'}})
}
```

`<video src="/api/resources/{id}/file">` follows the redirect, and range requests go to the signed URL. The 404 reveals nothing about artists, because ids are random UUIDs.

### 7.7 Resource views: categories and type

```tsx
// components/ResourceViews.tsx
'use client'
import type {CategoryGroup} from '@/lib/resources/group'
import type {ResourceCardData} from '@/lib/resources/types'
import {ResourceCarousel} from './ResourceCarousel'
import {ResourceGrid} from './ResourceGrid'
import {useViewMode} from './ViewMode'

export function ResourceViews({groups}: {groups: CategoryGroup<ResourceCardData>[]}) {
  const viewMode = useViewMode()
  // The carousel walks the same order the grid shows, so view switches pair up cards predictably.
  const resources = groups.flatMap((group) => group.items)
  if (!resources.length) return null
  if (viewMode?.view === 'grid') return <ResourceGrid groups={groups} />
  return <ResourceCarousel resources={resources} />
}
```

```tsx
// components/ResourceGrid.tsx (the grouped part)
<div ref={scroller} className={styles.gridScroller}>
  <section aria-label="Resources">
    {groups.map((group) => (
      <section key={group.key} aria-labelledby={`cat-${group.key}`} className={styles.category}>
        <h2 id={`cat-${group.key}`} className={styles.categoryTitle}>{group.category}</h2>
        <ul className={styles.grid}>
          {group.items.map((resource) => (
            <li key={resource.id} className={styles.item} data-morph-id={resource.id}>
              <ResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      </section>
    ))}
  </section>
</div>
```

The `group.key` used in `id` must be made id-safe: `key.replace(/[^a-z0-9]+/g, '-')`.

Rename `_id` → `id` in `ResourceCarousel`, `ResourceGrid`, and `ViewMode` (`data-morph-id`). The morph logic doesn't change.

Type label: the spec lists "cover image, title, and type". `CardBody` adds a small type label under the title (`PDF`, `Video`, `Link`, `Slides`) using the existing `--color-badge-*` tokens. The carousel's big title adds the same label as a subline.

```tsx
// components/ResourceCard.tsx
export function ResourceCard({resource, hideTitle}: {resource: ResourceCardData; hideTitle?: boolean}) {
  if (resource.type === 'video') return <VideoCard resource={resource} src={resource.href} hideTitle={hideTitle} />
  return (
    <a href={resource.href} target="_blank" rel="noopener noreferrer" className={styles.card}>
      <CardBody resource={resource} hideTitle={hideTitle} />
    </a>
  )
}
```

`hasTarget` disappears: `toCard` already drops resources without a target.

### 7.8 Covers without Sanity

```tsx
// components/CardCover.tsx
export function CardCover({resource}: {resource: ResourceCardData}) {
  if (resource.cover) {
    return (
      <Image
        src={resource.cover.src}
        alt={resource.cover.alt}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className={styles.image}
        style={{objectPosition: resource.cover.position}}
        // D42: same blur-up as today (Sanity's lqip), now stored next to the image.
        placeholder={resource.cover.lqip ? 'blur' : 'empty'}
        blurDataURL={resource.cover.lqip ?? undefined}
      />
    )
  }
  return (/* unchanged branded placeholder */)
}
```

`ResourceCarousel.backdropSrc` keeps its shape, so the backdrop crossfade looks exactly as it does today:

```ts
function backdropSrc(resource: ResourceCardData): {full: string; placeholder?: string} | null {
  if (!resource.cover) return null
  // next/image resizes the full-bleed backdrop. The LQIP is shipped with the page and shows instantly.
  return {full: resource.cover.src, placeholder: resource.cover.lqip ?? undefined}
}
```

The one difference is that the backdrop `<Image>` passes `sizes="100vw"` to Vercel's optimizer rather than asking the Sanity CDN for `w=2000`. The visual result is the same.

```ts
// next.config.ts
images: {
  remotePatterns: [{
    protocol: 'https',
    hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    pathname: '/storage/v1/object/public/resource-images/**',
  }],
},
```

---

## 8. Admin side

### 8.1 Auth

```ts
// app/(admin)/admin/login/actions.ts
'use server'
import {redirect} from 'next/navigation'
import {SITE_URL} from '@/lib/env'
import {createClient} from '@/lib/supabase/server'

export async function signInWithGoogle() {
  const supabase = await createClient()
  const {data, error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_URL}/admin/auth/callback`,
      // hd is only a hint for Google's account picker. The hook and is_admin() enforce the domain.
      queryParams: {prompt: 'select_account', hd: 'vydia.com'},
    },
  })
  if (error || !data.url) redirect('/admin/login?error=google')
  redirect(data.url)
}
```

```ts
// app/(admin)/admin/auth/callback/route.ts
import {NextResponse, type NextRequest} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const code = searchParams.get('code')
  // When the before-user-created hook rejects someone, Supabase redirects here with ?error=…
  if (!code) return NextResponse.redirect(`${origin}/admin/login?error=no-access`)

  const supabase = await createClient()
  const {error} = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/admin/login?error=no-access`)

  const {data: isAdmin} = await supabase.rpc('claim_admin_profile')
  if (!isAdmin) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/admin/login?error=no-access`)
  }
  return NextResponse.redirect(`${origin}/admin`)
}
```

```tsx
// app/(admin)/admin/login/page.tsx
import {signInWithGoogle} from './actions'
import styles from './login.module.css'

export const instant = false

const ERRORS: Record<string, string> = {
  'no-access': 'You don’t have access.',
  google: 'Google sign-in isn’t available right now. Try again in a minute.',
}

export default async function AdminLogin({searchParams}: PageProps<'/admin/login'>) {
  const {error} = await searchParams
  const message = typeof error === 'string' ? ERRORS[error] : undefined
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Welcome to Vydia admin</h1>
        {message && <p role="alert" className={styles.error}>{message}</p>}
        <form action={signInWithGoogle}><button className={styles.google}>Sign in with Google</button></form>
      </div>
    </main>
  )
}
```

```ts
// lib/admin/auth.ts
import 'server-only'
import {redirect} from 'next/navigation'
import {cache} from 'react'
import {createClient} from '@/lib/supabase/server'

export type AdminProfile = {email: string; display_name: string | null; avatar_url: string | null}

/** Call at the top of every admin page, layout, and server action. RLS backs it up regardless. */
export const requireAdmin = cache(async () => {
  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  if (!auth?.claims) redirect('/admin/login')
  // admins_self returns the caller's row only when is_admin() holds (Google session + listed + @vydia.com).
  const {data: admin} = await supabase.from('admins').select('email, display_name, avatar_url').maybeSingle()
  if (!admin) redirect('/admin/login?error=no-access')
  return {supabase, admin: admin as AdminProfile}
})
```

An admin removed from the table loses access on their next request, the same way artists do.

### 8.2 Panel layout

```tsx
// app/(admin)/layout.tsx
import type {Metadata} from 'next'
import {Public_Sans} from 'next/font/google'
import './admin.css'

const sans = Public_Sans({subsets: ['latin'], variable: '--font-public-sans'})
export const metadata: Metadata = {title: 'Welcome to Vydia · Admin', robots: {index: false, follow: false}}

export default function AdminRootLayout({children}: {children: React.ReactNode}) {
  return <html lang="en" className={sans.variable}><body>{children}</body></html>
}
```

```tsx
// app/(admin)/admin/(panel)/layout.tsx
import Link from 'next/link'
import {requireAdmin} from '@/lib/admin/auth'
import styles from './panel.module.css'

export const instant = false

export default async function PanelLayout({children}: {children: React.ReactNode}) {
  const {admin} = await requireAdmin()
  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <Link href="/admin">Artists</Link>
        <Link href="/admin/resources">Resources</Link>
        <span className={styles.me}>
          {admin.avatar_url && <img src={admin.avatar_url} alt="" width={24} height={24} referrerPolicy="no-referrer" />}
          {admin.display_name ?? admin.email}
        </span>
        <form action="/admin/auth/signout" method="post"><button>Sign out</button></form>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
```

> Per the Cache Components auth guide, a top-level session read in a layout blocks the whole segment. That's fine here: every admin page needs the check anyway, and `instant = false` follows the repo's existing pattern (D15). Every admin **page** still calls `requireAdmin()` itself (it's `cache()`d, so this costs nothing), because layouts don't re-run on every client navigation.

### 8.3 Artist index

```tsx
// app/(admin)/admin/(panel)/page.tsx
import Link from 'next/link'
import {ArtistTable} from '@/components/admin/ArtistTable'
import {requireAdmin} from '@/lib/admin/auth'

export const instant = false

export default async function ArtistIndex() {
  const {supabase} = await requireAdmin()
  const {data} = await supabase
    .from('artists')
    .select('id, name, slug, created_at, artist_emails(email, is_primary)')
    .order('created_at', {ascending: false})

  const rows = (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    createdAt: a.created_at,
    primaryEmail: a.artist_emails.find((e) => e.is_primary)?.email ?? '',
    auxCount: a.artist_emails.filter((e) => !e.is_primary).length,
    allEmails: a.artist_emails.map((e) => e.email),
  }))

  return (
    <>
      <header><h1>Artists</h1><Link href="/admin/artists/new">New artist</Link></header>
      <ArtistTable rows={rows} />
    </>
  )
}
```

`ArtistTable` is a client component with a search box that filters on name **or any** email (case-insensitive) in memory. The roster is small, so search is instant with no round trips. Columns: name (links to detail), primary email, auxiliary count, slug, `<CopyLinkButton slug/>`, created date (`lib/format.ts`).

```tsx
// components/admin/CopyLinkButton.tsx
'use client'
import {useState} from 'react'
import {SITE_URL} from '@/lib/env'

export const welcomeLink = (slug: string) => `${SITE_URL}/${slug}`

export function CopyLinkButton({slug}: {slug: string}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(welcomeLink(slug))
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}
```

### 8.4 Validation (shared by the form, actions, and migration)

```ts
// lib/validation.ts
import {z} from 'zod'
import {EMAIL_PATTERN} from './email'
import {RESOURCE_TYPES, type ResourceType} from './resources/types'
import {isValidSlug, SLUG_MAX, SLUG_MIN} from './slug'

const RESOURCE_TYPE_VALUES = RESOURCE_TYPES.map((t) => t.value) as [ResourceType, ...ResourceType[]]
const lqip = z.string().max(4096).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
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
  // Same per-type rules as sanity/schemaTypes/resource.ts and the resources_target check.
  .superRefine((r, ctx) => {
    const fail = (path: 'file' | 'url', message: string) => ctx.addIssue({code: 'custom', path: [path], message})
    if ((r.type === 'pdf' || r.type === 'video') && !r.file) fail('file', r.type === 'pdf' ? 'Upload a PDF.' : 'Upload the video file.')
    if ((r.type === 'pdf' || r.type === 'video') && r.url) fail('url', 'Videos and PDFs are uploaded, not linked.')
    if (r.type === 'link' && !r.url) fail('url', 'Add the link URL.')
    if (r.type === 'link' && r.file) fail('file', 'Links don’t have a file.')
    if (r.type === 'slides' && !r.file && !r.url) fail('file', 'Upload the deck or add a link.')
    if (r.type === 'slides' && r.file && r.url) fail('url', 'Use either an upload or a link, not both.')
  })

export const artistPayload = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, 'Artist name is required.').max(100, 'Keep the name under 100 characters.'),
    slug: z.string().trim().toLowerCase()
      .min(SLUG_MIN, `At least ${SLUG_MIN} characters.`).max(SLUG_MAX, `At most ${SLUG_MAX} characters.`)
      .refine(isValidSlug, 'Lowercase letters, numbers, and single hyphens only (and not a reserved word).'),
    emails: z.array(z.object({email: emailField, label: z.string().trim().max(40).default(''), isPrimary: z.boolean()})).min(1),
    hiddenResourceIds: z.array(z.uuid()),
    exclusiveResources: z.array(resourceInput),
  })
  .superRefine((a, ctx) => {
    if (a.emails.filter((e) => e.isPrimary).length !== 1)
      ctx.addIssue({code: 'custom', path: ['emails'], message: 'Add a primary email.'})
    const seen = new Set<string>()
    a.emails.forEach((e, i) => {
      if (seen.has(e.email)) ctx.addIssue({code: 'custom', path: ['emails', i, 'email'], message: 'This email is listed twice.'})
      seen.add(e.email)
    })
  })

export type ArtistPayload = z.infer<typeof artistPayload>
```

### 8.5 Artist actions

```ts
// app/(admin)/admin/(panel)/artists/actions.ts
'use server'
import {redirect} from 'next/navigation'
import {requireAdmin} from '@/lib/admin/auth'
import {sweepStorage} from '@/lib/admin/storage'
import {artistPayload} from '@/lib/validation'

export type SaveResult = {ok: false; fieldErrors: Record<string, string>; formError?: string}

const PG_ERRORS: Record<string, {field: string; message: string}> = {
  artists_slug_key: {field: 'slug', message: 'Another artist already uses this URL. Pick a different one.'},
  artist_emails_artist_id_email_key: {field: 'emails', message: 'This email is listed twice.'},
}

export async function saveArtist(input: unknown): Promise<SaveResult> {
  const {supabase} = await requireAdmin()
  const parsed = artistPayload.safeParse(input)
  if (!parsed.success) {
    return {ok: false, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message]))}
  }

  const {data: id, error} = await supabase.rpc('save_artist', {payload: parsed.data})
  if (error) {
    const known = Object.entries(PG_ERRORS).find(([constraint]) => error.message.includes(constraint) || error.details?.includes(constraint))
    if (known) return {ok: false, fieldErrors: {[known[1].field]: known[1].message}}
    console.error('save_artist failed:', error.code, error.message)
    return {ok: false, fieldErrors: {}, formError: 'Couldn’t save. Nothing was changed. Try again.'}
  }

  await sweepStorage(supabase) // removed or replaced files, best effort
  redirect(`/admin/artists/${id}?saved=1`)
}

export async function deleteArtist(id: string) {
  const {supabase} = await requireAdmin()
  const {error} = await supabase.from('artists').delete().eq('id', id)
  if (error) throw new Error('Couldn’t delete the artist.')
  await sweepStorage(supabase)
  redirect('/admin')
}
```

```ts
// lib/admin/storage.ts
import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '@/lib/supabase/database.types'

/** Deletes objects queued by the resources_garbage trigger. Failures are logged and left for the sweep script. */
export async function sweepStorage(supabase: SupabaseClient<Database>) {
  const {data, error} = await supabase.rpc('take_storage_garbage')
  if (error || !data?.length) return
  const byBucket = new Map<string, string[]>()
  for (const {bucket, path} of data) byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path])
  for (const [bucket, paths] of byBucket) {
    const {error: removeError} = await supabase.storage.from(bucket).remove(paths)
    if (removeError) console.error(`storage cleanup failed for ${bucket}:`, removeError.message)
  }
}
```

### 8.6 Uploads (D36)

```ts
// app/(admin)/admin/(panel)/uploads/actions.ts
'use server'
import {z} from 'zod'
import {requireAdmin} from '@/lib/admin/auth'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const FILE_TYPES: Record<string, (mime: string) => boolean> = {
  pdf: (m) => m === 'application/pdf',
  video: (m) => m.startsWith('video/'),
  slides: (m) => ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint', 'application/vnd.apple.keynote'].includes(m),
}
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const uploadRequest = z.object({
  resourceId: z.uuid(),
  kind: z.enum(['file', 'cover', 'preview']),
  resourceType: z.enum(['pdf', 'video', 'slides', 'link']),
  fileName: z.string().max(200),
  contentType: z.string(),
  size: z.number().int().positive(),
})

export async function createUploadTarget(input: z.input<typeof uploadRequest>) {
  const {supabase} = await requireAdmin()
  const req = uploadRequest.parse(input)

  const isImage = req.kind !== 'file'
  if (isImage && (!IMAGE_TYPES.includes(req.contentType as never) || req.size > MAX_IMAGE_BYTES))
    throw new Error('Cover images must be JPG, PNG, or WebP and at most 5 MB.')
  if (!isImage && !FILE_TYPES[req.resourceType]?.(req.contentType))
    throw new Error('That file doesn’t match the resource type.')

  const ext = req.fileName.includes('.') ? `.${req.fileName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')}` : ''
  const bucket = isImage ? 'resource-images' : 'resource-files'
  const path = `${req.resourceId}/${req.kind}-${crypto.randomUUID()}${ext}`
  const {data, error} = await supabase.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) throw new Error('Upload not allowed.')
  return {bucket, path: data.path, token: data.token}
}
```

```ts
// lib/admin/upload.ts (browser)
import {createClient} from '@supabase/supabase-js'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'
import {createUploadTarget} from '@/app/(admin)/admin/(panel)/uploads/actions'

// Storage only: no session, no cookies (D21 still holds: auth cookies are only ever set by the server).
const storage = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
}).storage

export async function uploadAsset(args: {
  resourceId: string
  kind: 'file' | 'cover' | 'preview'
  resourceType: 'pdf' | 'video' | 'slides' | 'link'
  file: File | Blob
  fileName: string
}): Promise<string> {
  const {bucket, path, token} = await createUploadTarget({
    resourceId: args.resourceId, kind: args.kind, resourceType: args.resourceType,
    fileName: args.fileName, contentType: args.file.type, size: args.file.size,
  })
  const {error} = await storage.from(bucket).uploadToSignedUrl(path, token, args.file, {contentType: args.file.type})
  if (error) throw error
  return path
}
```

```ts
// lib/admin/lqip.ts (browser). Same idea as Sanity's metadata.lqip: a ~20 px wide base64 JPEG (D42).
const LQIP_WIDTH = 20

export async function makeLqip(image: Blob): Promise<string> {
  const bitmap = await createImageBitmap(image)
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * LQIP_WIDTH))
  const canvas = document.createElement('canvas')
  canvas.width = LQIP_WIDTH
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, LQIP_WIDTH, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.6)
}
```

`ResourceEditor` runs `makeLqip(file)` next to the cover upload and stores the result in the draft's `coverImageLqip`. For PDFs it runs it on the rendered first-page blob and stores `pdfPreviewLqip`.

**PDF preview**: move `renderFirstPage()` from `sanity/components/PdfPreviewInput.tsx` to `lib/admin/pdf-preview.ts` (`pdfjs-dist` stays a dependency). When an admin picks a PDF, the editor renders page 1 from `URL.createObjectURL(file)`, uploads the JPEG as `kind: 'preview'`, and stores the path in `pdfPreview`. It's the same behaviour as D8, without Studio.

Uploads land in Storage before **Save**. If the admin abandons the form, the objects are orphaned. They're cleaned by a **manual sweep** (D43). Run `npm run storage:sweep` to see what it would delete, and `npm run storage:sweep -- --delete` to delete it. Monthly, or whenever Storage usage looks high, is enough.

```ts
// scripts/storage-sweep.ts. Dry run unless --delete. Uses the secret key (bypasses RLS and Storage policies).
import {createClient} from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: {persistSession: false},
})
const DELETE = process.argv.includes('--delete')
const MIN_AGE_MS = 24 * 60 * 60 * 1000 // never touch uploads from a form someone may still have open
const PAGE = 1000

async function list(bucket: string, prefix: string) {
  const items: {name: string; created_at: string | null; id: string | null}[] = []
  for (let offset = 0; ; offset += PAGE) {
    const {data, error} = await supabase.storage.from(bucket).list(prefix, {limit: PAGE, offset})
    if (error) throw error
    items.push(...data)
    if (data.length < PAGE) return items
  }
}

async function main() {
  const {data: rows, error} = await supabase.from('resources').select('file, cover_image, pdf_preview')
  if (error) throw error
  const referenced = new Set(rows.flatMap((r) => [r.file, r.cover_image, r.pdf_preview]).filter(Boolean))

  for (const bucket of ['resource-files', 'resource-images']) {
    const orphans: string[] = []
    // Paths are {resourceId}/{kind}-{uuid}.{ext}: top-level entries are folders (id === null).
    for (const folder of await list(bucket, '')) {
      if (folder.id !== null) continue
      for (const object of await list(bucket, folder.name)) {
        const path = `${folder.name}/${object.name}`
        const age = Date.now() - new Date(object.created_at ?? 0).getTime()
        if (!referenced.has(path) && age > MIN_AGE_MS) orphans.push(path)
      }
    }
    console.log(`${bucket}: ${orphans.length} orphaned object(s)`)
    orphans.forEach((path) => console.log('  ', path))
    if (DELETE && orphans.length) {
      for (let i = 0; i < orphans.length; i += PAGE) {
        const {error: removeError} = await supabase.storage.from(bucket).remove(orphans.slice(i, i + PAGE))
        if (removeError) throw removeError
      }
      console.log(`  deleted ${orphans.length}`)
    }
  }
  if (!DELETE) console.log('Dry run. Re-run with --delete to remove these.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

### 8.7 The artist form

A single client component handles both `/admin/artists/new` and `/admin/artists/[id]`.

```tsx
// components/admin/ArtistForm.tsx
'use client'
import {useMemo, useRef, useState, useTransition} from 'react'
import {saveArtist, type SaveResult} from '@/app/(admin)/admin/(panel)/artists/actions'
import {groupByCategory} from '@/lib/resources/group'
import type {Resource} from '@/lib/resources/types'
import {slugify} from '@/lib/slug'
import {ConfirmDialog} from './ConfirmDialog'
import {EmailRows, type EmailRow} from './EmailRows'
import {ResourceEditor, type ResourceDraft} from './ResourceEditor'

export type ArtistFormInitial = {
  id?: string
  name: string
  slug: string
  primaryEmail: string
  auxEmails: EmailRow[]
  hiddenResourceIds: string[]
  exclusiveResources: ResourceDraft[]
}

export function ArtistForm({initial, mainResources, categories}: {
  initial: ArtistFormInitial
  mainResources: Resource[]
  categories: string[]
}) {
  const isNew = !initial.id
  const [name, setName] = useState(initial.name)
  const [slug, setSlug] = useState(initial.slug)
  const [slugTouched, setSlugTouched] = useState(!isNew) // auto-fill only while creating, until edited
  const [primaryEmail, setPrimaryEmail] = useState(initial.primaryEmail)
  const [auxEmails, setAuxEmails] = useState(initial.auxEmails)
  const [hidden, setHidden] = useState(() => new Set(initial.hiddenResourceIds))
  const [exclusives, setExclusives] = useState(initial.exclusiveResources)
  const [result, setResult] = useState<SaveResult | null>(null)
  const [saving, startSaving] = useTransition()
  const slugDialog = useRef<HTMLDialogElement>(null)

  const slugChanged = !isNew && slug !== initial.slug
  const groups = useMemo(() => groupByCategory(mainResources), [mainResources])
  const errors = result?.fieldErrors ?? {}

  const onName = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const toggleHidden = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const submit = () =>
    startSaving(async () => {
      // On success saveArtist redirects, so only failures come back.
      setResult(
        await saveArtist({
          id: initial.id,
          name,
          slug,
          emails: [
            {email: primaryEmail, label: 'Artist', isPrimary: true},
            ...auxEmails.filter((r) => r.email.trim()).map((r) => ({email: r.email, label: r.label, isPrimary: false})),
          ],
          hiddenResourceIds: [...hidden],
          exclusiveResources: exclusives.map(({localStatus, ...r}) => r),
        }),
      )
    })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (slugChanged) slugDialog.current?.showModal()
        else submit()
      }}
    >
      <label>Artist name
        <input value={name} onChange={(e) => onName(e.target.value)} maxLength={100} required />
        {errors.name && <span role="alert">{errors.name}</span>}
      </label>

      <label>URL slug
        <span>welcometovydia.com/</span>
        <input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} minLength={3} maxLength={60} required />
        {slugChanged && <p role="status">The old link will stop working - send the artist the new one.</p>}
        {errors.slug && <span role="alert">{errors.slug}</span>}
      </label>

      <label>Primary email
        <input type="email" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} required />
      </label>

      <EmailRows rows={auxEmails} onChange={setAuxEmails} errors={errors} />

      <fieldset>
        <legend>Main resources</legend>
        {groups.map((group) => (
          <section key={group.key}>
            <h3>{group.category}</h3>
            <ul>
              {group.items.map((r) => (
                <li key={r.id} data-hidden={hidden.has(r.id) || undefined}>
                  <span>{r.title}</span>
                  <button type="button" onClick={() => toggleHidden(r.id)}>
                    {hidden.has(r.id) ? 'Restore' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </fieldset>

      <fieldset>
        <legend>Exclusive resources</legend>
        <ResourceEditor list={exclusives} onChange={setExclusives} categories={categories} />
      </fieldset>

      {result?.formError && <p role="alert">{result.formError}</p>}
      <button disabled={saving || exclusives.some((r) => r.localStatus === 'uploading')}>
        {saving ? 'Saving…' : 'Save'}
      </button>

      <ConfirmDialog
        ref={slugDialog}
        title="Change this artist’s link?"
        body={`The old link will stop working - send the artist the new one: welcometovydia.com/${slug}`}
        confirmLabel="Save and change link"
        onConfirm={submit}
      />
    </form>
  )
}
```

- `[data-hidden]` rows are grayed out (`opacity: .45; text-decoration: line-through` on the title).
- `EmailRows`: add/remove rows, each with an email and an optional label field (the label is a `<datalist>` with Manager / Alt / Assistant suggestions).
- `ResourceEditor`: a list of drafts with add/edit/delete in an inline panel. Each draft gets `id: crypto.randomUUID()` on creation, so uploads can use it as their path prefix before the row exists (D36). Fields: title, type (radio from `RESOURCE_TYPES`), and a file **or** URL input shown per type (the same visibility rules as Sanity's `hidden:` callbacks). Then an optional cover image with alt text, category (`<CategoryInput>`), and an "Added on" date under a disclosure that defaults to today. `localStatus: 'uploading' | 'ready' | 'error'` drives the progress UI and blocks Save while an upload is running.

```tsx
// components/admin/CategoryInput.tsx — suggests existing categories while typing (native datalist)
export function CategoryInput({value, onChange, categories, id}: {
  value: string; onChange: (v: string) => void; categories: string[]; id: string
}) {
  return (
    <>
      <input list={`${id}-list`} value={value} onChange={(e) => onChange(e.target.value)} required />
      <datalist id={`${id}-list`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  )
}
```

`categories` comes from `select distinct category from resources` (admins can read every row), de-duplicated case-insensitively in TS.

### 8.8 New and detail pages

```tsx
// app/(admin)/admin/(panel)/artists/new/page.tsx
export const instant = false

export default async function NewArtist() {
  const {supabase} = await requireAdmin()
  const {mainResources, categories} = await loadResourceContext(supabase)
  return (
    <>
      <h1>New artist</h1>
      <ArtistForm
        initial={{name: '', slug: '', primaryEmail: '', auxEmails: [], hiddenResourceIds: [], exclusiveResources: []}}
        mainResources={mainResources}
        categories={categories}
      />
    </>
  )
}
```

```tsx
// app/(admin)/admin/(panel)/artists/[id]/page.tsx
export const instant = false

export default async function ArtistDetail({params, searchParams}: PageProps<'/admin/artists/[id]'>) {
  const {id} = await params
  const {saved} = await searchParams
  const {supabase} = await requireAdmin()
  const [{data: artist}, ctx] = await Promise.all([
    supabase
      .from('artists')
      .select('id, name, slug, artist_emails(email, label, is_primary), artist_hidden_resources(resource_id), resources(*)')
      .eq('id', id)
      .maybeSingle(),
    loadResourceContext(supabase),
  ])
  if (!artist) notFound() // admin side: a normal 404 is fine

  return (
    <>
      <section className={styles.welcome}>
        {saved && <p role="status">Saved.</p>}
        <h1>{artist.name}</h1>
        <code>{welcomeLink(artist.slug)}</code>
        <CopyLinkButton slug={artist.slug} />
        <a href={`/${artist.slug}`} target="_blank" rel="noopener">Open page</a>
      </section>

      <ArtistForm key={artist.slug} initial={toFormInitial(artist)} {...ctx} />

      <DeleteArtistButton id={artist.id} name={artist.name} />
    </>
  )
}
```

`DeleteArtistButton` opens a `ConfirmDialog` ("Delete {name}? Their page, emails, hidden resources, and exclusive resources are permanently deleted.") and calls `deleteArtist(id)`.

### 8.9 Main resources page

```tsx
// app/(admin)/admin/(panel)/resources/page.tsx
export const instant = false

export default async function MainResources() {
  const {supabase} = await requireAdmin()
  const {data} = await supabase.from('resources').select('*').is('artist_id', null).order('sort_order')
  const resources = (data ?? []).map(fromRow)
  return (
    <>
      <header><h1>Main resources</h1><NewMainResourceButton categories={distinctCategories(resources)} /></header>
      <p>Changes here apply to every artist immediately.</p>
      <SortableResourceList groups={groupByCategory(resources)} />
    </>
  )
}
```

```ts
// app/(admin)/admin/(panel)/resources/actions.ts
'use server'
import {refresh} from 'next/cache'
import {z} from 'zod'
import {requireAdmin} from '@/lib/admin/auth'
import {sweepStorage} from '@/lib/admin/storage'
import {resourceInput} from '@/lib/validation'

const toRow = (r: z.infer<typeof resourceInput>) => ({
  id: r.id, artist_id: null, title: r.title, type: r.type, file: r.file, url: r.url,
  cover_image: r.coverImage, cover_image_alt: r.coverImageAlt, cover_image_lqip: r.coverImageLqip,
  pdf_preview: r.pdfPreview, pdf_preview_lqip: r.pdfPreviewLqip, category: r.category, ...(r.addedOn ? {added_on: r.addedOn} : {}),
})

export async function upsertMainResource(input: unknown) {
  const {supabase} = await requireAdmin()
  const parsed = resourceInput.safeParse(input)
  if (!parsed.success) return {ok: false as const, issues: parsed.error.issues}
  const {error} = await supabase.from('resources').upsert(toRow(parsed.data))
  if (error) return {ok: false as const, issues: [{path: [], message: 'Couldn’t save the resource.'}]}
  await sweepStorage(supabase)
  refresh()
  return {ok: true as const}
}

export async function deleteMainResource(id: string) {
  const {supabase} = await requireAdmin()
  await supabase.from('resources').delete().eq('id', z.uuid().parse(id)).is('artist_id', null)
  await sweepStorage(supabase)
  refresh()
}

export async function reorderMainResources(ids: string[]) {
  const {supabase} = await requireAdmin()
  const {error} = await supabase.rpc('reorder_main_resources', {ids: z.array(z.uuid()).parse(ids)})
  if (error) throw new Error('Couldn’t save the new order.')
  refresh()
}
```

`SortableResourceList` uses `@dnd-kit/core` + `@dnd-kit/sortable` (new dependencies). They're accessible (keyboard dragging with screen-reader announcements) and work with plain CSS. Reordering:

- **Within a category**: drag a row.
- **Categories themselves**: drag the category header. The category order is the position of its first resource.
- Both produce one flattened id list in display order → `reorderMainResources(ids)`, applied optimistically with `useOptimistic`, then `refresh()`.

Deleting a main resource also removes every artist's hide row for it (FK cascade), and its file is queued for cleanup.

---

## 9. Removing Sanity and the old sign-in (after the migration has run)

1. Delete `app/studio/`, `app/api/revalidate/`, `lib/sanity/`, `sanity.config.ts`, `sanity.cli.ts`, `sanity/actions/`, `sanity/components/`, `sanity/schemaTypes/`, `sanity/structure.ts`, `sanity/env.ts`, `scripts/seed.ts`, `components/RichText.*`, `components/NoAccess.tsx`, `app/(site)/[slug]/not-found.tsx`, `app/(site)/login/`, `app/(site)/auth/callback/`, `app/(site)/auth/signout/`, `app/(site)/auth/confirm/page.tsx` + `actions.ts` (replaced by `route.ts`, D33). Delete `lib/access.ts` too: its helpers move to `lib/email.ts` and `lib/slug.ts`.
2. **Keep `sanity/schema.json`**, and add `sanity/README.md`: "Frozen contract for resource fields. Sanity is no longer used at runtime. Change this file only together with the Supabase migration, the TS types, and `tests/schema-parity.test.ts`."
3. `npm uninstall sanity next-sanity @sanity/icons @sanity/image-url @sanity/ui @sanity/vision @sanity/webhook @portabletext/react styled-components`.
4. `npm install zod @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` and `npm install -D tsx` (scripts import app modules with extensionless paths and the `@/` alias, which plain `node --experimental-strip-types` can't resolve).
5. `package.json` scripts: remove `typegen`, `e2e:setup`/`e2e:teardown` via `sanity exec`. Add:

```json
"db:types": "supabase gen types typescript --project-id \"$SUPABASE_PROJECT_ID\" > lib/supabase/database.types.ts",
"db:test": "supabase test db",
"db:push": "supabase db push",
"migrate:sanity": "tsx --env-file=.env.local scripts/migrate-sanity.ts",
"storage:sweep": "tsx --env-file=.env.local scripts/storage-sweep.ts",
"e2e:setup": "tsx --env-file-if-exists=.env.local scripts/e2e-fixtures.ts",
"e2e:teardown": "tsx --env-file-if-exists=.env.local scripts/e2e-fixtures.ts teardown"
```

(`migrate:sanity` runs **before** step 3, while `@sanity/client` is still installed. Alternatively install `@sanity/client` as a devDependency just for that run.)

6. Sanity dashboard: once production has been verified on Supabase, cancel the plan (the README's "upgrade to Growth before the trial ends" item no longer applies) and revoke the read token and webhook.

Old magic-link emails still sitting in inboxes point to `/auth/confirm?…&redirect_to=/some-slug`, which keeps working. Old `/login?next=/x` bookmarks now hit `/[slug]` with slug `login`, which is reserved, so they see the Enter your email screen. If that's confusing, add a `redirects()` entry in `next.config.ts` from `/login` to `/`.

---

## 10. One-time migration: `scripts/migrate-sanity.ts`

Inputs: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_READ_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Flags: `--dry-run`, `--default-category "Resources"` (escape hatch if categories weren't filled in).

What it migrates: **main resources only**, meaning the Website singleton's `resources[]` in order. Sanity artists (mostly test records) and override-only resources are **not** migrated. Label services recreate artists in the admin (spec: Seismic artists are out of scope, and the same applies to Sanity's). Skipped documents are listed in the report.

```ts
// scripts/migrate-sanity.ts
import {createHash} from 'node:crypto'
import {createClient as createSanity} from '@sanity/client'
import {createClient as createSupabase} from '@supabase/supabase-js'
import {resourceInput} from '@/lib/validation'

const dryRun = process.argv.includes('--dry-run')
const defaultCategory = process.argv[process.argv.indexOf('--default-category') + 1]

const sanity = createSanity({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2025-02-19',
  token: process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  perspective: 'published',
})
const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: {persistSession: false},
})

/** Stable UUID per Sanity _id, so re-running the script updates rows instead of duplicating them. */
function uuidFromSanityId(id: string) {
  const h = createHash('sha1').update(`welcome-to-vydia:${id}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

type SanityResource = {
  _id: string
  title: string | null
  type: 'pdf' | 'video' | 'link' | 'slides' | null
  url: string | null
  category: string | null
  sortOrder: number | null
  addedOn: string | null
  _createdAt: string
  file: {url: string; originalFilename: string | null; mimeType: string} | null
  coverImage: {
    alt: string | null
    hotspot: {x: number; y: number} | null
    crop: {top: number; bottom: number; left: number; right: number} | null
    asset: {url: string; mimeType: string; width: number; height: number; lqip: string | null} | null
  } | null
  pdfPreview: {asset: {url: string; lqip: string | null} | null} | null
}

const QUERY = `*[_id == "website"][0].resources[defined(@->_id)]->{
  _id, _createdAt, title, type, url, category, sortOrder, addedOn,
  "file": file.asset->{url, originalFilename, mimeType},
  coverImage{alt, hotspot, crop, "asset": asset->{url, mimeType, "width": metadata.dimensions.width, "height": metadata.dimensions.height, "lqip": metadata.lqip}},
  pdfPreview{"asset": asset->{url, "lqip": metadata.lqip}}
}`

/** Bake Sanity's crop into the image (rect=…) and move the hotspot into the cropped frame. */
function croppedCover(cover: NonNullable<SanityResource['coverImage']>) {
  const {asset, crop, hotspot} = cover
  if (!asset) return null
  const c = crop ?? {top: 0, bottom: 0, left: 0, right: 0}
  const w = 1 - c.left - c.right
  const h = 1 - c.top - c.bottom
  const rect = [c.left * asset.width, c.top * asset.height, w * asset.width, h * asset.height].map(Math.round).join(',')
  const url = `${asset.url}?rect=${rect}&w=2000&fit=max&fm=webp&q=85`
  const moved = hotspot ? {x: clamp((hotspot.x - c.left) / w), y: clamp((hotspot.y - c.top) / h)} : null
  return {url, hotspot: moved}
}
const clamp = (n: number) => Math.min(1, Math.max(0, n))

async function copy(url: string, bucket: string, path: string, contentType: string) {
  if (dryRun) return path
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download ${url}: ${response.status}`)
  const {error} = await supabase.storage.from(bucket).upload(path, await response.blob(), {contentType, upsert: true})
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`)
  return path
}

async function main() {
  const docs = (await sanity.fetch<SanityResource[] | null>(QUERY)) ?? []
  const report = {migrated: [] as string[], skipped: [] as string[]}

  for (const [index, doc] of docs.entries()) {
    const id = uuidFromSanityId(doc._id)
    const category = doc.category?.trim() || defaultCategory
    if (!category) { report.skipped.push(`${doc._id} "${doc.title}": no category`); continue }

    const ext = (name: string | null | undefined) => name?.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? ''
    const file = doc.file && (doc.type !== 'link')
      ? await copy(doc.file.url, 'resource-files', `${id}/file${ext(doc.file.originalFilename)}`, doc.file.mimeType)
      : null
    const cover = doc.coverImage && croppedCover(doc.coverImage)
    const coverPath = cover ? await copy(cover.url, 'resource-images', `${id}/cover.webp`, 'image/webp') : null
    const previewPath = !coverPath && doc.type === 'pdf' && doc.pdfPreview?.asset
      ? await copy(`${doc.pdfPreview.asset.url}?fm=webp&q=85`, 'resource-images', `${id}/preview.webp`, 'image/webp')
      : null

    const candidate = {
      id, title: doc.title ?? '', type: doc.type ?? 'pdf', file, url: doc.url,
      coverImage: coverPath, coverImageAlt: doc.coverImage?.alt ?? null,
      // D42: Sanity's own LQIP, exactly what the site shows today.
      coverImageLqip: coverPath ? (doc.coverImage?.asset?.lqip ?? null) : null,
      pdfPreview: previewPath, pdfPreviewLqip: previewPath ? (doc.pdfPreview?.asset?.lqip ?? null) : null,
      category, addedOn: doc.addedOn ?? doc._createdAt,
    }
    const parsed = resourceInput.safeParse(candidate)
    if (!parsed.success) {
      report.skipped.push(`${doc._id} "${doc.title}": ${parsed.error.issues.map((i) => i.message).join('; ')}`)
      continue
    }

    if (!dryRun) {
      const {error} = await supabase.from('resources').upsert({
        id, artist_id: null, title: parsed.data.title, type: parsed.data.type,
        file: parsed.data.file, url: parsed.data.url,
        cover_image: coverPath, cover_image_alt: parsed.data.coverImageAlt, cover_image_hotspot: cover?.hotspot ?? null,
        cover_image_lqip: parsed.data.coverImageLqip, pdf_preview: previewPath,
        pdf_preview_lqip: parsed.data.pdfPreviewLqip, category: parsed.data.category,
        sort_order: doc.sortOrder ?? index + 1, added_on: parsed.data.addedOn,
      })
      if (error) throw new Error(`insert ${doc._id}: ${error.message}`)
    }
    report.migrated.push(`${doc._id} → ${id} "${doc.title}" [${category}]`)
  }

  console.log(`${dryRun ? '[dry run] ' : ''}migrated ${report.migrated.length}, skipped ${report.skipped.length}`)
  report.migrated.forEach((line) => console.log('  ✓', line))
  report.skipped.forEach((line) => console.log('  ✗', line))
  if (report.skipped.length) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exit(1) })
```

Run order: `--dry-run` against a local Supabase (`supabase start`), then for real locally, QA, then `--dry-run` and a real run against the new project `lsihwkbnrheczirlkswo`. The script is idempotent (deterministic ids + `upsert`). The secret key bypasses RLS, and this is the only place, besides `lib/supabase/service.ts`, `scripts/storage-sweep.ts`, and the e2e fixtures, that uses it.

---

## 11. Email (Resend as Supabase SMTP)

- **Resend**: add and verify the sending domain (SPF, DKIM, and ideally DMARC on `vydia.com` or a subdomain such as `mail.welcometovydia.com`; needs Vydia IT for DNS). Create an API key with "sending access" only.
- **Supabase → Auth → SMTP**: host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key, sender `welcome@vydia.com` as a **placeholder for now** (swap it before launch, task 12.4; the domain verified in Resend must match), sender name "Vydia".
- **Templates**: keep `supabase/templates/magic-link.html` and `confirm-signup.html` (both must send the same link, since Supabase uses Confirm signup for first-time users). Update the branding and copy:
  - Replace the text "VYDIA" header with the logo image hosted at `${SITE_URL}/vydia-logo.png` (a PNG export of `docs/logo/gamma-vydia-white.svg`; email clients block SVG).
  - Copy: "Open your Welcome to Vydia page", with "This link works once and expires in 1 hour".
  - The link is unchanged: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`.
- **Rate limits**: raise "emails per hour" (e.g. 100) once SMTP is custom. Keep Supabase's per-email 60 s OTP limit, which matches ours.
- All of the above has to be set **on the new project** (§12.1). None of it carries over from the old one.

---

## 12. Supabase project setup (new project `lsihwkbnrheczirlkswo`)

Iteration two runs on a **new** Supabase project, `lsihwkbnrheczirlkswo`. `.env.local` already points at it. The old project (`cqqzvzljlthrqrttqnga`) keeps serving the live iteration-one site until cutover (§12.4).

The new project was set up to match the old one. Several settings that magic links and Google sign-in depend on are tied to a specific project, though, so they have to be set (or checked) again. The magic-link items are first.

### 12.1 Magic-link email (has to be redone on the new project)

| # | Where | Setting | Why it matters on a new project |
|---|---|---|---|
| E1 | Auth → **SMTP Settings** | Enable custom SMTP: `smtp.resend.com`, port `465`, user `resend`, password = Resend API key, sender `welcome@vydia.com` (placeholder, §11), name "Vydia" | A new project starts on Supabase's built-in sender, which only delivers to project team members and only a few emails an hour. Artists get nothing until this is set. |
| E2 | Resend | Domain verified (SPF/DKIM). API key with sending access only. You can reuse the old project's key, but a separate key per project is cleaner to revoke. | The SMTP password above |
| E3 | Auth → **Email Templates → Magic Link** and **Confirm signup** | Paste the subject (first line) and body from `supabase/templates/magic-link.html` and `confirm-signup.html` (updated per §11) | Templates don't carry over between projects. Both must link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`. The default template uses `{{ .ConfirmationURL }}`, which goes through Supabase's own verify endpoint and doesn't work with our `/auth/confirm` route. |
| E4 | Auth → **URL Configuration** | Site URL `https://welcometovydia.com` (`http://localhost:3000` is fine while only developing). Redirect URLs: `http://localhost:3000/**`, `https://welcometovydia.com/**`, the Vercel preview pattern (`https://*-<team>.vercel.app/**`) | `emailRedirectTo` = `SITE_URL/{slug}` must match an allowed URL, or Supabase silently falls back to the Site URL and artists land on `/` instead of their page |
| E5 | Auth → **Rate Limits** | "Emails sent" per hour: raise (e.g. 100) once custom SMTP is on. Keep the 60 s per-user OTP interval. | The default email limit is tiny, and the 60 s interval matches the spec's resend cooldown |
| E6 | Auth → **Providers → Email** | Enabled. Email OTP expiry `3600`. "Confirm email" can stay on. | Matches "expires in 1 hour" in the template |
| E7 | Auth → **Sign In / Providers** | "Allow new users to sign up" **on** | First-time artists are created by `signInWithOtp`. The hook (E8) is what keeps strangers out. |
| E8 | Auth → **Hooks → Before User Created** | Postgres → `public.hook_before_user_created` (exists after the migration, §4.7) | Without it, D30 doesn't hold |

### 12.2 Everything else on the new project

| # | Where | Setting |
|---|---|---|
| P1 | **Google Cloud** → APIs & Services → Credentials → the OAuth client | Add the new callback to **Authorized redirect URIs**: `https://lsihwkbnrheczirlkswo.supabase.co/auth/v1/callback`. Keep the old one until cutover. Copying the client ID and secret into the new project isn't enough: without this URI, Google sign-in fails with `redirect_uri_mismatch`. |
| P2 | Auth → Providers → **Google** | Enabled, with the same client ID and secret |
| P3 | Auth → **Sessions** | Time-box **never**, inactivity **never**, single session per user **off** (D11) |
| P4 | Settings → **JWT Keys** | Use asymmetric signing keys (ECC/RSA), so `getClaims()` in the proxy and pages verifies locally. With only the legacy HS256 secret it falls back to a network call to Auth on every request. |
| P5 | Settings → **API Keys** | Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. New secret key → `SUPABASE_SECRET_KEY` (§6.1) |
| P6 | **Billing / plan** | Storage's global file size limit is 50 MB on Free. Videos need Pro, with the global limit raised to ≥ 1 GB under Storage → Settings (bucket limit, §4.8). |
| P7 | Storage | Nothing by hand: the migration creates both buckets and their policies |
| P8 | Table editor → `admins` | The migration seeds `labelservices@` and `creativeservices@` (D44). Add individual admins by hand. |
| P9 | Google Cloud → OAuth consent screen | "Internal" user type if the Google project is in Vydia's Workspace, so only `@vydia.com` accounts can even start sign-in |

### 12.3 Verify on the new project (behaviour the Supabase docs don't spell out)

Run these once with the migration applied and E1–E8 done, then write the results back into §4.7:

- [ ] V1 `signInWithOtp` for an email on an artist → user created, email arrives from Resend with the Vydia template, link → `/auth/confirm` → lands on `/{slug}` signed in.
- [ ] V2 `signInWithOtp` called **directly** (curl with the publishable key) for an unknown email → hook rejects, **no row in `auth.users`**, no email.
- [ ] V3 Google sign-in with a non-admin account → no `auth.users` row. Note what Supabase appends to `/admin/auth/callback` (it should end at "You don't have access." either way).
- [ ] V4 Google sign-in with a seeded admin → `/admin`, `admins.user_id`/`display_name`/`avatar_url` filled in.
- [ ] V5 Decode an artist access token: record whether `amr` is `otp` or `magiclink` (both are accepted).
- [ ] V6 Admin API `generate_link` / `createUser` for an unattached email: does the hook fire? This only affects the e2e fixtures, which attach emails first either way.

### 12.4 Cutover from the old project

- Vercel Production (previews of `iteration-two` already use the new project, task 0.13): switch `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the new project, and add `SUPABASE_SECRET_KEY`. GitHub Actions: update the `NEXT_PUBLIC_SUPABASE_URL` variable and replace the `SUPABASE_SERVICE_ROLE_KEY` secret with `SUPABASE_SECRET_KEY`.
- Sessions don't move between projects. The auth cookie name includes the project ref (`sb-<ref>-auth-token`), so old cookies are simply ignored and everyone signs in once more. That's harmless, because artists are being recreated and sent new links anyway.
- Old magic links in inboxes were issued by the old project and will fail with "This link has expired". Expected.
- After a week or so on the new project, pause the old project, and delete it once nobody needs it.

---

## 13. Testing

### 13.1 Unit (Vitest)

| File | What |
|---|---|
| `tests/schema-parity.test.ts` | `sanity/schema.json` resource fields equal `Object.keys(RESOURCE_FIELD_MAP)`. The type union equals `RESOURCE_TYPES`. Required/optional rules match `resourceInput`. |
| `tests/validation.test.ts` | Per-type file/url rules, title 120, name 100, slug 3–60 + reserved, email lowercase and duplicates, exactly one primary |
| `tests/slug.test.ts` | `slugify("Lil Example") === "lil-example"`, 60-char cap, `isValidSlug` |
| `tests/group.test.ts` | "getting started" and "Getting Started" form one group, keeps first-seen order and spelling |
| `tests/mapping.test.ts` | `toCard` hrefs (link → url, slides url vs file, pdf/video → `/api/resources/{id}/file`), cover fallback to pdfPreview, hotspot → object-position, LQIP carried from the image that's actually shown (D42) |
| `tests/send-link.test.ts` | Mock the service and stateless clients: unknown slug and wrong email return the **same** `{status:'not-approved'}`, and `signInWithOtp` isn't called. A cooldown hit returns `sent` without calling it. An invalid slug is never approved. |
| `tests/safe-redirect.test.ts` | Unchanged |

```ts
// tests/schema-parity.test.ts
import {describe, expect, it} from 'vitest'
import schema from '@/sanity/schema.json'
import {RESOURCE_FIELD_MAP} from '@/lib/resources/mapping'
import {RESOURCE_TYPES} from '@/lib/resources/types'

type Attr = {type: string; value: {type: string; of?: {value: string}[]}; optional?: boolean}
const resource = (schema as {name: string; attributes?: Record<string, Attr>}[]).find((t) => t.name === 'resource')!
const fields = Object.keys(resource.attributes!).filter((k) => !k.startsWith('_'))

describe('Sanity ↔ Supabase resource contract', () => {
  it('maps every Sanity field and nothing else', () => {
    expect(fields.sort()).toEqual(Object.keys(RESOURCE_FIELD_MAP).sort())
  })
  it('allows exactly the Sanity resource types, in order', () => {
    expect(resource.attributes!.type.value.of!.map((o) => o.value)).toEqual(RESOURCE_TYPES.map((t) => t.value))
  })
})
```

### 13.2 Database (pgTAP, `supabase test db`)

`supabase/tests/rls.test.sql` covers every RLS-related success state. It impersonates users by setting the role and JWT claims:

```sql
begin;
select plan(13);

-- fixtures
insert into public.admins (email) values ('ops@vydia.com');
insert into public.artists (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Artist A', 'artist-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Artist B', 'artist-b');
insert into public.artist_emails (artist_id, email, label, is_primary) values
  ('00000000-0000-0000-0000-00000000000a', 'lil@example.com', 'Artist', true),
  ('00000000-0000-0000-0000-00000000000a', 'manager@mgmt.com', 'Manager', false),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'Artist', true);
insert into public.resources (id, artist_id, title, type, url, category) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Main 1', 'link', 'https://a.test', 'Getting Started'),
  ('00000000-0000-0000-0000-0000000000c2', null, 'Main 2', 'link', 'https://b.test', 'getting started'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'A only', 'link', 'https://c.test', 'Your Releases');
insert into public.artist_hidden_resources values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2');

select is((select category from public.resources where title = 'Main 2'), 'Getting Started', 'categories normalize case-insensitively');

-- as A's manager (magic link session)
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"manager@mgmt.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';

select ok(public.get_artist_page('artist-a') is not null, 'linked email sees artist A');
select ok(public.get_artist_page('artist-b') is null, 'linked to A ⇒ B is invisible (same as unknown)');
select ok(public.get_artist_page('does-not-exist') is null, 'unknown slug ⇒ null');
select is(jsonb_array_length(public.get_artist_page('artist-a') -> 'resources'), 2, 'A sees Main 1 + its exclusive, not the hidden Main 2');
select is((select count(*)::int from public.artist_emails), 0, 'artist users cannot read email lists');
select ok(not public.is_admin(), 'a magic-link session is never admin');
select throws_ok($$ select public.save_artist('{}'::jsonb) $$, '42501', null, 'artist users cannot write');

-- as B
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"b@example.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';
select is((select count(*)::int from public.resources where title = 'A only'), 0, 'exclusive resources never leak to other artists');
select is((select count(*)::int from public.resources where title = 'Main 2'), 1, 'a hide on A does not affect B');

-- removing an email revokes on the next query, despite a live JWT
reset role;
delete from public.artist_emails where email = 'manager@mgmt.com';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"manager@mgmt.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';
select ok(public.get_artist_page('artist-a') is null, 'removed email loses access immediately');

-- admin via Google
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"ops@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';
select ok(public.is_admin(), 'listed @vydia.com Google session is admin');
select ok(public.get_artist_page('artist-b') is not null, 'admins see every artist page directly (D32)');

select * from finish();
rollback;
```

Add `supabase/tests/hook.test.sql`: `hook_before_user_created` allows email users on `artist_emails`, rejects unknown emails, rejects admin emails on the email provider, allows Google for admins, and rejects Google for everyone else. Also `email_can_access_slug` returns `false` for an unknown slug and a wrong email, and `true` only for the linked pair.

### 13.3 End-to-end (Playwright)

**Fixtures** (`scripts/e2e-fixtures.ts`, secret key): create `e2e-artist-a` (primary `delivered+a@resend.dev`, aux `delivered+mgr@resend.dev`) and `e2e-artist-b` (primary `delivered+b@resend.dev`). Add one main resource, one hidden on A, and one exclusive on A. Using Resend's `delivered@resend.dev` test addresses means real sends never bounce and never hurt sender reputation. Teardown deletes the artists (cascade) and the auth users.

**Sessions** (`global-setup.ts`): `generate_link` (now with the secret key), then `page.goto('/auth/confirm?token_hash=…&type=email&redirect_to=/')`. There's no Continue click any more: the GET signs in and redirects. Wait for `/`, then save the storage state for personas `artistA`, `manager`, `artistB`.

| Spec success state | Test |
|---|---|
| Made-up slug shows the same screen | Signed out: `/e2e-artist-a` and `/does-not-exist-<rand>` → status 200, `main` innerHTML equal, title "Welcome to Vydia", no artist name in the HTML |
| Wrong email: not-approved, nothing sent, no user | On `/e2e-artist-a` enter `nobody-<rand>@example.com` → not-approved text. Same on `/does-not-exist` with **any** email → identical text. Admin API `GET /auth/v1/admin/users` has no such user. |
| Approved email: sent + 60 s resend | On `/e2e-artist-a` enter the aux address → "Email sent, check your inbox", `Resend email (5\ds)` disabled |
| Primary + 2 aux all see the page | Personas `artistA`, `manager` (and a third aux) each see `region "Resources"` and the header greeting "Artist A" |
| Signed in for A, opens B | `artistA` → `/e2e-artist-b` → Enter your email, "Artist B" absent from the HTML |
| Exclusive on A only | `artistA` sees "A only"; `artistB` doesn't |
| Hide on A only | Hidden title absent on A, present on B |
| Removing an email revokes immediately | Fixture deletes the `manager` row → `manager` reloads `/e2e-artist-a` → Enter your email |
| Link signs in directly | A fresh `generate_link` token: `GET /auth/confirm?…&redirect_to=/e2e-artist-a` → 302 to `/e2e-artist-a` with `sb-` cookies → resources page. Replaces iteration one's "opening a link does not sign in until Continue" test, which is deleted. |
| Expired link | `GET /auth/confirm?token_hash=bogus&redirect_to=/e2e-artist-a` → "This link has expired" → button href `/e2e-artist-a`. The same happens when a used token is opened again in a new browser context. |
| Admin gate | Signed out `/admin` → `/admin/login`. A magic-link persona on `/admin` → "You don't have access." |
| Grid groups by category | `artistA` toggles to grid → `h2` per category. "Getting Started" appears once even with mixed case. |

Google sign-in can't be automated. Admin CRUD flows run against a local Supabase in a follow-up (seed an admin user with an `oauth` amr through a test-only token mint), or stay in manual QA for v1.

### 13.4 Manual QA

- Label services **and** creative services members each sign in to `/admin` with Google. A personal Gmail is rejected ("You don't have access."), and no row appears in `auth.users`.
- Create "Lil Example" with three emails, hide one main resource, add an exclusive PDF with a cover. Then Save, Copy link, open it in a private window, and do the magic-link flow for each email.
- Rename the slug: the warning shows, the confirm dialog appears, the old URL shows Enter your email, and the new URL works.
- Delete the artist: their page shows Enter your email, the slug can be reused, and the storage objects are gone.
- Resources page: create, edit, delete, drag within and across categories. Changes show on every artist's page on reload.
- Mobile Safari and Chrome: Enter your email, the sent state, the carousel, and the grid grouping.
- Magic-link email in Gmail/Outlook: branding, logo rendering, and the link landing straight on the artist's page. Test once with an Outlook/Microsoft 365 recipient to see whether Safe Links spends the token (§16).
- An admin signed in with Google opens several artist pages directly from "Open page" and sees resources, not the Enter your email screen (D32).

---

## 14. Implementation to-do list

### 14.0 How to use this list

- **IDs** (`6.13`) are stable. Other sections refer to them, so don't renumber; add new tasks at the end of a phase.
- **Owner tags:** `[dev]` code in this repo · `[ops]` dashboard work (Supabase, Vercel, Google Cloud, GitHub) · `[LS]` label services · `[IT]` Vydia IT (DNS).
- **Done when** is the check that closes a task. A task isn't done until that check passes.
- **Branches:** small Sanity change (Phase 1) ships on `main`, because label services use the **live** Studio. Everything else is built on `iteration-two`, and Vercel previews of that branch point at the new Supabase project (task 0.13). Production stays on iteration one and the old Supabase project until cutover (Phase 12).
- Unit tests and pgTAP tests are written **in the same task** as the code they cover. Phase 10 is for the end-to-end suite and CI wiring.

### 14.1 Phase order and dependencies

| Phase | Depends on | Can run in parallel with |
|---|---|---|
| 0 Accounts and environment | — | 1 |
| 1 Sanity contract (on `main`) | — | 0, 2 |
| 2 Database | 0.1–0.4 | 1 |
| 3 Shared libraries | 2.13 (DB types) | — |
| 4 Artist side | 3, 0.9–0.12 (email) | 5 |
| 5 Admin auth and shell | 3, 0.8 (Google) | 4 |
| 6 Admin: artists | 5 | — |
| 7 Admin: main resources | 6.12 (`ResourceEditor`) | 8 |
| 8 Sanity → Supabase migration | 1.4 (categories filled), 2.14, 3.6 | 7 |
| 9 Remove Sanity and old sign-in | 4, 8.5 | 10 |
| 10 End-to-end tests and CI | 4–7 | 9, 11 |
| 11 Docs | 6, 7 | 9, 10 |
| 12 QA, cutover, launch | all of the above | — |
| 13 Post-launch cleanup | 12 (+ about a week) | — |

**Critical path:** 0.1 → 2.x → 3.x → 4.x / 5.x → 6.x → 8.5 → 9.x → 12.x. The slowest **external** dependency is usually DNS for Resend (0.9), so start it on day one.

---

### Phase 0: Accounts and environment (2026-11-09: everything doable now is done; 0.6 is deferred to the Pro upgrade, and 0.9/0.10 to the domain purchase, see notes)

- [x] **0.1** `[dev]` Install the Supabase CLI (`brew install supabase/tap/supabase`) and Docker Desktop for the local stack. — *Done when:* `supabase --version` works and `supabase start` boots a local stack.
  - CLI 3.1.0 and Docker are installed. `supabase start` boots cleanly.
- [x] **0.2** `[dev]` `supabase init` in the repo. Keep the existing `supabase/templates/`. In `supabase/config.toml` set `[auth] site_url = "http://localhost:3000"` and `additional_redirect_urls = ["http://localhost:3000/**"]`, `[auth.email] otp_expiry = 3600`, and point `[auth.email.template.magic_link]` / `[auth.email.template.confirmation]` `content_path` at the two template files. — *Done when:* the local Inbucket/Mailpit inbox shows the Vydia template for a local magic link.
  - Verified: a local OTP request produced the Vydia-subject email in Mailpit with the `/auth/confirm?token_hash=…&type=email&redirect_to=…` link.
  - **Local ports moved to 55xxx** (API 55321, DB 55322, Studio 55323, Mailpit 55324) because another local Supabase stack (`vydia-roster`) already holds 54321–54327. Use `http://127.0.0.1:55324` for Mailpit.
  - Local `max_frequency` is `60s` (matches the spec's cooldown) and the local storage limit is `1GiB`.
  - `redirect_to` is a **query parameter** on `/auth/v1/otp` (supabase-js does this). A URL outside `additional_redirect_urls` silently falls back to the Site URL, so on the hosted project E4 must list the slug paths (`https://welcometovydia.com/**`).
- [x] **0.3** `[dev]` `supabase link --project-ref lsihwkbnrheczirlkswo`. — *Done when:* `supabase db remote commit --dry-run` (or `supabase migration list`) reaches the new project.
  - Verified: `supabase link` succeeded for `Welcome to Vydia (lsihwkbnrheczirlkswo)` and `supabase migration list --linked` reaches it (no remote migrations yet). The local `supabase/.temp` link state is gitignored.
- [x] **0.4** `[ops]` New project → API Keys: create a **secret** key (`sb_secret_…`) and add it to `.env.local` as `SUPABASE_SECRET_KEY`. Confirm `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` are the new project's. Leave the legacy `SUPABASE_SERVICE_ROLE_KEY` in place until 13.3. — *Done when:* `curl -H "apikey: $SUPABASE_SECRET_KEY" $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` returns 200.
  - Verified: `SUPABASE_SECRET_KEY` (`sb_secret_…`) is in `.env.local`, and `GET /rest/v1/` with it returns 200. The URL and publishable key point at the new project. The legacy `SUPABASE_SERVICE_ROLE_KEY` is also for the new project and stays until 13.3.
- [x] **0.5** `[ops]` Settings → JWT Keys: asymmetric signing keys are active (P4). — *Done when:* the JWKS endpoint `/auth/v1/.well-known/jwks.json` lists a key.
  - Verified: one ES256 (P-256) key is published, so `getClaims()` verifies locally.
- [ ] **0.6** `[ops]` Plan and Storage: the project is on Pro, and Storage → Settings → global file size limit is ≥ 1 GB (P6). — *Done when:* the setting shows ≥ 1 GB.
  - **Deferred (owner decision):** staying on Free for now, with an upgrade to Pro planned. **Until then the global upload limit is 50 MB**, so larger videos can't be uploaded or migrated. Upgrade and raise the limit to ≥ 1 GB before task 8.5 (migrating the real videos) and before 12.1. The migration still sets the `resource-files` bucket to 1 GB, which only takes effect once the global limit is raised.
- [x] **0.7** `[ops]` Auth → Sessions: time-box never, inactivity never, single session per user off (P3).
  - Confirmed by the owner: already set as specified.
- [x] **0.8** `[ops]` Google: add `https://lsihwkbnrheczirlkswo.supabase.co/auth/v1/callback` to the OAuth client's Authorized redirect URIs (P1). Enable the Google provider on the new project with the same client ID and secret (P2). Check the consent-screen user type (P9). — *Done when:* hitting `/auth/v1/authorize?provider=google` on the new project reaches Google's account picker without `redirect_uri_mismatch`.
  - Verified: `/auth/v1/settings` reports `google: true`, and `/auth/v1/authorize?provider=google` lands on Google's sign-in page with no `redirect_uri_mismatch`. The consent-screen user type (P9) can't be checked from here and is still worth a look in Google Cloud.
- [ ] **0.9** `[IT]` `[ops]` Resend: verify the sending domain for the placeholder sender (SPF + DKIM, DMARC recommended), and create a sending-only API key for the new project (E2). — *Done when:* Resend shows the domain as Verified.
  - **Deferred (owner decision):** waiting until the sending domain is bought. The `welcome@vydia.com` placeholder will be replaced by an address on that domain, so Resend verification and the API key should be done against the final domain (this also covers 12.4).
- [ ] **0.10** `[ops]` Auth → SMTP: Resend settings with placeholder sender `welcome@vydia.com`, name "Vydia" (E1). — *Done when:* a test email (Auth → Users → Invite, to your own address, then delete the user) arrives from Resend.
  - **Blocked by 0.9.** Partially verified earlier: an admin-API invite to the Resend sink address `delivered+phase0probe@resend.dev` returned 200 (the built-in sender rejects non-team addresses), then the probe user was deleted. That suggests some custom SMTP is already on. Re-check sender, host, and delivery once 0.9 is done.
- [x] **0.11** `[ops]` Auth → URL Configuration: Site URL plus redirect URLs `http://localhost:3000/**`, `https://welcometovydia.com/**`, and the Vercel preview pattern (E4).
  - Confirmed by the owner. Still re-check with V1 (§12.3) that a real link's `redirect_to` keeps `/{slug}`.
- [x] **0.12** `[ops]` Auth → Providers → Email enabled, OTP expiry 3600 (E6). "Allow new users to sign up" on (E7). Rate limits: emails per hour raised, 60 s per-user OTP interval kept (E5).
  - Confirmed by the owner. `/auth/v1/settings` also shows the email provider enabled and `disable_signup: false`.
- [x] **0.13** `[ops]` Vercel → Environment Variables → **Preview, branch `iteration-two` only**: the new project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Production and other previews are unchanged. — *Done when:* an `iteration-two` preview build logs the new project URL.
  - Done: the branch is on GitHub, and `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` (sensitive) now exist for Preview + `iteration-two` only. The repo is linked to the Vydia project `welcome-to-vydia` (`.vercel/` and `.env.local` are gitignored; `vercel link` appended a `VERCEL_OIDC_TOKEN` to `.env.local`).
  - **Done-check not yet observable:** the preview deployment for the push is **Blocked** by Vercel (earlier previews were too), so no build has run with the new variables. Approve or unblock it in the Vercel dashboard (usually a commit author who isn't a member of the Vydia team), then check that the build uses the new project.
  - Findings for cutover (12.6): the project's Preview and Production environments otherwise share `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (set 19d ago, so almost certainly the old project). Production also has Supabase integration variables added the same day as Phase 0 (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `POSTGRES_*`, `SUPABASE_JWT_SECRET`, …) with hidden values, so check which project they point at. The app doesn't read them yet.
- [x] **0.14** `[ops]` GitHub Actions: add the `SUPABASE_SECRET_KEY` secret (new project). Keep the old secrets until 12.7. Until Phase 10 lands, expect `e2e-preview.yml` failures on `iteration-two` previews (they run the old suite), or skip that workflow for the branch.
  - Done: `SUPABASE_SECRET_KEY` is stored as a GitHub Actions secret on `vydia-creative-services-org/welcome-to-vydia`. No other secrets or variables existed. `e2e-preview.yml` reads `vars.NEXT_PUBLIC_SUPABASE_URL`, which doesn't exist yet, so that workflow stays broken for this branch until Phase 10 (or until cutover task 12.7 creates the variable).
- [x] **0.15** `[dev]` On `iteration-two`: `npm install zod @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` and `npm install -D tsx`. — *Done when:* `npm run build` still passes.
  - Installed `zod` 4.6, `@dnd-kit/core` 6.3, `@dnd-kit/sortable` 10, `@dnd-kit/utilities` 3.2, and dev `tsx`. `tsc --noEmit` and `npm run build` pass. npm also pruned lockfile entries for an npm copy of the Supabase CLI that weren't in `package.json` (the Homebrew CLI is used).

### Phase 1: Sanity contract (ships on `main`) (2026-11-09: code done and PR #3 green; waiting on the merge, then label services)

- [x] **1.1** `[dev]` Add `category` (required string) and `sortOrder` (integer ≥ 0) to `sanity/schemaTypes/resource.ts` (§5.1).
  - Done on branch `sanity-category-fields`, built in a separate git worktree (`../welcome-to-vydia-sanity`) off `origin/main`, so the Sanity change doesn't mix with `iteration-two`. `category` is required; `sortOrder` is an integer ≥ 0.

- [x] **1.2** `[dev]` `npm run typegen`. Commit the updated `sanity/schema.json` and `lib/sanity/types.generated.ts`. — *Done when:* `npm run typecheck && npm run test` pass on `main`.
  - `npm run typegen` regenerated `sanity/schema.json` (adds optional `category` string and `sortOrder` number) and `lib/sanity/types.generated.ts`. typecheck, lint, 70 unit tests, and prettier all pass.
  - Two things surfaced along the way:
    - **Local `main` was stale** (`524aced`; `origin/main` was 20 commits ahead after PR #2), so the branch was rebased onto `origin/main`.
    - **`main`'s own `format:check` was failing** on 8 files (`app/manifest.json`, five `components/*` files, `TASKS.md`). A separate formatting-only commit fixes them.
  - **Git identity:** Vercel rejects commits whose email maps to a GitHub user outside the Vydia team (`mason.omara@vydia.com` maps to `masonomara-vydia`). This repo's *local* git config now uses `vydia-creative-services <337009099+vydia-creative-services@users.noreply.github.com>`. Your global git config is unchanged. No history was rewritten except this one feature branch.

- [ ] **1.3** `[dev]` PR → merge → deploy to production. — *Done when:* the live Studio shows a required Category field on resources.
  - **Waiting on the merge.** PR #3 (https://github.com/vydia-creative-services-org/welcome-to-vydia/pull/3) is open with all checks passing (CI `check`, Vercel preview). Merging it to `main` deploys to production, and that step was blocked by the permission classifier, so it's left for you: click **Merge** on the PR (or tell me to retry).
  - After the merge: confirm the production deployment is Ready and the live Studio shows a required **Category** field on a resource.

- [ ] **1.4** `[LS]` Fill in **Category** for every resource listed under Website → Resources. Use the existing section names as a starting point: "Vydia Platform Resources", "Playlisting and Sync Pitch Forms", "Additional Services". — *Done when:* in Vision, `count(*[_id == "website"][0].resources[]->[!defined(category)])` returns `0`.
  - **Waiting on label services**, and on 1.3. Existing resources will show "Category is required" in Studio until filled.

- [ ] **1.5** `[LS]` Agree a soft content freeze in Studio from 8.5 until cutover (12.5). Edits are allowed, but they need a migration re-run.
  - **Waiting on label services.**

- [ ] **1.6** `[dev]` Merge `main` into `iteration-two`, so the branch has the new `schema.json`.
  - **Blocked on 1.3.** Once PR #3 is merged: `git fetch && git merge origin/main` on `iteration-two`. Expect conflicts in the 8 formatted files only if `iteration-two` changed them.

- [x] **1.7** `[dev]` Update the sample data in `docs/iteration-two.md` to match the schema (§5.3: video uses `file`, plus `coverImage` / `sortOrder` naming).
  - Done: the main-resource sample in `docs/iteration-two.md` is now `{ title, type: "video", file: "walkthrough.mp4", category, coverImage: "walkthrough.jpg", sortOrder: 1 }`. The exclusive-resource sample already matched.

### Phase 2: Database (`supabase/migrations/…_iteration_two.sql`) (2026-11-09: built, tested, and pushed; 2.15 and 2.16 are dashboard steps for you)

- [x] **2.1** `[dev]` `supabase migration new iteration_two`.
  - Created `supabase/migrations/20261109212557_iteration_two.sql` (the CLI's timestamp, not the `20261110…` in §4).

- [x] **2.2** `[dev]` Domain `email_address`, enum `resource_type`, tables `admins`, `artists`, `artist_emails`, `resources` (including the `*_lqip` columns), `artist_hidden_resources`, plus indexes and the `admins` seed for the two shared inboxes (§4.1, D44).
  - Done as §4.1, plus the two admin seeds.

- [x] **2.3** `[dev]` `private` schema and triggers: `touch_updated_at`, `normalize_category`, `default_sort_order`, `check_hide_target`, `storage_garbage` + `queue_resource_garbage` (§4.2).
  - Done as §4.2, with one fix: `private.queue_resource_garbage` is now `security definer`. As written in §4.2 it would fail for admins, because the `authenticated` role has no access to the `private` schema.

- [x] **2.4** `[dev]` `jwt_email()`, `is_admin()` (Google `amr` + listed + `@vydia.com`), `can_view_artist()` (§4.3).
  - Done as §4.3. `is_admin()` also coalesces a null email to false. New helper `can_view_main_resource(uuid)` (see 2.5). All four helper functions are revoked from `public`/`anon` and granted to `authenticated` and `service_role`.

- [x] **2.5** `[dev]` Enable RLS on all five tables, `revoke all … from anon`, and every policy from §4.4.
  - Done as §4.4 with one fix that matters: the plan's `resources_read` policy checked `artist_emails` inside the policy, but that subquery runs under the *artist's* RLS and artists can't read `artist_emails`, so artist users would have seen **no main resources**. The policy now calls the new `security definer` function `can_view_main_resource(id)`. The RLS test covers it ("artist users can read the main resources their artist does not hide").

- [x] **2.6** `[dev]` RPCs and their grants: `get_artist_page`, `email_can_access_slug` (`service_role` only), `hit_rate_limit`, `claim_link_send` (+ `private.rate_limits`, `private.link_sends`), `claim_admin_profile`, `reorder_main_resources`, `take_storage_garbage` (§4.5).
  - Done as §4.5. Every function is revoked from `public` and `anon` first, then granted to exactly the roles in §4.5 (the platform's default privileges would otherwise leave `anon` able to call them).

- [x] **2.7** `[dev]` `save_artist(payload jsonb)` (§4.6), including the lqip columns.
  - Done as §4.6, with the email and exclusive-resource deletes rewritten with `not exists`. As written (`not in (select …)`) a null id or email in the payload made the delete remove nothing, silently. A payload with a missing email or resource id is now rejected (`23502`).

- [x] **2.8** `[dev]` `hook_before_user_created`, its grants to `supabase_auth_admin`, the two `supabase_auth_admin` select policies, and the `[auth.hook.before_user_created]` block in `config.toml` (§4.7).
  - Done as §4.7. The `[auth.hook.before_user_created]` block is in `supabase/config.toml`.
  - **Config changes need `supabase stop && supabase start`.** `supabase db reset` only restarts the existing containers, so the first end-to-end check found the hook not enforced at all (an unknown email and an admin address both got users). After a full restart, verified against the running local Auth service: an artist email → 200 and a user; an unknown email → 403 `Not approved`, no user; `labelservices@vydia.com` through the email provider → 403, no user.

- [x] **2.9** `[dev]` Storage buckets `resource-files` (private, 1 GB, file MIME allow-list) and `resource-images` (public, 5 MB, JPG/PNG/WebP), plus the two `storage.objects` policies (§4.8).
  - Done as §4.8. Both buckets and both policies are created by the migration.

- [x] **2.10** `[dev]` `supabase db reset` from scratch, then `supabase db lint`. — *Done when:* both are clean.
  - `supabase db reset` applies the migration from scratch, and `supabase db lint --schema public,private` reports no schema errors.

- [x] **2.11** `[dev]` `supabase/tests/rls.test.sql` (§13.2, 13 assertions). — *Done when:* `supabase test db` passes.
  - `supabase/tests/rls.test.sql`: 15 assertions (the plan's 13, plus main-resource visibility and "a magic-link session for an admin address is not admin"). `supabase test db` passes.

- [x] **2.12** `[dev]` `supabase/tests/functions.test.sql`. Cover:
  - `supabase/tests/functions.test.sql`: 32 assertions covering the hook (5), `email_can_access_slug` (4), `claim_link_send` (3), `hit_rate_limit` (3), `save_artist` create/edit/rollback/primary/overwrite (13), hiding an exclusive, reorder (2), and the garbage trigger (2). 47 assertions pass across both files.

- [x] **2.13** `[dev]` Add the `db:types`, `db:test`, `db:push` scripts. Run `npm run db:types` and commit `lib/supabase/database.types.ts`.
  - Added `db:types`, `db:test`, `db:push` to `package.json`. `db:types` generates from the **local** database (`--local`, no login needed; the schema is identical to the hosted one) and runs prettier on the output so `format:check` stays green. `lib/supabase/database.types.ts` is generated. `tsc`, lint, and the unit tests pass.

- [x] **2.14** `[dev]` `supabase db push` to `lsihwkbnrheczirlkswo`. — *Done when:* the tables, buckets, and seeded admins are visible in the dashboard.
  - Pushed with `supabase db push --remote --yes` after your go-ahead. `supabase migration list --remote` shows `20261109212557` on both sides.
  - Verified on the hosted project: both admins are seeded; buckets `resource-files` (private, 1 GB) and `resource-images` (public, 5 MB) exist; the publishable key gets `permission denied` on `artists`, `email_can_access_slug`, and `get_artist_page`.
  - **Gotcha:** `supabase db push` with no flag targets the **local** stack. The hosted project needs `--remote`, and in agent mode it also needs `--yes`, which I only used after you approved it.

- [ ] **2.15** `[ops]` Auth → Hooks → Before User Created → Postgres → `public.hook_before_user_created` (E8).
  - **For you (dashboard):** the CLI can't set this safely (`supabase config push` would overwrite the hosted auth settings with the local `config.toml`). The function `public.hook_before_user_created` now exists on the hosted project. Until you enable it, the hook is **off** on the hosted project and anyone can self-sign-up there. The first check after enabling it is V2 (§12.3).

- [ ] **2.16** `[ops]` Table editor → `admins`: add individual admins by hand (e.g. `mason.omara@vydia.com`, `erica.johnson@vydia.com`, the label services and creative services people).
  - **For you:** `labelservices@` and `creativeservices@` are already seeded. Add individuals in the table editor, or with this in the SQL editor:
    `insert into public.admins (email) values ('mason.omara@vydia.com'), ('erica.johnson@vydia.com') on conflict do nothing;`
    Each must be a real `@vydia.com` Google account (the table rejects other domains).

### Phase 3: Shared libraries

- [ ] **3.1** `[dev]` `lib/email.ts` (`EMAIL_PATTERN`, `normalizeEmail`). Repoint the existing imports from `lib/access.ts` and `sanity/schemaTypes/shared.ts`.
- [ ] **3.2** `[dev]` `lib/slug.ts`: `SLUG_MIN`/`SLUG_MAX` (3–60), the 60-char `slugify` cap, `isValidSlug`, `normalizeSlug`, and an updated `RESERVED_SLUGS` matching the SQL check. Update `tests/slug.test.ts`.
- [ ] **3.3** `[dev]` `lib/resources/types.ts` (`RESOURCE_TYPES` moved here, `Resource`, `ResourceCardData`, `Hotspot`). Until Phase 9, `sanity/schemaTypes/resource.ts` imports `RESOURCE_TYPES` from it.
- [ ] **3.4** `[dev]` `lib/resources/mapping.ts` (`RESOURCE_FIELD_MAP`, the compile-time enum parity check, `publicImageUrl`, `fromRow`, `toCard`) + `tests/mapping.test.ts`.
- [ ] **3.5** `[dev]` `lib/resources/group.ts` + `tests/group.test.ts` (case-insensitive grouping, first-seen order and spelling).
- [ ] **3.6** `[dev]` `lib/validation.ts` (`resourceInput`, `artistPayload`, the lqip regex) + `tests/validation.test.ts` (every Sanity per-type rule, all field limits, email dedupe, exactly one primary).
- [ ] **3.7** `[dev]` `tests/schema-parity.test.ts` (§13.1). — *Done when:* it fails if a field is added to `schema.json` without a mapping.
- [ ] **3.8** `[dev]` `lib/supabase/service.ts`. Add the `<Database>` generic in `lib/supabase/server.ts`, `stateless.ts`, and `proxy.ts`.
- [ ] **3.9** `[dev]` `.env.example`: add `SUPABASE_SECRET_KEY` and `SUPABASE_PROJECT_ID`. The Sanity variables stay until Phase 9.

### Phase 4: Artist side

- [ ] **4.1** `[dev]` `lib/artist-page.ts` (`getArtistPage`, `cache()`d, null for every no-access case, fails closed on RPC error).
- [ ] **4.2** `[dev]` Rewrite `app/(site)/[slug]/page.tsx` and its `generateMetadata` (§7.2). Delete `app/(site)/[slug]/not-found.tsx` and `components/NoAccess.tsx`. — *Done when:* signed out, a real slug and a made-up slug produce identical `<main>` HTML, a status of 200, and the title "Welcome to Vydia".
- [ ] **4.3** `[dev]` `app/(site)/[slug]/actions.ts` `sendLink` (§7.3) + `tests/send-link.test.ts`. The test checks that an unknown slug and a wrong email give the same result with no send, a cooldown returns `sent` with no send, `over_email_send_rate_limit` counts as sent, and a rate limit returns `rate-limited`.
- [ ] **4.4** `[dev]` `EnterEmail.tsx` + `EnterEmail.module.css` (§7.4): the "Enter your email" placeholder, **Send link**, the not-approved message under a still-filled input, "Email sent, check your inbox", and a 60 s **Resend email** countdown. Centered and mobile-first. — *Done when:* it works at 375 px wide and passes axe.
- [ ] **4.5** `[dev]` `app/(site)/auth/confirm/route.ts` (GET, D33). Delete `auth/confirm/page.tsx` and `actions.ts`.
- [ ] **4.6** `[dev]` `app/(site)/auth/expired/page.tsx` ("This link has expired" + a button back to the slug).
- [ ] **4.7** `[dev]` Email templates: export `public/vydia-logo.png` (white logo on a dark band), update the copy in `supabase/templates/magic-link.html` and `confirm-signup.html` (§11), and keep the `/auth/confirm?token_hash…` link. `[ops]` Paste both into the new project (E3). — *Done when:* a local (Mailpit) and a hosted (Resend) email both render the logo and the right link.
- [ ] **4.8** `[dev]` `app/api/resources/[id]/file/route.ts` (RLS check → 1 h signed URL → 302, otherwise a `no-store` 404).
- [ ] **4.9** `[dev]` Rename `_id` → `id` in `ResourceCarousel`, `ResourceGrid`, and every `data-morph-id`. Switch the type imports from `lib/sanity/types` to `lib/resources/types`. — *Done when:* the view switch morph still pairs cards correctly.
- [ ] **4.10** `[dev]` `ResourceCard` (uses `href`; `hasTarget` removed), `VideoCard` (`src = href`), `CardCover` (Supabase URL, `objectPosition` from the hotspot, `placeholder="blur"` + lqip), `CardBody` (+ type label using `--color-badge-*`).
- [ ] **4.11** `[dev]` `ResourceCarousel`: `backdropSrc` from `cover.src` + `cover.lqip` (§7.8), and a type subline under the big title.
- [ ] **4.12** `[dev]` `ResourceViews({groups})` and the grouped `ResourceGrid` with category `<h2>`s and id-safe keys (§7.7). Remove the `additionalInfo` prop. Add CSS for the category headings and the spacing between groups.
- [ ] **4.13** `[dev]` `lib/supabase/proxy.ts`: no redirects for artist paths; `/admin/*` (except login and callback) redirects to `/admin/login` without a session. Update the `proxy.ts` matcher. — *Done when:* signed out, `/x` returns 200 and `/admin` returns 307 to `/admin/login`.
- [ ] **4.14** `[dev]` `next.config.ts`: replace the Sanity CDN `remotePatterns` with the Supabase public `resource-images` path.
- [ ] **4.15** `[dev]` `app/(site)/page.tsx`: copy for the new flow ("open the link label services sent you, then enter your email").
- [ ] **4.16** `[dev]` `[ops]` On the new project, insert a throwaway artist and email in the SQL editor, then run **V1, V2, V5** (§12.3). Record the results in §4.7 and delete the throwaway rows.

### Phase 5: Admin auth and shell

- [ ] **5.1** `[dev]` `app/(admin)/layout.tsx` (second root layout) + `admin.css` (light, desktop-first tokens: surface, border, text, accent, danger; a 1200 px content width).
- [ ] **5.2** `[dev]` `app/(admin)/admin/login/page.tsx` + `actions.ts` (`signInWithGoogle` with `hd=vydia.com` and `prompt=select_account`) + `login.module.css`. `?error=no-access` → "You don't have access."
- [ ] **5.3** `[dev]` `app/(admin)/admin/auth/callback/route.ts` (no `code` → no-access; exchange; `claim_admin_profile()`; non-admin → sign out → no-access).
- [ ] **5.4** `[dev]` `app/(admin)/admin/auth/signout/route.ts` (POST → sign out → 303 to `/admin/login`).
- [ ] **5.5** `[dev]` `lib/admin/auth.ts` `requireAdmin()` (`cache()`d; returns `{supabase, admin}`).
- [ ] **5.6** `[dev]` `app/(admin)/admin/(panel)/layout.tsx` + `panel.module.css`: nav (Artists, Resources, active state), avatar + display name, Sign out.
- [ ] **5.7** `[dev]` `npm run build`. — *Done when:* both root layouts build, `/admin` isn't captured by `[slug]`, and `admin` can't be saved as a slug (SQL check + `isValidSlug`).
- [ ] **5.8** `[ops]` Run **V3, V4** (§12.3). Record the results in §4.7.

### Phase 6: Admin: artists

- [ ] **6.1** `[dev]` `app/(admin)/admin/(panel)/page.tsx`: the artist + emails query and the row mapping (§8.3).
- [ ] **6.2** `[dev]` `components/admin/ArtistTable.tsx`: columns name / primary email / auxiliary count / slug / Copy link / created date. Client-side search over name and every email, case-insensitive. **New artist** button. Empty state.
- [ ] **6.3** `[dev]` `components/admin/CopyLinkButton.tsx` + `welcomeLink()` ("Copied" feedback, falls back to selecting the text if the clipboard API is blocked).
- [ ] **6.4** `[dev]` `components/admin/ConfirmDialog.tsx` (native `<dialog>`, focus returns to the trigger, Escape cancels, used for the slug change and for deletes).
- [ ] **6.5** `[dev]` `components/admin/EmailRows.tsx` (add/remove rows, email + optional label with Manager/Alt/Assistant suggestions, per-row errors).
- [ ] **6.6** `[dev]` Main resource picker inside the form: grouped by category, **Remove** grays the row out, **Restore** brings it back, plus a count of hidden resources.
- [ ] **6.7** `[dev]` `lib/admin/resource-context.ts` `loadResourceContext(supabase)` → `{mainResources, categories}` (distinct, case-insensitive). `components/admin/CategoryInput.tsx` (`<datalist>`).
- [ ] **6.8** `[dev]` `app/(admin)/admin/(panel)/uploads/actions.ts` `createUploadTarget` (admin check, MIME and size rules per kind, path `{resourceId}/{kind}-{uuid}.{ext}`).
- [ ] **6.9** `[dev]` `lib/admin/upload.ts` `uploadAsset` (storage-only browser client, `uploadToSignedUrl`).
- [ ] **6.10** `[dev]` `lib/admin/pdf-preview.ts`: port `renderFirstPage()` from `sanity/components/PdfPreviewInput.tsx`, including the password-protected PDF message.
- [ ] **6.11** `[dev]` `lib/admin/lqip.ts` `makeLqip()` (§8.6).
- [ ] **6.12** `[dev]` `components/admin/ResourceEditor.tsx` + an extracted `ResourceFields.tsx`:
  - Drafts get a client `crypto.randomUUID()` id.
  - Per-type visibility of file vs URL (Sanity's rules).
  - Cover image + alt.
  - PDF → automatic preview + lqip.
  - Upload progress, a `localStatus` that blocks Save, and "Added on" under a disclosure.
  - Add/edit/delete in the list.
  - *Done when:* every per-type rule shows its Sanity error message.
- [ ] **6.13** `[dev]` `components/admin/ArtistForm.tsx` (§8.7):
  - Slug auto-fills on new artists until edited.
  - On edit, a slug change shows the warning, and Save opens the confirm dialog.
  - Builds the payload, shows field and form errors, and has a disabled saving state.
- [ ] **6.14** `[dev]` `app/(admin)/admin/(panel)/artists/actions.ts` `saveArtist` (zod → `save_artist` → constraint → field error mapping → `sweepStorage` → redirect) and `deleteArtist`.
- [ ] **6.15** `[dev]` `lib/admin/storage.ts` `sweepStorage`.
- [ ] **6.16** `[dev]` `app/(admin)/admin/(panel)/artists/new/page.tsx`.
- [ ] **6.17** `[dev]` `app/(admin)/admin/(panel)/artists/[id]/page.tsx`:
  - The Welcome link at the top, with Copy link and Open page.
  - A "Saved." status after `?saved=1`.
  - `toFormInitial()`.
  - `DeleteArtistButton` (confirm → `deleteArtist`) at the bottom.
- [ ] **6.18** `[dev]` `scripts/storage-sweep.ts` + `npm run storage:sweep` (D43, §8.6). — *Done when:* a dry run lists a deliberately abandoned upload older than 24 h, and `--delete` removes it.
- [ ] **6.19** `[dev]` Manual pass on a preview:
  - Create "Lil Example" from the spec's sample data (three emails, one hidden main resource, one exclusive PDF with a cover).
  - Force a duplicate email and confirm nothing was saved.
  - Rename the slug, then delete the artist.
  - *Done when:* storage objects are cleaned up after the delete.

### Phase 7: Admin: main resources

- [ ] **7.1** `[dev]` `app/(admin)/admin/(panel)/resources/page.tsx` (grouped list, "applies to every artist immediately" note, empty state).
- [ ] **7.2** `[dev]` `resources/actions.ts`: `upsertMainResource`, `deleteMainResource`, `reorderMainResources` (zod, `requireAdmin`, `sweepStorage`, `refresh()`).
- [ ] **7.3** `[dev]` Create/edit dialog using `ResourceFields` (same uploads, preview, lqip, and category suggestions as exclusives).
- [ ] **7.4** `[dev]` `components/admin/SortableResourceList.tsx`: dnd-kit sortable rows within a category and sortable category groups. Pointer **and** keyboard sensors with screen-reader announcements. `useOptimistic` + `reorderMainResources(flatIds)`. A rollback message on failure.
- [ ] **7.5** `[dev]` Delete with `ConfirmDialog` ("removed from every artist's page; per-artist hides for it are removed too").
- [ ] **7.6** `[dev]` Manual check: a new main resource appears on every existing artist's page. Reordering and recategorizing show on artist pages on the next load.

### Phase 8: Sanity → Supabase migration

- [ ] **8.1** `[dev]` `scripts/migrate-sanity.ts` (§10) + the `migrate:sanity` script. Keep `@sanity/client` available (devDependency) until 13.3.
- [ ] **8.2** `[dev]` Export `uuidFromSanityId` and `croppedCover`, and unit-test them in `tests/migrate.test.ts`: deterministic id, valid UUID format, crop rect math, and the hotspot moved into the cropped frame.
- [ ] **8.3** `[dev]` `--dry-run` against local Supabase. Fix or explain every ✗ line.
- [ ] **8.4** `[dev]` A real run against local Supabase. Create a test artist in the local admin and QA its page: order, categories, covers with blur-up, PDFs open, videos play, slides link vs file.
- [ ] **8.5** `[dev]` `--dry-run`, then a real run against `lsihwkbnrheczirlkswo`. — *Done when:* the migrated count equals `count(*[_id=="website"][0].resources)` minus any explained skips, and the report is pasted into the PR.
  - **Prerequisite (0.6):** the project must be on Pro with the global storage limit raised to ≥ 1 GB, or videos over 50 MB will fail to copy. Photos, PDFs, and links will migrate on Free.
- [ ] **8.6** `[dev]` `[LS]` Spot-check on the `iteration-two` preview with a real-looking test artist: every resource opens, covers match the live site, and the categories look right.

### Phase 9: Remove Sanity and the old sign-in (§9)

- [ ] **9.1** `[dev]` Delete `app/studio/`, `app/api/revalidate/`, `lib/sanity/`, `lib/access.ts`, `sanity.config.ts`, `sanity.cli.ts`, `sanity/actions/`, `sanity/components/`, `sanity/schemaTypes/`, `sanity/structure.ts`, `sanity/env.ts`, `scripts/seed.ts`, `components/RichText.*`, `app/(site)/login/`, `app/(site)/auth/callback/`, `app/(site)/auth/signout/`.
- [ ] **9.2** `[dev]` Keep `sanity/schema.json`. Add `sanity/README.md` (frozen-contract note, §9).
- [ ] **9.3** `[dev]` Delete the obsolete unit tests: `tests/access.test.ts`, `tests/artist-page.test.ts`, `tests/cover-source.test.ts`, `tests/image.test.ts`. Keep `format`, `safe-redirect`, `slug`.
- [ ] **9.4** `[dev]` `npm uninstall sanity next-sanity @sanity/icons @sanity/image-url @sanity/ui @sanity/vision @sanity/webhook @portabletext/react styled-components`.
- [ ] **9.5** `[dev]` `package.json` scripts: remove `typegen` and the `sanity exec` e2e scripts. Add `storage:sweep` and the new `e2e:*` (§9).
- [ ] **9.6** `[dev]` `.env.example`: remove `NEXT_PUBLIC_SANITY_*`, `SANITY_*`, `PERMANENT_VIEWER_EMAILS`, `SUPABASE_SERVICE_ROLE_KEY`. `proxy.ts` matcher: drop `studio|api/revalidate`.
- [ ] **9.7** `[dev]` `grep -rE "sanity|portabletext|PERMANENT_VIEWER" app components lib proxy.ts next.config.ts`. — *Done when:* nothing turns up except `scripts/migrate-sanity.ts`.
- [ ] **9.8** `[dev]` `npm run lint && npm run typecheck && npm run test && npm run build`. — *Done when:* all green.

### Phase 10: End-to-end tests and CI

- [ ] **10.1** `[dev]` `tests/e2e/users.ts`: personas `artistA` (`delivered+a@resend.dev`), `manager` (`delivered+mgr@resend.dev`), `aux2` (`delivered+a2@resend.dev`), `artistB` (`delivered+b@resend.dev`).
- [ ] **10.2** `[dev]` Rewrite `scripts/e2e-fixtures.ts` on the secret key:
  - `e2e-artist-a` (3 emails) and `e2e-artist-b`.
  - 2 main resources, one of them hidden on A, mixed-case categories.
  - One exclusive on A.
  - A teardown that deletes the artists (cascade) and the auth users.
  - Remove the legacy-key and Sanity code.
- [ ] **10.3** `[dev]` `tests/e2e/global-setup.ts`: `generate_link` with the secret key, then a **GET** of `/auth/confirm` (no Continue click), then save each persona's storage state.
- [ ] **10.4** `[dev]` `tests/e2e/access.spec.ts`: the parity rows from §13.3 (signed-out real vs fake slug; A opening B; the removed email revoked on reload; admins gate).
- [ ] **10.5** `[dev]` `tests/e2e/sign-in.spec.ts`: wrong email vs unknown slug give the identical message; no `auth.users` row is created; the approved email shows the sent state and a disabled countdown; the link signs in directly; a bogus or used link goes to expired.
- [ ] **10.6** `[dev]` `tests/e2e/resources.spec.ts`: exclusive on A only; hide on A only; all three of A's emails see the page; grid groups by category (mixed case → one heading); link cards use `target=_blank rel=noopener noreferrer`; the video dialog opens and closes and returns focus; the file route 302s for a viewer and 404s for another artist.
- [ ] **10.7** `[dev]` `tests/e2e/admin.spec.ts`: signed out `/admin` → `/admin/login`; a magic-link persona on `/admin` → "You don't have access."; the login page shows only **Sign in with Google**.
- [ ] **10.8** `[dev]` `tests/e2e/a11y.spec.ts`: axe on Enter your email (idle, sent, not-approved), the resources page (both views), `/auth/expired`, and `/admin/login`.
- [ ] **10.9** `[dev]` `.github/workflows/ci.yml`: a `db` job using `supabase/setup-cli` → `supabase start` → `npm run db:test`. The existing lint/typecheck/test/format job keeps going.
- [ ] **10.10** `[dev]` `.github/workflows/e2e-preview.yml`: env → the new project URL var plus `SUPABASE_SECRET_KEY`. Drop the Sanity and revalidate secrets. Setup and teardown use the new scripts.
- [ ] **10.11** `[dev]` — *Done when:* CI and the e2e preview are green on the `iteration-two` PR.

### Phase 11: Docs

- [ ] **11.1** `[dev]` Rewrite `README.md`: how it works (Supabase + RLS, admin panel), stack, env table, scripts (`db:*`, `migrate:sanity`, `storage:sweep`, `e2e:*`), dashboards (Supabase `lsihwkbnrheczirlkswo`, Resend, Google Cloud, Vercel, GitHub; Sanity removed), deploy flow, and rotating secrets (secret key, Resend key).
- [ ] **11.2** `[dev]` `docs/admin-guide.md`, replacing `docs/editor-guide.md`: signing in; creating an artist; emails and labels; hiding main resources; exclusive resources and uploads (file types, 5 MB covers, 1080p MP4); copying and sending the Welcome link; renaming a slug; deleting; main resources and reordering; categories; what artists see; adding an admin in the table editor; running the storage sweep.
- [ ] **11.3** `[dev]` `docs/plan.md` §1: add D23–D44 with a pointer here, and mark D18 superseded by D33 and D6/D22 by D44. `docs/sign-in-plan.md`: a header note that iteration two supersedes it.
- [ ] **11.4** `[dev]` This plan: write the V1–V6 results into §4.7 and adjust any code that depended on them.

### Phase 12: QA, cutover, launch

- [ ] **12.1** `[dev]` `[LS]` Manual QA (§13.4) on the `iteration-two` preview, including **both** shared inboxes and one individual admin signing in with Google, and a personal Gmail being rejected.
- [ ] **12.2** `[dev]` Success-state sign-off: tick each item from the spec's **Success State** with evidence (test name or screenshot):
  - [ ] Primary + two aux emails each sign in and see the same page
  - [ ] An unattached email gets not-approved, receives no email, and creates no Supabase user
  - [ ] `/does-not-exist` is identical to a real slug, and any email gets not-approved
  - [ ] Signed in for A, B's URL shows Enter your email with no trace of B
  - [ ] Exclusive on A is visible on A only
  - [ ] Hide on A affects A only
  - [ ] A removed aux email shows Enter your email on the next load
  - [ ] Label services and creative services admins can sign in, and a non-admin Google account is rejected
- [ ] **12.3** `[dev]` Device and email-client QA: iOS Safari, Android Chrome, desktop Safari/Chrome/Firefox. Open the magic-link email in Gmail web and app, Apple Mail, and Outlook/Microsoft 365 (watch for Safe Links spending the token, §16).
- [ ] **12.4** `[ops]` Final sender address: replace the `welcome@vydia.com` placeholder in Resend (domain) and Supabase SMTP once it's decided. If it's still undecided at launch, launch on the placeholder and log it here.
  - The final address is on the domain being purchased (0.9). Note the SMTP sender must be on a domain verified in Resend.
- [ ] **12.5** `[LS]` `[dev]` Content freeze in Studio, then re-run `npm run migrate:sanity` against the new project (idempotent; picks up edits since 8.5). Resources deleted in Sanity since then are deleted by hand in `/admin/resources`.
- [ ] **12.6** `[ops]` Vercel **Production**: switch `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the new project, add `SUPABASE_SECRET_KEY`, remove the Sanity variables and `PERMANENT_VIEWER_EMAILS`.
- [ ] **12.7** `[ops]` GitHub Actions: update the `NEXT_PUBLIC_SUPABASE_URL` variable, remove the `SUPABASE_SERVICE_ROLE_KEY`, `SANITY_E2E_EDITOR_TOKEN`, and `SANITY_REVALIDATE_SECRET` secrets, and remove the Sanity variables.
- [ ] **12.8** `[dev]` Merge `iteration-two` → `main`. — *Done when:* the production deploy succeeds.
- [ ] **12.9** `[dev]` Production smoke test on `welcometovydia.com`: admin Google sign-in, create a real artist, copy the link, run the magic link end to end in a private window, check `/does-not-exist`, then delete the smoke-test artist.
- [ ] **12.10** `[LS]` Recreate active artists in `/admin` and send each one their new Welcome link.

### Phase 13: Post-launch cleanup (about a week after 12.8)

- [ ] **13.1** `[ops]` Pause the old Supabase project `cqqzvzljlthrqrttqnga`, and delete it once nobody needs its data.
- [ ] **13.2** `[ops]` Sanity: revoke the read token and the webhook, then cancel or downgrade the plan (§9.6).
- [ ] **13.3** `[dev]` Remove `scripts/migrate-sanity.ts`, the `migrate:sanity` script, and the `@sanity/client` devDependency. Remove the legacy `SUPABASE_SERVICE_ROLE_KEY` and the Sanity variables from `.env.local`.
- [ ] **13.4** `[ops]` Google Cloud: remove the old project's redirect URI from the OAuth client. Resend: revoke the old project's API key if it was separate.
- [ ] **13.5** `[dev]` First `npm run storage:sweep` dry run. Add a reminder to the admin guide for the monthly run.
- [ ] **13.6** `[dev]` Review the logs for `get_artist_page failed`, `email_can_access_slug failed`, and `Magic link not sent`, plus the rate-limit hits, from the first week.

---

## 15. Spec → implementation traceability

| Spec item | Where |
|---|---|
| Admins: Google only, `@vydia.com`, in `admins` | D30, D31, `is_admin()`, hook, `/admin/auth/callback`, `requireAdmin` |
| Admin account fields (email, name, avatar) | `admins` columns, `claim_admin_profile()`, panel nav |
| Artist users: magic link only, no self-signup | `sendLink`, hook (D30), `email_can_access_slug` excludes admins |
| Email can belong to many artists | `artist_emails` unique per `(artist_id, email)` only; RLS by email |
| Sessions never expire; access checked live | D11 settings, D24/D25: RLS on every request, no cache |
| Artists never feel signed in | No sign-out/account UI; `NoAccess` and `/auth/signout` deleted |
| Create artist: slug auto-fill, emails, Remove/Restore, exclusives, all-or-nothing | `ArtistForm`, `save_artist` RPC |
| Land on detail with Welcome link + Copy | `redirect('/admin/artists/{id}')`, `CopyLinkButton` |
| Server checks email × slug before sending | `sendLink` → `email_can_access_slug` → then `signInWithOtp` |
| Approved: "Email sent…" + 60 s Resend | `EnterEmail` sent state, `claim_link_send` |
| Not approved message, input stays | `MESSAGES['not-approved']`, controlled input |
| Unknown slug ≡ wrong email ≡ no access | One RPC path in `sendLink`, `getArtistPage` → null for all, identical render, 200 |
| Click magic link → session → `/[slug]` | `/auth/confirm` GET route handler (D33) |
| New session replaces old | `verifyOtp` overwrites cookies; tightened double-click fallback |
| Remove email revokes immediately | RLS live join (pgTAP + e2e) |
| Slug change warning, no redirects | `slugChanged` warning + `ConfirmDialog`; no `previousSlugs` |
| Delete cascades, slug reusable | FK `on delete cascade`, garbage trigger, `deleteArtist` |
| Main resources CRUD + reorder, apply to all | `/admin/resources`, `reorder_main_resources`, no cache |
| Resources page: name, list, cover/title/type, list↔grid, grid by category | `ResourceViews(groups)`, grouped `ResourceGrid`, type label |
| Enter your email: centered input, never the artist name | `EnterEmail`, `generateMetadata` plain title |
| Magic link expired screen | `/auth/expired` (every `/auth/confirm` failure lands here) |
| Admins see artist pages | D32, `is_admin()` in RLS |
| Admin screens (login, index + search, new, detail, resources) | §8 |
| Field constraints | DB checks (§4.1) + `lib/validation.ts` (§8.4) + bucket limits (§4.8) |
| Category suggestions + case-insensitive | `CategoryInput` datalist, D38 trigger, `groupByCategory` |
| RLS, not just UI | §4.4, storage policies §4.8, pgTAP §13.2 |
| Mobile artist pages; desktop admin | Existing responsive CSS + `EnterEmail` mobile CSS; admin CSS desktop-first |
| Only email sent is the magic link, via Resend | §11 |
| Sanity read once; schema.json 1:1 | §5, §10, `tests/schema-parity.test.ts` |

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The sign-in form confirms *email × slug* pairs (required by the spec) | Per-IP and per-email limits (D34). The RPC is unreachable with the publishable key (D29). It reveals nothing unless the attacker already knows both the slug and the email. |
| Public `resource-images` bucket: a cover or PDF first-page preview of an exclusive resource is reachable by anyone holding its URL | **Accepted (owner decision, D35).** Paths are random UUIDs and never listed (no public listing policy). |
| Email scanners open magic links before the artist does (no Continue page, D33) | **Accepted (owner decision).** The artist lands on "This link has expired" and requests a new one. The 60 s cooldown is the only wait. If this shows up in practice (Microsoft 365 recipients), restoring a one-click confirm page is a small change: the iteration-one page and action are in git history. |
| Large video uploads fail over a single signed PUT | Bucket limit 1 GB on Pro. If it's flaky, switch `uploadAsset` to resumable uploads (`tus-js-client` against `/storage/v1/upload/resumable`), and keep the 1080p MP4 guidance from the old editor guide. |
| Signed file URLs expire while a page stays open for days | Card links always go through `/api/resources/[id]/file`, which re-signs on each click. Only an already-playing video past 1 h could fail, and reopening fixes it. |
| Hook or `amr` behaviour the Supabase docs leave open (sign-up paths, OAuth rejection redirect, `otp` vs `magiclink`) | Payload shape and return format are confirmed from the docs (§4.7). The rest is checked once on the new project (§12.3 V1–V6), and the code tolerates either answer. pgTAP pins the SQL side. |
| New-project auth setup missed (SMTP, templates, redirect URLs, Google redirect URI) | Checklist §12.1–12.2, verified by V1–V4 before any code depends on it |
| Admin layout blocks on the session read (Cache Components) | Acceptable for an internal desktop tool. `instant = false` as elsewhere. |
| Orphaned uploads from abandoned forms | Garbage queue for deletes and replacements (D39), plus the manual `npm run storage:sweep` (D43) |
| Cutover: everyone signs in again on the new Supabase project | Expected and harmless (§12.4). Artists are recreated and sent new links anyway. |
| Cutover: existing Sanity artist links stop working | Expected (spec: label services recreate artists). Coordinate the date with label services and send new links. |

---

## 17. Decisions and open questions

### 17.1 Resolved (owner, 2026-11-09)

| Question | Answer | Where it lands |
|---|---|---|
| Should admins see artist pages directly? | Yes | D32, `is_admin()` in `can_view_artist` / `resources_read`, pgTAP test, "Open page" link, manual QA |
| Keep the Continue page or go straight from link to session? | Straight to session | D33 (reverses D18), §3.3, §7.5 `route.ts`, e2e §13.3, risk §16 |
| Keep per-artist additional info? | Drop it | D41, §0, §9 deletions |
| Sender address | Placeholder `welcome@vydia.com` for now | §11, tasks 0.10 and 12.4 |
| Public, unguessable URLs for exclusive covers/previews? | Yes | D35, §4.8, risk §16 |
| Covers / LQIP | "The style should be the same": keep the blur-up placeholders | D42, §4.1 `*_lqip` columns, §5.2, §7.8, §8.6 `makeLqip`, §10 copies Sanity's LQIP |
| Orphan cleanup | A manual storage sweep is enough | D43, §8.6 `scripts/storage-sweep.ts`, task 6.18 |
| Shared inboxes | Add both `labelservices@` and `creativeservices@` as admins | D44, seed in §4.1, §12.2 P8 |

### 17.2 Still open

None. The only unknowns left are platform behaviours to check once on the new Supabase project (§12.3 V1–V6), and the final sender address, which stays a placeholder until launch (task 12.4).
