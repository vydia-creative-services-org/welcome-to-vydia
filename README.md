# Vydia Onboarding

An internal tool for Vydia's label services team. When a new client signs, label services creates a personalized "Vydia Onboarding" page for them, and the app emails each of the client's addresses a permanent link that signs them straight in. A client who lost it can enter an approved email on the page to get the same link again. It replaces the Seismic link label services used to send.

- Spec: [`docs/iteration-two.md`](docs/iteration-two.md)
- Implementation plan, decisions, and task list: [`docs/iteration-two-plan.md`](docs/iteration-two-plan.md)
- Guide for label services and creative services: [`docs/admin-guide.md`](docs/admin-guide.md)
- Earlier plans (iteration one, Sanity-based): [`docs/plan.md`](docs/plan.md), [`docs/sign-in-plan.md`](docs/sign-in-plan.md)

## How it works

| Piece          | Where                                  | What it does                                                                                                                                                                                                                 |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client pages   | `app/(site)/[slug]`                    | One URL per client. It shows either the resources page or the **Enter your email** screen, never a 404 or a "no access" page, so nobody can guess slugs to find out who is on Vydia.                                         |
| Client sign-in | `auth/open`, `[slug]/actions.ts`       | A permanent link per client–email pair (`private.access_links`). It never expires, can be reused, and is deleted when the email is removed from the client. Opening it mints a Supabase session server-side.                 |
| Admin panel    | `app/(admin)/admin`                    | Create, edit, and delete clients, their emails, hidden main resources, exclusive resources, and the main resources. Google sign-in only, for `@vydia.com` accounts listed in the `admins` table.                             |
| Access control | Postgres row-level security            | The page is read with the **visitor's own session**. RLS returns the client only if their verified email is linked to it right now, so removing an email cuts off access on the next load even though sessions never expire. |
| Data and files | Supabase Postgres + Storage            | Clients, emails, resources, and hides in Postgres. Files in a private bucket (served through a signed-URL route), cover images in a public bucket under unguessable paths.                                                   |
| Link email     | `lib/access-links.ts`, Resend HTTP API | The only email the app sends. Goes to every email newly added to a client on save, and to an approved email entered on the page. A failed send shows on the client page with **Retry**.                                      |
| Hosting        | Vercel                                 | Next.js on Vercel.                                                                                                                                                                                                           |

Key decisions are D23–D44 in [`docs/iteration-two-plan.md`](docs/iteration-two-plan.md) §2. The database design is in §4, and the migration file is the source of truth.

## Stack

- **Next.js 16.4** (App Router, `cacheComponents` on). Request handling is in `proxy.ts` (Next 16's name for middleware). **Read the guides in `node_modules/next/dist/docs/` before changing Next-specific code**; this version differs from older ones.
- **React 19.3**, **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`), **zod 4** for validation, **dnd-kit** for drag-to-reorder, **pdfjs-dist** for PDF first-page previews, **Playwright** and **Vitest** for tests.
- **CSS Modules** with design tokens in `app/(site)/globals.css` (client side) and `app/(admin)/admin.css` (admin side). No Tailwind.
- **Node 22.**

## Local setup

You need Node 22, Docker, and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
nvm use 22
npm install
cp .env.example .env.local   # fill in the values below
supabase start               # local database, auth, storage, and a mail inbox
npm run dev                  # http://localhost:3000
```

The local stack uses ports `55321`–`55329` (API `55321`, database `55322`, Studio `55323`, mail inbox `55324`), so it can run next to another Supabase project. `supabase status -o env` prints the local keys.

To use the hosted project instead, put its URL and keys in `.env.local`.

### Environment variables

| Variable                               | Where it comes from                                                          | Used by                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000` locally, `https://welcometovydia.com` in production  | Welcome links, magic-link redirects                                                                           |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API                                            | Everything                                                                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys (`sb_publishable_…`)                                     | Browser and server clients (always subject to RLS)                                                            |
| `SUPABASE_SECRET_KEY`                  | Supabase → API Keys (`sb_secret_…`). **Server only. Never `NEXT_PUBLIC_`.**  | `lib/supabase/service.ts` (sign-in approval, rate limits), the scripts, and the e2e fixtures                  |
| `RESEND_API_KEY`                       | Resend → API Keys (sending access, `onboarding.vydia.com`). **Server only.** | `lib/resend.ts`. Without it, development prints emails to the console and production reports them as not sent |
| `EMAIL_FROM`                           | e.g. `Vydia <welcome@onboarding.vydia.com>` (a verified Resend domain)       | `lib/resend.ts`                                                                                               |
| `SUPABASE_PROJECT_ID`                  | The project ref (`lsihwkbnrheczirlkswo`)                                     | Supabase CLI commands                                                                                         |

`.env.local` is gitignored; `.env.example` lists every variable.

## Scripts

| Script                                       | What it does                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                | Dev server on http://localhost:3000                                                                                    |
| `npm run build` / `npm run start`            | Production build / serve it                                                                                            |
| `npm run lint`                               | ESLint                                                                                                                 |
| `npm run typecheck`                          | Regenerates Next route types, then `tsc`                                                                               |
| `npm run test`                               | Unit tests (Vitest, `tests/*.test.ts`)                                                                                 |
| `npm run db:test`                            | Database tests (pgTAP, `supabase/tests`) against the local stack                                                       |
| `npm run db:types`                           | Regenerates `lib/supabase/database.types.ts` from the **local** database. Run it after every migration.                |
| `npm run e2e`                                | End-to-end tests (Playwright, `tests/e2e`)                                                                             |
| `npm run e2e:setup` / `npm run e2e:teardown` | Create / remove the e2e clients, resources, and test users                                                             |
| `npm run storage:sweep`                      | Lists uploaded files nothing references and that are over 24 hours old. Add `--delete` to remove them. Run it monthly. |
| `npm run format` / `npm run format:check`    | Prettier                                                                                                               |

### Database changes

1. `supabase migration new <name>` and write the SQL. Never edit a migration that has already been pushed.
2. `supabase db reset` to apply everything from scratch, then `npm run db:test` and `npm run db:types`.
3. If you changed `supabase/config.toml` (auth hook, templates, ports), run `supabase stop && supabase start`. `db reset` does not reload it.
4. Push with `supabase db push --remote` (agent runs also need `--yes`).

Things that have already bitten this project:

- Supabase's API layer enforces `pg_safeupdate`, which rejects any `DELETE` or `UPDATE` without a `WHERE`. Direct database tests don't, so `supabase/tests/safe-statements.test.sql` fails if a function breaks this.
- `resources(*)` embedded from `clients` is ambiguous to PostgREST. Use `resources!resources_client_id_fkey(*)`.
- Cache Components keeps the previous route mounted but hidden, so after a navigation the DOM can briefly hold two copies of a form. Test selectors should look at visible elements.

### End-to-end tests

The suite signs in as four test users using admin-generated magic links, so it needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`. It creates real rows, so point it at a local stack or the preview project, never production.

```bash
npm run build && npm run start &     # or set E2E_BASE_URL to a deployment
npm run e2e:setup
npm run e2e
npm run e2e:teardown
```

Google sign-in can't be automated. One test (`storage-queue.spec.ts`) calls a database function through the REST API as an admin and only runs when `E2E_ADMIN_ACCESS_TOKEN` is set.

## CI

- `.github/workflows/ci.yml`: job `ci` (lint, typecheck, unit tests, format check, and build; a Vercel Deployment Check, so don't rename it); and a `db` job that starts a local Supabase and runs the pgTAP tests. Both run on every PR and push to `main`.
- `.github/workflows/e2e-preview.yml`: Playwright against each successful Vercel preview deployment, using the repository variable `NEXT_PUBLIC_SUPABASE_URL` and the secrets `SUPABASE_SECRET_KEY` and `VERCEL_AUTOMATION_BYPASS_SECRET`.

## Operations

- **Owner:** vydia-creative-services
- **Health route:** `GET /api/health` (Bearer `HEALTH_CHECK_SECRET`), watched by cs-monitor. Alerts: #cs-projects-alerts.
- **Critical (DOWN, every 2 min):** `supabase_auth` (Supabase Auth health), `supabase_google` (Google provider enabled in Supabase Auth), `resend_key` (Resend accepts the API key; empty body, nothing is sent), `supabase_db` (one-row read of `resources` with the service client).
- **Non-critical (DEGRADED, every 30 min via `?tier=all`):** none.
- **Workflow failure alerts:** none. This repo has no scheduled workflows.
- **Blind spots:** Vercel-wide outages. Supabase Storage (files and cover images), Google's own OAuth availability, and email delivery after Resend accepts a message.
- **Rotate the secret:** new `HEALTH_CHECK_SECRET` here + `HEALTH_SECRET_WELCOME_TO_VYDIA` in cs-monitor, redeploy both.
- **CI:** `.github/workflows/ci.yml`, job `ci` (a Vercel Deployment Check — don't rename).

## Deploy flow

1. Push a branch and open a PR. CI runs; Vercel builds a preview, and the e2e workflow runs against it.
2. Merge to `main`. Vercel deploys production.
3. Database migrations are **not** applied by a deploy. Push them with `supabase db push --remote` before or with the code that needs them.

Vercel needs `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (sensitive), `RESEND_API_KEY` (sensitive), and `EMAIL_FROM` for Production and Preview. Commits must be authored by an account on the Vydia Vercel team, or Vercel blocks the deployment.

## Dashboards

| Service      | Where                                                                       | What lives there                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase     | https://supabase.com/dashboard → project `lsihwkbnrheczirlkswo`             | Tables (including `admins`), storage buckets, Auth settings (providers, URL configuration, SMTP, email templates, the **Before User Created** hook) |
| Resend       | https://resend.com                                                          | The verified sending domain, and the API key the app sends with (`RESEND_API_KEY`)                                                                  |
| Google Cloud | console.cloud.google.com → "Welcome to Vydia"                               | The OAuth client and consent screen used by the admin Google sign-in. Its redirect URI must include the Supabase project's `/auth/v1/callback`.     |
| Vercel       | vercel.com → team `vydia-creative-services-vercel-org` → `welcome-to-vydia` | Deployments, environment variables, domain                                                                                                          |
| GitHub       | `vydia-creative-services-org/welcome-to-vydia`                              | Code, CI, Actions secrets and variables                                                                                                             |

Email templates for Supabase live in `supabase/templates/` (the subject is in the first line of each file and in `supabase/config.toml`). **Templates, SMTP, the hook, and URL settings are per Supabase project**, so they have to be set again on a new project. The checklist is in `docs/iteration-two-plan.md` §12.

The previous Supabase project (`cqqzvzljlthrqrttqnga`) and the Sanity project are kept only until the post-launch cleanup (plan Phase 13).

## Rotating secrets

**Supabase secret key** (`SUPABASE_SECRET_KEY`)

1. Supabase → API Keys → create a new secret key.
2. Update it in Vercel (Production and Preview), in the GitHub Actions secret, and in your `.env.local`, then redeploy.
3. Once the new deployment is live, delete the old key. Secret keys can be revoked one at a time.

**Supabase publishable key**: create a new one, update `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel, redeploy, then revoke the old one.

**Resend API key** (`RESEND_API_KEY`)

1. Resend → API Keys → create a new sending-only key.
2. Update `RESEND_API_KEY` in Vercel (Production and Preview) and redeploy.
3. Add an email to a test client, check it arrives, then delete the old key in Resend.

## Admins

Admins are managed by hand in the Supabase table editor (`admins` table): add the person's `@vydia.com` email, and their name and avatar fill in on their first Google sign-in. Removing the row ends their access on their next request. `labelservices@vydia.com` and `creativeservices@vydia.com` are seeded by the migration.

## Project layout

```
app/(site)/          client side: /, /[slug], /auth/open, /auth/inactive, /auth/confirm + /auth/expired (old one-hour links)
app/(admin)/         admin side: /admin/login, /admin/auth/*, and the panel under /admin/(panel)
app/api/resources/   the signed-URL file route
components/          client UI; components/admin/ for the admin panel
lib/                 Supabase clients, client page data, validation, resource mapping, admin helpers
scripts/             storage-sweep, e2e-fixtures, preview-email, export-brand-assets
supabase/            migrations, pgTAP tests, config, and email templates
tests/               unit tests (Vitest) and tests/e2e (Playwright)
docs/                spec, plans, and the admin guide
```
