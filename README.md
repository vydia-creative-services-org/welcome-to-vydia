# Welcome to Vydia

Branded, per-artist welcome microsites at `welcometovydia.com/[artist-name]`. Next.js on Vercel, content in Sanity, viewer sign-in with Supabase Auth.

- Requirements: [`docs/research.md`](docs/research.md)
- Implementation plan and to-do list: [`docs/plan.md`](docs/plan.md)

## Stack versions

- **Next.js 16.4** (App Router). Request gating lives in `proxy.ts` (Next 16 renamed `middleware.ts`), and `revalidateTag` takes a second argument. `cacheComponents` is enabled in `next.config.ts`.
- **React 19.3**, **Sanity 6** (Studio embedded at `/studio`), **Supabase** (`@supabase/ssr`).
- Styling is **CSS Modules** with design tokens in `app/(site)/globals.css`. No Tailwind.

## Local setup

```bash
nvm use 22
npm install
cp .env.example .env.local   # fill in the values, see docs/plan.md §4.1
npm run dev
```

## Scripts

| Script                 | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Dev server on http://localhost:3000 |
| `npm run build`        | Production build                    |
| `npm run lint`         | ESLint                              |
| `npm run typecheck`    | Regenerates route types, then `tsc` |
| `npm run test`         | Unit tests (Vitest)                 |
| `npm run format`       | Prettier, write                     |
| `npm run format:check` | Prettier, check only (used in CI)   |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and the format check on every pull request and on pushes to `main`.
