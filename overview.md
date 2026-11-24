# Overview

**Vydia Onboarding** (`welcometovydia.com`) is an internal tool for Vydia's label services team. When a client signs, an admin creates a private page for them listing onboarding resources (PDFs, videos, links, slide decks). Every email on the client gets a permanent link that signs them straight in. It replaced the Seismic links label services used to send.

Stack: Next.js 16.4 (App Router, `cacheComponents`, `proxy.ts` instead of middleware), React 19.3, Supabase (Postgres, Auth, Storage), Resend for email, zod 4, CSS Modules (no Tailwind), Vercel hosting, Node 22.

## The two halves

| Side   | Routes                                                                    | Who                                                  | Sign-in                                     |
| ------ | ------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| Client | `app/(site)`: `/`, `/[slug]`, `/auth/open`, `/auth/inactive`              | Artists, managers, anyone whose email is on a client | Permanent emailed link, no password, no OTP |
| Admin  | `app/(admin)`: `/admin`, `/admin/clients/*`, `/admin/resources`, `/login` | `@vydia.com` staff listed in the `admins` table      | Google OAuth only (`hd=vydia.com`)          |

The two route groups have separate root layouts, stylesheets (`globals.css` / `admin.css`), and component folders (`components/` / `components/admin/`).

## Core idea: Postgres RLS is the gate

The client page is read with the **visitor's own session**, never a privileged key. `getClientPage` (`lib/client-page.ts`) calls the `security invoker` RPC `get_client_page(slug)`. RLS returns the client and its resources only if the session's email is in `client_emails` for that client **right now**. Sessions never expire (400-day cookies refreshed by `proxy.ts`), so access is taken away by removing the email, not by ending the session. Nothing about client data is cached on the server.

`/[slug]` never returns a 404 or "no access". A missing slug, an unapproved visitor, and a signed-out visitor all see the same **Enter your email** screen, so slugs can't be probed to learn who is on Vydia. `/` shows that screen too, with an empty slug, which always answers "not approved".

## Client sign-in flow

1. **Admin saves a client.** `save_client` inserts any new `client_emails` rows. An `AFTER INSERT` trigger creates a `private.access_links` row (a random 64-hex token) for each one. `sendWelcomeEmails` then sends every link with `sent_at IS NULL` through Resend and marks the ones that were sent. Kept emails are upserted, which fires no INSERT trigger, so they're never emailed again.
2. **Visitor opens `/auth/open?t=<token>`.** `open_access_link` (service role) returns the email and slug. The route then calls `auth.admin.generateLink({type: 'magiclink'})`, which sends nothing, and immediately spends the hashed token with `verifyOtp`. That creates the session cookie, and the route redirects to `/<slug>`. If the browser is already signed in as that email, the route just redirects.
3. **Lost link.** On the page the visitor enters an email. The `sendLink` action (`app/(site)/[slug]/actions.ts`) limits each IP to 20 requests per 10 minutes and allows one send per email+slug every 60 seconds. It looks up the link with `access_link_for` and re-sends the **same** permanent link. A cooldown hit still reports "sent", and a wrong email or unknown slug both give "not approved".
4. **Revoking access.** Removing an email cascades to its `access_links` row, so the link goes to `/auth/inactive`. Existing sessions fail RLS on their next load.

Guards: a **Before User Created** auth hook (`hook_before_user_created`) creates email users only if their address is on some client, and Google users only if they're in `admins`. All link and rate-limit RPCs are granted to `service_role` only. They're called through `lib/supabase/service.ts`, which uses `SUPABASE_SECRET_KEY`.

`/auth/confirm` and `/auth/expired` are kept only for old single-use one-hour magic links. The `supabase/templates/*.html` files belong to that legacy path: the app no longer has Supabase send any email.

## Admin side

- **Auth:** `signInWithOAuth(google)` → `/admin/auth/callback` → `claim_admin_profile()`, which fills in the name, avatar, and `user_id` on the `admins` row. If that returns false, the user is signed out. `is_admin()` needs three things: a `@vydia.com` email, a row in `admins`, **and** an `oauth` entry in the JWT `amr`. So an admin who opens an emailed client link gets a client session that is never an admin session. `proxy.ts` only bounces signed-out users away from `/admin/*`. The real check is `requireAdmin()` (`lib/admin/auth.ts`) plus RLS.
- **Roles** (`admins.role`, set by hand in the Supabase table editor):
  - `super` sees and edits every client, manages main resources, and reassigns owners.
  - `regular` sees and edits only clients where `clients.assigned_admin` is them. They can view main resources but not change them.
  - New clients are assigned to their creator.
- **Client editor** (`ClientForm`):
  - Fields: name, slug (auto-slugified until edited; changing it later needs a confirm because old links aren't redirected), a primary email, and extra emails.
  - Per-client hides of main resources, and exclusive resources.
  - One **Save** sends everything to the transactional `save_client(payload jsonb)` RPC, so the save is all or nothing.
  - Validation runs three times: zod in the browser, zod again in the server action, then DB constraints. `mapSaveError` turns Postgres errors into field errors.
  - A failed welcome email shows an `UnsentEmails` banner with **Retry**.
- **Main resources** (`/admin/resources`): super admins can add, edit, and delete them, and drag-reorder with dnd-kit (`reorder_main_resources`). Regular admins get a read-only list.

## Data model (`supabase/migrations/`, the source of truth)

- `admins` (email PK, role), `clients` (name, slug, assigned_admin), `client_emails` (one `is_primary` per client), `client_hidden_resources`.
- `resources` holds both kinds. `client_id IS NULL` means a **main** resource that everyone sees. Otherwise it's **exclusive** to that client. A check constraint ties `type` to `file` or `url`: pdf and video need a file, link needs a URL, slides takes exactly one of the two.
- Triggers:
  - `normalize_category` reuses an existing category's spelling when a new one matches case-insensitively.
  - `default_sort_order` appends new resources to the end.
  - `check_hide_target` only allows hiding main resources.
  - `queue_resource_garbage` puts replaced or deleted storage paths into `private.storage_garbage`.
- `private` schema (secret key only): `access_links`, `rate_limits`, `link_sends`, `storage_garbage`.
- Slugs: 3–60 characters, `a-z0-9` with single hyphens. Reserved words (`admin`, `api`, `auth`, …) are blocked by a constraint in the DB and again in `lib/slug.ts`.

## Files and images

- **Uploads** go straight from the browser to Storage (`lib/admin/upload.ts`), because Server Actions and Vercel cap request body size. First, an admin-checked server action (`uploads/actions.ts`) issues a signed upload URL. Paths look like `<resourceId>/<kind>-<uuid>.<ext>`.
- **`resource-files`** (private, 1 GB) holds PDFs, videos, and decks. They're served through `/api/resources/[id]/file`, which checks RLS with the visitor's session and then 302s to a signed URL that lasts 1 hour.
- **`resource-images`** (public, 5 MB, JPG/PNG/WebP) holds covers and PDF previews under unguessable paths, so `next/image` can optimize them.
- **PDF first-page previews** are rendered in the admin's browser with `pdfjs-dist`. The browser also generates the tiny LQIP blur placeholders, which are stored as data URLs. Cards without an image fall back to a branded Vydia tile.
- **Cleanup:** a successful save or delete calls `sweepStorage`, which drains the garbage queue. Uploads that were never saved are removed by hand with `npm run storage:sweep [--delete]`, about once a month.

## Client UI

`ResourceViews` switches between two views:

- **Carousel** (`ResourceCarousel`): a cover-flow built on a real vertical scroll container with scroll-snap, which drives a CSS `--pos` variable. On top of that it adds sideways trackpad swipes, mouse drag with fling, arrow keys, and a crossfading blurred backdrop. Below 768px it turns into a vertical stack.
- **Grid** (`ResourceGrid`): cards grouped by category.

Switching between them uses the View Transitions API to morph each card from one view to the other, with staggered timing and the focused card kept (`ViewMode.tsx`). Video cards open in a `<dialog>` player. Everything else opens in a new tab.

## Email

There is one email, `lib/welcome-email.ts`: "Open {client}’s Vydia Onboarding page". The HTML is hand-built for email clients: dark mode, a VML button for Outlook, and escaping of client-supplied text. `lib/resend.ts` posts it to Resend's HTTP API. With no `RESEND_API_KEY`, development prints the email to the console and counts it as sent, and production counts it as failed. `npm run email:preview` writes `.email-preview/welcome.html`.

## Quality and operations

- **CI** (`.github/workflows/ci.yml`):
  - The `ci` job runs lint, typecheck, Vitest, `prettier --check`, and build. Vercel uses this job as a Deployment Check, so it must keep that name.
  - The `db` job starts a local Supabase and runs the pgTAP suites in `supabase/tests`: RLS, roles, functions, access links, and `safe-statements`, which guards against Supabase's `pg_safeupdate`.
- **Unit tests:** Vitest, `tests/*.test.ts`. **End-to-end tests:** Playwright, `tests/e2e`, run by hand against a local or preview stack, never production.
- **Health:** `GET /api/health` (Bearer `HEALTH_CHECK_SECRET`; excluded from the proxy) follows the cs-monitor contract. `lib/health.ts` is vendored, so don't edit it. Critical checks: Supabase Auth, Google provider enabled, Resend key valid, a one-row DB read.
- **Deploy:** merging to `main` deploys to Vercel. Database migrations are **not** applied by a deploy: push them with `supabase db push --remote`. Commit authors must be on the Vydia Vercel team, or Vercel blocks the deploy.
- **Local:** `supabase start` (ports 55321–55329) then `npm run dev`. After any migration, run `npm run db:types`.

## Gotchas and loose ends

- **Next 16 is different.** Read `node_modules/next/dist/docs/` before touching Next-specific code (see `AGENTS.md`).
  - `export const instant = false` marks routes that are allowed to block on dynamic data under Cache Components.
  - Cache Components keeps the previous route mounted but hidden, so the DOM can briefly hold two copies of a form.
- **PostgREST:** embed resources from `clients` as `resources!resources_client_id_fkey(*)`; plain `resources(*)` is ambiguous.
- **Stale docs:**
  - The README still describes `.github/workflows/e2e-preview.yml`, which the latest commit deleted.
  - Decisions D31 and D33 in `docs/iteration-two-plan.md` were superseded. Links are now permanent, and admins listed on a client get that client's link.
  - `docs/plan.md` and `docs/sign-in-plan.md` describe iteration one, which was built on Sanity.
- **Pending cleanup:**
  - The one-argument `claim_link_send(p_email)` was kept for an old deploy and should be dropped in a later migration.
  - `cover_image_hotspot` is read on the client side, but nothing in the admin UI sets it. Only data migrated from Sanity has it.
  - `TASKS.md` lists open UI polish items: mobile grid spacing, the background and grain, search, a "skatey" gallery feel, and a mouse-follow effect.
