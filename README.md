# Welcome to Vydia

Branded, per-artist welcome microsites at `welcometovydia.com/[artist-name]`. Each new client gets a page with Vydia's onboarding resources (guides, tutorial videos, pitch forms, service decks). The page is gated to the email addresses listed on their artist record. It replaces the Seismic link L&A used to send.

- Requirements: [`docs/research.md`](docs/research.md)
- Implementation plan, decisions, and to-do list: [`docs/plan.md`](docs/plan.md)
- Editor guide for L&A and Creative Services: [`docs/editor-guide.md`](docs/editor-guide.md)

## How it works

| Piece   | Where                                                  | What it does                                                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site    | Next.js 16 App Router on Vercel                        | `/[slug]` artist pages, `/` instructions, `/login`, `/auth/*`                                                                                                                                                                                                         |
| Content | Sanity (private dataset), Studio embedded at `/studio` | Artists, resources, and the global Website layout                                                                                                                                                                                                                     |
| Sign-in | Supabase Auth                                          | Email/password (with email confirmation) and Google                                                                                                                                                                                                                   |
| Gate    | `proxy.ts` + `lib/access.ts`                           | Signed-out visitors go to `/login` for every path. After sign-in, the page checks the email against the artist's allowed list (case-insensitive) plus the permanent and internal viewers. Unknown artists and denied visitors get the identical "not available" page. |
| Cache   | `'use cache'` + `cacheTag` in `lib/sanity/fetch.ts`    | Sanity data is cached until Sanity's publish webhook calls `/api/revalidate`                                                                                                                                                                                          |

Key decisions are recorded as D1–D15 in [`docs/plan.md`](docs/plan.md) §1.

## Stack

- **Next.js 16.4** (App Router, `cacheComponents` on). Request gating is in `proxy.ts` (Next 16's name for middleware).
- **React 19.3**, **Sanity 6** with `next-sanity`, **Supabase** with `@supabase/ssr`.
- **CSS Modules** with design tokens in `app/(site)/globals.css`. No Tailwind.
- **Node 22.**

## Local setup

```bash
nvm use 22
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000, Studio at http://localhost:3000/studio
```

### Environment variables

| Variable                               | Where it comes from                                                         | Used by                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000` locally, `https://welcometovydia.com` in production | Auth redirects                                                                             |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`        | sanity.io/manage → project `t7ic4vs4`                                       | Site, Studio, CLI                                                                          |
| `NEXT_PUBLIC_SANITY_DATASET`           | `production`                                                                | Site, Studio, CLI                                                                          |
| `SANITY_API_READ_TOKEN`                | sanity.io/manage → API → Tokens (Viewer role)                               | Server only: reads the private dataset                                                     |
| `SANITY_REVALIDATE_SECRET`             | `openssl rand -hex 32`. Must match the Sanity webhook's secret              | `/api/revalidate`                                                                          |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API                                           | Auth                                                                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys (`sb_publishable_…`)                                    | Auth                                                                                       |
| `PERMANENT_VIEWER_EMAILS`              | `labelrelationships@vydia.com,creativeservices@vydia.com`                   | Access check (always allowed on every artist page)                                         |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase → API Keys. **Local only, optional**                               | `npm run e2e:setup` / `e2e:teardown` only. The app never reads it. Don't add it to Vercel. |

`.env.local` is gitignored; `.env.example` lists every variable.

## Scripts

| Script                                              | What it does                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                       | Dev server on http://localhost:3000                                                                                      |
| `npm run build` / `npm run start`                   | Production build / serve it                                                                                              |
| `npm run lint`                                      | ESLint                                                                                                                   |
| `npm run typecheck`                                 | Regenerates Next route types, then `tsc`                                                                                 |
| `npm run test`                                      | Unit tests (Vitest, `tests/*.test.ts`)                                                                                   |
| `npm run e2e`                                       | End-to-end tests (Playwright, `tests/e2e/`)                                                                              |
| `npm run e2e:setup` / `npm run e2e:teardown`        | Create / remove the e2e test users and their access                                                                      |
| `npm run typegen`                                   | Re-extract the Sanity schema and regenerate `lib/sanity/types.generated.ts` (run after changing schemas or GROQ queries) |
| `npm run format` / `npm run format:check`           | Prettier                                                                                                                 |
| `npx sanity exec scripts/seed.ts --with-user-token` | Create the Website singleton (safe to re-run)                                                                            |

### End-to-end tests

The e2e suite signs in as two throwaway users: one approved on `test-artist`/`test-renamed`, one not approved anywhere.

```bash
npm run build && npm run start &              # or point E2E_BASE_URL at a deployment
export E2E_PASSWORD="e2e-$(openssl rand -hex 12)"
npm run e2e:setup                             # needs SUPABASE_SERVICE_ROLE_KEY and a `sanity login`
npm run e2e
npm run e2e:teardown
```

`e2e:setup` also calls `/api/revalidate` so the cached access lookups pick up the new users. In CI, `.github/workflows/e2e-preview.yml` does the same against each Vercel preview; see the secrets it needs in `docs/plan.md` task 10.4.

## CI

- `.github/workflows/ci.yml`: lint, typecheck, unit tests, and format check on every PR and push to `main`.
- `.github/workflows/e2e-preview.yml`: Playwright against each successful Vercel preview deployment.

## Deploy flow

1. Push a branch and open a PR. CI runs; Vercel builds a preview, and the e2e workflow runs against it.
2. Merge to `main`. Vercel deploys production to `welcometovydia.com`.
3. Content changes don't need a deploy. Publishing in Studio triggers the Sanity webhook → `/api/revalidate` → the affected pages refresh on the next visit.

The Vercel project needs every variable above except `SUPABASE_SERVICE_ROLE_KEY`, for both Preview and Production. Pages can be prerendered with Sanity content at build time, so `SANITY_API_READ_TOKEN` is needed by the **build** too.

## Dashboards

| Service      | Where                                                           | What lives there                                                                                                                    |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sanity       | https://www.sanity.io/manage → "Welcome to Vydia" (`t7ic4vs4`)  | Members/seats, API tokens, CORS origins, webhooks, usage and plan (**upgrade to Growth before the trial ends**, see plan task 0.17) |
| Studio       | `/studio` on the site                                           | Content editing (shared L&A and Creative Services logins)                                                                           |
| Supabase     | https://supabase.com/dashboard → project `cqqzvzljlthrqrttqnga` | Users, providers (email, Google), URL configuration, SMTP, email templates                                                          |
| Google Cloud | console.cloud.google.com → "Welcome to Vydia"                   | OAuth client and consent screen used by Supabase's Google provider                                                                  |
| Vercel       | vercel.com → the Welcome to Vydia project                       | Deployments, environment variables, domain                                                                                          |
| GitHub       | `vydia-creative-services-org/welcome-to-vydia`                  | Code, CI, Actions secrets for the e2e workflow                                                                                      |

Email templates for Supabase live in `supabase/templates/` (the subject is in the first line of each file).

## Rotating secrets

**Sanity read token** (`SANITY_API_READ_TOKEN`)

1. sanity.io/manage → API → Tokens → add a new token with the **Viewer** role.
2. Put it in Vercel (Preview + Production) and your `.env.local`, then redeploy.
3. Once the new deployment is live, delete the old token in Sanity.

**Webhook secret** (`SANITY_REVALIDATE_SECRET`)

1. Generate a new one: `openssl rand -hex 32`.
2. Update it in Vercel (and the `SANITY_REVALIDATE_SECRET` GitHub Actions secret), then redeploy.
3. Right after the deploy, edit the webhook in sanity.io/manage → API → Webhooks and paste the same secret. Webhook calls between steps 2 and 3 get a 401, so publish anything urgent again afterwards.

**Supabase keys**: Supabase → API Keys. Create a new publishable key, update `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel, redeploy, then revoke the old key. If the service key leaks, rotate it in Supabase and update the GitHub Actions secret.

## Project layout

```
app/(site)/          site routes (layout, /, /[slug], /login, /auth/*, /account/*)
app/studio/          embedded Sanity Studio
app/api/revalidate/  Sanity webhook
components/          UI components, each with a co-located .module.css
lib/                 access check, Sanity data layer, Supabase clients, helpers
sanity/              schema types, desk structure, document actions, PDF preview input
scripts/             seed and e2e fixture scripts
tests/               unit tests (Vitest) and tests/e2e (Playwright)
supabase/templates/  Supabase email templates
```
