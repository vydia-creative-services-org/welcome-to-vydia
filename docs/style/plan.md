# Design Refresh Plan: Admin, Sign-in Screens, and Emails

> Companion to [`research.md`](./research.md), which documents the current system (section numbers like "research §7.1" point there). Written 2026-11-11 against `final-style` @ `4e036ac`.
>
> **Revision 2 (2026-11-11), after owner review.** Every open decision is resolved (§10). Changes from the first draft:
>
> - **Dark mode is in scope.** The admin has a light/dark toggle next to the profile picture (§5).
> - **All headings use Title Case** (§1, §4.7).
> - **Roboto Mono** is the monospace (§2.1).
> - **The email headline is "Welcome to Vydia"** (§7.3).
> - **Concentric geometry is now a strict rule**, and every manual style override in the current code is audited against it (§2.5).
>
> 

## 0. What this plan does

**Goal.** Bring the admin panel, every sign-in surface, and the magic-link email up to the craft level of Vercel's dashboard and Apple's product UI: calm, precise, quick to respond, and clearly *made for Vydia* rather than assembled from defaults. Every existing feature must keep working.

"Like Vercel / like Apple" here means matching their **standards**, not cloning their brand:

- Vercel: a disciplined neutral scale, hairline materials, dense but legible type, clear one-primary-action hierarchy, keyboard affordances, instant feedback.
- Apple: concentric geometry, motion that explains where things came from, segmented controls, generous touch targets, honest copy.
- Vydia's own identity comes through in three places: the wordmark, the iOS curve the client site already uses (`--switch-ease`), and a voice that sounds like label services talking to a client.

### 0.1 Scope

| In scope                                                                                              | Out of scope                                                    |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Admin panel: shell, clients, client form, resources, dialogs                                          | The client **resources page** (carousel/grid). The owner likes it as-is. |
| **Admin light and dark themes**, with a toggle next to the profile picture                            | Dark mode for the client site (it's already dark) or for the email beyond §7 |
| **Auth surfaces:** admin `/admin/login`, client Enter-your-email / Sent / Link-expired screens        | Routes, server actions, RLS, Supabase functions                 |
| **Emails:** the magic-link template (`magic-link.html` + `confirm-signup.html`)                       | New emails (the app still sends exactly one)                    |
| Bug fixes found in research §7 that the refresh touches anyway                                        | Tailwind or any CSS framework (decision D12 stands)             |

### 0.2 Invariants: these must not change

Several of these are asserted by Playwright and would break CI. Others protect production behavior.

| Invariant                                                                                                                                                                                | Why                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/admin/login`: `main` contains **exactly one button**, named **Sign in with Google**. No `input[type=email|password]`.                                                                  | `tests/e2e/admin.spec.ts:14-16`             |
| Login error copy `You don’t have access.` is shown only for whitelisted `?error=` values                                                                                                  | `admin.spec.ts:19-24`                       |
| `/` and `/[slug]` sign-in: placeholder **Enter your email**, button **Continue**, `#enter-email-message`, exact NOT_APPROVED text, **Email sent, check your inbox**, `Resend email (Ns)` | `sign-in.spec.ts`, `a11y.spec.ts`           |
| `/` has **no links inside `main`**. Client pages have no sign-out, account, profile, or admin links.                                                                                     | `access.spec.ts:35, 71-75`                  |
| Expired page: heading text **This link has expired** (casing may change to Title Case, see note below), link **Send a new link**                                                         | e2e                                         |
| Axe WCAG 2.2 AA passes on every screen it already covers                                                                                                                                  | `a11y.spec.ts`                              |
| Email link is **verbatim** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`                                                             | `/auth/confirm` contract. Never `.ConfirmationURL`. |
| `public/vydia-logo.png` keeps existing at the same URL                                                                                                                                   | Emails already sitting in inboxes load it   |
| `magic-link.html` ≡ `confirm-signup.html`. Subject stays **Open your Vydia Onboarding page** unless deliberately changed in `config.toml`, the dashboard, and the docs. | Supabase picks either template              |
| `lib/resources/types.ts` `RESOURCE_TYPES` is unchanged                                                                                                                                    | `tests/schema-parity.test.ts`               |
| Every server action, its inputs, and its error strings keep their contracts                                                                                                              | Feature parity                              |

> **Title Case and the tests.** Playwright matches `getByRole(…, {name})` and `getByText` **case-insensitively, as a substring**, unless `exact: true` is passed (verified in `node_modules/playwright-core/types/types.d.ts`). The only `exact: true` assertion (`resources.spec.ts:70`, "Getting Started") targets a resource category, which is data and not UI copy. So headings like "This Link Has Expired" still satisfy the existing tests. Only **headings** change case. Buttons, placeholders, labels, and status messages, which the tests also assert, stay exactly as they are.

---

## 1. Design principles

These are the rules the code below implements. When a decision isn't covered here, pick the option that best serves these principles.

1. **Quiet until it matters.** The UI is neutral grays. Color appears only to mean something: blue for focus and links, red for destructive or error, green for done, amber for "careful". Each view has one primary (black) button.
2. **Every action answers back within 100 ms.** Buttons respond to the press itself (`scale(.98)`), busy buttons show a spinner and keep their size, copy turns into a ✓, saves confirm with a toast, and unsaved work is announced.
3. **Motion explains, it never decorates.** Use one easing curve across the product (the client site's iOS curve, `cubic-bezier(.32,.72,0,1)`) with three durations (120/200/320 ms). Dialogs rise from where your eye is, and toasts slide from the corner they live in. `prefers-reduced-motion` removes all of it.
4. **Typography is the interface.** Tight tracking on headings, tabular numbers for dates and countdowns, balanced heading wraps, real quotes and ellipses. A monospace for machine strings (slugs, URLs, file names, keys) so people can tell *data* from *labels* at a glance.
5. **Concentric geometry, layered materials.** When one rounded shape wraps another closely, **outer radius = inner radius + gap**, exactly (the full rule and override audit are in §2.5). There are three elevations (flat card, floating bar or menu, modal), with borders drawn as hairlines or shadows rather than heavy strokes.
6. **Honest, human copy.** Say what happened and what didn't ("Nothing was changed."). Use second person, no jargon, and no exclamation marks. **Headings are Title Case** (page titles, card titles, dialog titles, empty-state titles, the email headline). **Everything else is sentence case**: buttons, labels, hints, placeholders, toasts, errors, and the email subject. Title Case rules: capitalize every word except articles (*a, an, the*), coordinating conjunctions (*and, but, or*), and prepositions of three letters or fewer (*to, in, of, for, on, at, by*), unless the word comes first or last. Phrasal verbs keep their particle capitalized ("Sign In"). Hyphenated compounds capitalize both parts ("Client-Specific").
7. **Keyboard is first-class.** `/` focuses search, `⌘↵` / `Ctrl↵` saves, `Esc` closes. Hints appear as `<kbd>` where they help. Focus is always visible.
8. **At home in light and dark.** Every color is a theme-aware token, and contrast is checked in both themes. The admin follows the OS by default, and one toggle overrides it. Native controls (scrollbars, date pickers, file buttons) follow the theme through `color-scheme`.

---

## 2. Foundations (Phase 1) ✅ Completed

### 2.1 Fonts

Keep **Public Sans**. It's shared with the client site, and that shared typeface is what ties the products together. Add **Roboto Mono** (owner's choice, Google's open-source mono, available through `next/font/google`; `Roboto_Mono` is verified in `node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`) as the technical voice for slugs, URLs, file names, and keyboard hints.

`app/(admin)/layout.tsx` (final version, including the theme script from §5):

```tsx
import type {Metadata} from 'next'
import {Public_Sans, Roboto_Mono} from 'next/font/google'
import {Analytics} from '@vercel/analytics/next'
import {SpeedInsights} from '@vercel/speed-insights/next'
import {THEME_SCRIPT} from '@/components/admin/theme'
import './admin.css'

const sans = Public_Sans({subsets: ['latin'], variable: '--font-public-sans'})
const mono = Roboto_Mono({subsets: ['latin'], variable: '--font-roboto-mono'})

export const metadata: Metadata = {title: 'Vydia Onboarding · Admin', robots: {index: false, follow: false}}

export default function AdminRootLayout({children}: {children: React.ReactNode}) {
  return (
    // The inline script may set data-theme before React hydrates, so React must accept the DOM's value.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: THEME_SCRIPT}} />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

> Per `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`, both are variable fonts (`Roboto_Mono` accepts `weight: 'variable'`), so no `weight` is needed, and `display` defaults to `swap`. Roboto Mono runs wider than Public Sans, so the `.mono` utility (§2.3) scales it to `0.92em`. Tune that by eye once it's on screen.

### 2.2 Tokens v2: `app/(admin)/admin.css`

The structure has two layers. **Primitives** (raw scales: `--gray-*` for light, `--night-*` for dark) must never be used in components. **Semantic tokens** (`--admin-*`) are what components use. Each semantic color is written once with CSS [`light-dark()`](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark), so a single declaration serves both themes, and the active theme is chosen purely through `color-scheme` (§5). `light-dark()` returns a `<color>`, so it also works *inside* shadows and rings. The old names stay as **aliases** until Phase 7, so nothing breaks mid-migration.

Contrast figures in comments are **light / dark** on the surface each token is used on.

```css
:root {
  /* Follow the OS until the admin picks a theme; §5 sets data-theme. */
  color-scheme: light dark;

  /* ── 1. Primitives (do not use in components) ───────────────────────── */
  --gray-0: #ffffff;
  --gray-50: #fafafa;
  --gray-100: #f5f5f5;
  --gray-200: #ebebeb;
  --gray-300: #e0e0e0;
  --gray-400: #c9c9c9;
  --gray-500: #a8a8a8;
  --gray-600: #8f8f8f;
  --gray-700: #737373;
  --gray-800: #666666;
  --gray-900: #4d4d4d;
  --gray-1000: #171717;

  --night-0: #0a0a0a;
  --night-50: #111111;
  --night-100: #1a1a1a;
  --night-200: #222222;
  --night-300: #262626;
  --night-400: #3d3d3d;
  --night-500: #525252;
  --night-600: #8f8f8f;
  --night-700: #a1a1a1;
  --night-1000: #ededed;

  --blue-100: #ebf5ff;
  --blue-600: #0072f5;
  --blue-700: #0068d6;
  --blue-400: #52a8ff;
  --blue-950: #0b1d33;
  --red-100: #ffeded;
  --red-700: #c52828;
  --red-800: #a51f1f;
  --red-400: #ff6166;
  --red-950: #2a1314;
  --green-100: #ebfaef;
  --green-700: #237a3b;
  --green-400: #4cc26f;
  --green-950: #0f2216;
  --amber-100: #fff4e5;
  --amber-700: #a35200;
  --amber-400: #ffb224;
  --amber-950: #2a1d05;

  /* ── 2. Semantic color (light, dark) ─────────────────────────────────── */
  --admin-bg: light-dark(var(--gray-50), var(--night-0));
  --admin-surface: light-dark(var(--gray-0), var(--night-50));
  --admin-surface-subtle: light-dark(var(--gray-50), var(--night-0)); /* card footers, table header, insets */
  --admin-raised: light-dark(var(--gray-0), var(--night-200)); /* selected segment, kbd: sits above its track */
  --admin-hover: light-dark(var(--gray-100), var(--night-100));
  --admin-active: light-dark(var(--gray-200), var(--night-200));
  --admin-selected: light-dark(var(--gray-200), var(--night-200));

  --admin-border: light-dark(var(--gray-200), var(--night-300)); /* hairlines: cards, rows, dividers */
  --admin-border-input: light-dark(var(--gray-400), var(--night-400)); /* fields read as fields */
  --admin-border-hover: light-dark(var(--gray-500), var(--night-500));

  --admin-text: light-dark(var(--gray-1000), var(--night-1000)); /* 17.9 / 16.1 */
  --admin-text-secondary: light-dark(var(--gray-800), var(--night-700)); /* 5.74 / 7.31 */
  --admin-text-placeholder: light-dark(var(--gray-700), var(--night-600)); /* 4.74 / 5.84 */
  --admin-icon: light-dark(var(--gray-600), var(--night-600)); /* 3.23 / 5.84, non-text only */

  --admin-accent: light-dark(var(--gray-1000), var(--night-1000)); /* black button / white button */
  --admin-accent-hover: light-dark(#000000, #ffffff);
  --admin-accent-text: light-dark(var(--gray-0), var(--night-0)); /* 17.9 / 16.9 */

  --admin-link: light-dark(var(--blue-700), var(--blue-400)); /* 5.31 / 7.56 */
  --admin-focus: light-dark(var(--blue-600), var(--blue-400)); /* 4.44 / 7.56 */
  --admin-info: light-dark(var(--blue-700), var(--blue-400));
  --admin-info-bg: light-dark(var(--blue-100), var(--blue-950)); /* text on it: 4.82 / 6.79 */
  --admin-danger: light-dark(var(--red-700), var(--red-400)); /* 5.66 / 6.43 */
  --admin-danger-bg: light-dark(var(--red-100), var(--red-950)); /* 5.01 / 5.95 */
  --admin-danger-solid: var(--red-700); /* filled destructive button and error toast, both themes */
  --admin-danger-solid-hover: var(--red-800);
  --admin-on-solid: #ffffff; /* text on danger-solid: 5.66 */
  --admin-success: light-dark(var(--green-700), var(--green-400)); /* 5.36 / 8.32 */
  --admin-success-bg: light-dark(var(--green-100), var(--green-950)); /* 4.96 / 7.34 */
  --admin-warning: light-dark(var(--amber-700), var(--amber-400)); /* 5.58 / 10.5 */
  --admin-warning-bg: light-dark(var(--amber-100), var(--amber-950)); /* 5.13 / 9.12 */
  --admin-selection: light-dark(var(--blue-100), var(--blue-950));
  --admin-grid-dot: light-dark(var(--gray-300), var(--night-300)); /* login backdrop */

  /* ── 3. Type ─────────────────────────────────────────────────────────── */
  --admin-font: var(--font-public-sans), ui-sans-serif, system-ui, sans-serif;
  --admin-font-mono: var(--font-roboto-mono), ui-monospace, 'SF Mono', Menlo, monospace;

  --text-12: 12px;
  --leading-12: 16px;
  --text-13: 13px;
  --leading-13: 18px;
  --text-14: 14px;
  --leading-14: 20px;
  --text-16: 16px;
  --leading-16: 24px;
  --text-20: 20px;
  --leading-20: 28px;
  --text-24: 24px;
  --leading-24: 32px;
  --tracking-snug: -0.01em; /* 16–20px headings */
  --tracking-tight: -0.02em; /* 24px+ */

  /* ── 4. Space (unchanged values) ─────────────────────────────────────── */
  --admin-space-1: 4px;
  --admin-space-2: 8px;
  --admin-space-3: 12px;
  --admin-space-4: 16px;
  --admin-space-5: 24px;
  --admin-space-6: 32px;
  --admin-space-7: 48px;

  /* ── 5. Shape: concentric radii (rule and audit in §2.5) ─────────────── */
  --radius-inner: 4px; /* = control 6 − 2px track padding (segments) */
  --radius-control: 6px; /* buttons, inputs, rows, nav pills */
  --radius-card: 12px; /* = control 6 + 6px gap (save bar, toolbar), and every card for consistency */
  --radius-dialog: 12px;
  --radius-full: 9999px; /* pills and avatars: concentric with anything */
  --control-sm: 28px;
  --control-md: 32px;
  --control-lg: 40px;
  --icon-md: 16px;
  --admin-content-width: 1200px;

  /* ── 6. Materials (shadows soften in dark, where depth comes from surface lightness) ── */
  --shadow-xs: 0 1px 2px light-dark(rgb(0 0 0 / 0.04), rgb(0 0 0 / 0));
  --shadow-card: 0 1px 2px light-dark(rgb(0 0 0 / 0.04), rgb(0 0 0 / 0));
  --shadow-float:
    0 0 0 1px light-dark(rgb(0 0 0 / 0.06), rgb(255 255 255 / 0.08)),
    0 4px 8px -4px light-dark(rgb(0 0 0 / 0.06), rgb(0 0 0 / 0.4)),
    0 16px 24px -8px light-dark(rgb(0 0 0 / 0.08), rgb(0 0 0 / 0.5));
  --shadow-modal:
    0 0 0 1px light-dark(rgb(0 0 0 / 0.08), rgb(255 255 255 / 0.1)),
    0 8px 16px -4px light-dark(rgb(0 0 0 / 0.06), rgb(0 0 0 / 0.4)),
    0 24px 48px -12px light-dark(rgb(0 0 0 / 0.18), rgb(0 0 0 / 0.6));
  --shadow-drag: 0 12px 32px -8px light-dark(rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.6));
  --admin-backdrop: light-dark(rgb(0 0 0 / 0.32), rgb(0 0 0 / 0.6));
  --ring-input: 0 0 0 3px light-dark(rgb(0 114 245 / 0.18), rgb(82 168 255 / 0.28));
  --ring-danger: 0 0 0 3px light-dark(rgb(197 40 40 / 0.16), rgb(255 97 102 / 0.24));

  /* ── 7. Motion: the client site's iOS curve, shared DNA ───────────────── */
  --ease-out: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-fast: 120ms; /* color, border, press */
  --duration-base: 200ms; /* toasts, popovers, row changes */
  --duration-slow: 320ms; /* dialogs */

  /* ── 8. Icons used from CSS ──────────────────────────────────────────── */
  /* #8f8f8f works in both themes (3.23:1 on white, 5.84:1 on #111), so one data URI suffices. */
  --icon-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238f8f8f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");

  /* ── Back-compat aliases (delete in Phase 7) ─────────────────────────── */
  --admin-muted: var(--admin-text-secondary);
  --admin-radius: var(--radius-control);
}

/* Explicit choice from the toggle (§5) wins over the OS. */
:root[data-theme='light'] {
  color-scheme: light;
}
:root[data-theme='dark'] {
  color-scheme: dark;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-base: 0ms;
    --duration-slow: 0ms;
  }
}

/* "Increase contrast" (macOS/iOS) or Windows contrast themes: fields meet WCAG 1.4.11's 3:1. */
@media (prefers-contrast: more) {
  :root {
    --admin-border: light-dark(var(--gray-500), var(--night-500));
    --admin-border-input: light-dark(#949494, #6b6b6b); /* 3.03 / 3.54 */
    --admin-text-secondary: light-dark(var(--gray-900), var(--night-1000));
  }
}

/* "Reduce transparency": frosted bars become solid. */
@media (prefers-reduced-transparency: reduce) {
  :root {
    --admin-frost: 100%;
  }
}
```

> `--admin-frost` (default `82%`, declared in §4.1 and used by the sticky bar and the save bar) is the opacity mixed into frosted surfaces. Setting it to `100%` makes them opaque.

### 2.3 Base layer (the rest of `admin.css`)

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scrollbar-gutter: stable;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--admin-bg);
  color: var(--admin-text);
  font-family: var(--admin-font);
  font-size: var(--text-14);
  line-height: var(--leading-14);
  font-synthesis-weight: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1,
h2,
h3,
p,
ul,
ol,
fieldset {
  margin: 0;
}
h1,
h2,
h3 {
  text-wrap: balance;
}
p {
  text-wrap: pretty;
}
fieldset {
  padding: 0;
  border: 0;
  min-width: 0;
}
a {
  color: inherit;
}
button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}
input[type='radio'],
input[type='checkbox'] {
  accent-color: var(--admin-text);
}
::selection {
  background: var(--admin-selection);
}

:focus-visible {
  outline: 2px solid var(--admin-focus);
  outline-offset: 2px;
}

/* Utility classes, kept global and tiny on purpose. */
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
.tabular {
  font-variant-numeric: tabular-nums;
}
.mono {
  font-family: var(--admin-font-mono);
  font-size: 0.92em; /* Roboto Mono reads larger and wider; optically match the sans */
}
```

**Phase 1 ships light-only.** Add one temporary line, `:root { color-scheme: light; }`, at the end of the `:root` block. Every token resolves to its light value until PR 3 removes that pin, together with the toggle (§5). Otherwise anyone whose OS is in dark mode would see dark tokens on components that haven't been migrated or checked yet (for example, literal `#fff` values still in module CSS).

**Acceptance (Phase 1):** every screen looks the same or slightly crisper. Muted text moves from `#4d4d4d` to `#666`, and input borders get stronger. `npm run lint && npm run typecheck && npm test && npm run format:check` pass.

### 2.4 Bug fixes bundled with Phase 1 (from research §7)

**a) Hidden resources show nothing (research §7.1).** Move the variant into the primitives file, where `.rowTitle` actually lives, and delete the dead rules.

```css
/* components/admin/controls.module.css */
.row[data-hidden] {
  background: var(--admin-surface-subtle);
  border-style: dashed;
}
.row[data-hidden] .rowTitle {
  color: var(--admin-text-secondary);
  text-decoration: line-through;
  text-decoration-color: var(--admin-border-hover);
}
```

```diff
/* components/admin/ClientForm.module.css */
-.section > .legend {
-  margin: 0;
-}
-
-.row[data-hidden] .rowTitle {
-  color: var(--admin-muted);
-  text-decoration: line-through;
-}
```

**b) `https://www.` corrupts subdomain URLs (research §7.2).** Prefix only the scheme.

```ts
// components/admin/ResourceFields.tsx
const URL_PREFIX = 'https://'

const prefixed = !draft.url || draft.url.startsWith(URL_PREFIX)
const changeUrl = (typed: string) => {
  const trimmed = typed.trimStart()
  // A typed or pasted scheme wins; otherwise we supply https://
  const value = prefixed && !/^https?:\/\//i.test(trimmed) ? URL_PREFIX + trimmed : trimmed
  onChange((d) => ({...d, url: value === URL_PREFIX ? '' : value}))
}
```

Existing `https://www.example.com` values display as `www.example.com` after the prefix, so stored data needs no migration.

**c) Invisible focus on client sign-in screens (research §7.3).** See §6.1.

### 2.5 Concentric geometry: the rule, and an audit of the manual overrides

The owner adopted the concentric principle and asked that their manual overrides be undone wherever they conflict with it. Here is the rule, followed by every hand-tuned value currently in the CSS (from `291af01`, `cd6a4c8`, and `4e036ac`), each with what happens to it.

**The rule.** When a rounded shape sits inside another rounded shape with a gap of **8px or less**, then **outer radius = inner radius + gap**, exactly. With a larger gap, the shapes read as independent, and each uses its own token. Two exemptions: **pills and circles** (`--radius-full`) are concentric with anything, and **text-like chips** (`<kbd>`, inline badges) are treated as type, not containers.

| Nesting                                        | Inner                 | Gap               | Outer                          | Status                       |
| ---------------------------------------------- | --------------------- | ----------------- | ------------------------------ | ---------------------------- |
| Segmented control: segment in its track        | 4 (`--radius-inner`)  | 2                 | 6 (`--radius-control`)         | Exact                        |
| Save bar: Save button in the floating bar      | 6                     | 6                 | 12 (`--radius-card`)           | Exact (bar padding set to 6) |
| Input group: affix inside the field            | (clipped)             | 0                 | 6                              | Exact: `overflow: hidden` clips the affix to the field's corners |
| Card and dialog footers                        | (clipped)             | 0 (+1px border)   | 12                             | Exact: footer radius = `calc(var(--radius-card) - 1px)` |
| Rows inside a category card                    | 6                     | 24 (body padding) | 12                             | Independent (gap > 8)        |
| Google button inside the login card            | 6                     | 32                | 12                             | Independent                  |
| Avatar, role badge, client initials            | full                  | any               | any                            | Exempt (pill or circle)      |
| `<kbd>` hint inside the search field           | 4                     | 6                 | 6                              | Exempt (text-like chip)      |
| Drag handle inside a row                       | none (no fill on hover) | 6               | 6                              | Resolved by not drawing a shape (see audit #4) |

**Audit of current manual overrides**

| #  | Where (today)                                                                                                         | What it does                                                         | Decision                                                                                                                                                                                                                                                       |
| -- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `panel.module.css .roleBadge`: fill = border color, a same-color 1px border, `padding: 0px 6px`, `border-radius: 100px`, `font-size: 13px`, `margin-left: -6px` | A pill tucked 6px closer to the name than the bar's 12px gap         | **Undo.** Use `controls.badge` (pill, 20px tall, 12px/500, no redundant border). Replace the negative margin with structure: wrap name + badge in `<span className={styles.identity}>` with `gap: 6px`, so the spacing is intentional, not a correction. |
| 2  | `AdminNav .link`: literal `padding: 0px 12px; height: 32px; border-radius: 6px; font-size: 14px`                      | Pill-shaped nav tabs                                                 | **Keep the look, tokenize it:** `var(--admin-space-3)`, `var(--control-md)`, `var(--radius-control)`, `var(--text-14)`. A tab sits directly in the bar (no wrapper), so it's independent.                                                                     |
| 3  | `AdminNav .brand`: 14px/600/18px text "Vydia Onboarding"                                                              | Text-only brand                                                      | **Replace** with the wordmark lockup (§4.1). The 14/600 weight is reused for "Onboarding".                                                                                                                                                                      |
| 4  | `SortableResourceList .handle`: `padding: 0px; margin: 0px -6px`, hover fill `--admin-bg`                            | Pulls the grip glyph 6px left so it lines up with the card's text edge (**optical alignment**); the hover fill is nearly invisible | **Keep the intent, formalize it:** `margin-inline: calc((var(--control-sm) - var(--icon-md)) / -2)` (= −6px) aligns the 16px icon, not its 28px hit box, with the edge. **Drop the hover fill.** Hover only darkens the icon. A filled square 6px from the row edge would break the rule (it would need radius 0), and an icon-only hover is more Apple-like anyway. |
| 5  | `SortableResourceList .group`: card padding 12, radius 6, rows radius 6                                              | Category card hugging its rows                                       | **Undo.** It becomes a `.surface` (radius 12) with a 24px body. The gap is > 8, so they're independent, matching every other card.                                                                                                                              |
| 6  | `ClientTable .copy { text-align: right !important }`                                                                  | Right-aligns the actions column; `!important` beats `.table td`      | **Undo the `!important`.** Rename to `.actionsCell` and raise specificity instead: `.table td.actionsCell { text-align: right; }`.                                                                                                                              |
| 7  | `ClientTable .scopes button { transition: none }` + inverted `[aria-pressed]` (also forced on `:hover`)               | Black pressed toggles that don't flicker on hover                    | **Undo.** Replaced by `controls.segmented` (§3.3), whose transitions are designed in. The flicker workaround is no longer needed.                                                                                                                               |
| 8  | `admin.css` `--admin-bg: hsla(0,0%,98%,1)`, `--admin-border: hsla(0,0%,92%,1)`                                      | The same colors as #fafafa / #ebebeb, in HSLA notation               | **Keep the values.** They're now `--gray-50` / `--gray-200` (identical colors), so nothing visibly changes.                                                                                                                                                     |
| 9  | `login.module.css`: card radius 6, `.google` 40px tall / 500                                                          | Flat login card                                                      | **Undo the card radius** (→ 12, dialog material, §4.2). **Keep** the 40px button (`--control-lg`) and the 500 weight.                                                                                                                                         |
| 10 | `panel.module.css .bar { min-height: 56px }`, `.name { max-width: 220px }`                                            | Bar height and name truncation                                       | **Keep** as-is. They're layout, not geometry.                                                                                                                                                                                                                   |
| 11 | `CopyLinkButton.module.css .field { min-width: 260px }`                                                               | Clipboard-fallback input width                                       | **Keep.**                                                                                                                                                                                                                                                       |
| 12 | `EnterEmail.module.css .resend { font-size: 14px !important; font-weight: 500 !important }`                          | Smaller resend button than Continue; `!important` beats `.form button` | **Undo the `!important`** (client site, §6.2). Use `.form .resend { font-size: 14px; font-weight: 500; }`. Two classes outrank `.form button` (a class plus an element) regardless of order. The look is unchanged.                                  |
| 13 | `EnterEmail.module.css .sent { margin-bottom: 4px }`                                                                  | Tightens "Email sent" toward the resend button                       | **Keep.** It's a deliberate optical adjustment on the client site, which this plan only polishes.                                                                                                                                                               |

---

## 3. Primitives (Phase 2): `components/admin/controls.module.css` ✅ Completed

The existing class names stay (`field`, `label`, `hint`, `input`, `error`, `notice`, `success`, `button`, `primary`, `danger`, `card`, `legend`, `rows`, `row`, `rowTitle`, `rowActions`), so every current call site keeps working. New classes are additive.

### 3.1 Fields and inputs

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
  min-width: 0;
}
.label {
  font-size: var(--text-14);
  line-height: var(--leading-14);
  font-weight: 500;
}
.hint {
  color: var(--admin-text-secondary);
}
.description {
  color: var(--admin-text-secondary);
  font-size: var(--text-13);
  line-height: var(--leading-13);
}

.input {
  width: 100%;
  min-height: var(--control-md);
  padding: 0 var(--admin-space-3);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-input);
  border-radius: var(--radius-control);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.input::placeholder {
  color: var(--admin-text-placeholder);
}
.input:hover:not(:disabled, :focus-visible) {
  border-color: var(--admin-border-hover);
}
.input:focus-visible {
  outline: none;
  border-color: var(--admin-focus);
  box-shadow: var(--ring-input);
}
.input[aria-invalid='true'] {
  border-color: var(--admin-danger);
}
.input[aria-invalid='true']:focus-visible {
  box-shadow: var(--ring-danger);
}
select.input {
  appearance: none;
  padding-right: 32px;
  background: var(--admin-surface) var(--icon-chevron) no-repeat right 10px center / 14px;
}
@media (forced-colors: active) {
  .input:focus-visible {
    outline: 2px solid CanvasText;
  }
}

/* Prefix/suffix fields: "welcometovydia.com/ [slug]" and "https:// [url]". */
.inputGroup {
  display: flex;
  align-items: stretch;
  min-height: var(--control-md);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-input);
  border-radius: var(--radius-control);
  overflow: hidden;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.inputGroup:hover:not(:focus-within) {
  border-color: var(--admin-border-hover);
}
.inputGroup:focus-within {
  border-color: var(--admin-focus);
  box-shadow: var(--ring-input);
}
.inputGroup:has([aria-invalid='true']) {
  border-color: var(--admin-danger);
}
.affix {
  display: flex;
  align-items: center;
  padding: 0 var(--admin-space-3);
  color: var(--admin-text-secondary);
  background: var(--admin-surface-subtle);
  border-right: 1px solid var(--admin-border);
  font-family: var(--admin-font-mono);
  font-size: var(--text-13);
  white-space: nowrap;
  user-select: none;
}
.inputGroup > input {
  flex: 1;
  min-width: 0;
  padding: 0 var(--admin-space-3);
  background: transparent;
  border: 0;
}
.inputGroup > input:focus-visible {
  outline: none; /* the group draws the ring */
}

/* Native file input, styled. The button matches .button; the file name reads as data. */
.file {
  color: var(--admin-text-secondary);
  font-size: var(--text-13);
}
.file::file-selector-button {
  margin-right: var(--admin-space-3);
  min-height: var(--control-md);
  padding: 0 var(--admin-space-3);
  color: var(--admin-text);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-input);
  border-radius: var(--radius-control);
  font: 500 var(--text-14) / 1 var(--admin-font);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}
.file:hover::file-selector-button {
  background: var(--admin-hover);
}
```

### 3.2 Buttons

```css
.button {
  --button-bg: var(--admin-surface);
  --button-fg: var(--admin-text);
  --button-border: var(--admin-border-input);
  --button-hover: var(--admin-hover);

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--admin-space-2);
  min-height: var(--control-md);
  padding: 0 var(--admin-space-3);
  color: var(--button-fg);
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-xs);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.button:hover:not(:disabled) {
  background: var(--button-hover);
}
.button:active:not(:disabled) {
  transform: scale(0.98);
}
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.button[data-loading] {
  opacity: 1;
  cursor: progress;
}
.button > svg {
  flex: none;
}

.primary {
  --button-bg: var(--admin-accent);
  --button-fg: var(--admin-accent-text);
  --button-border: var(--admin-accent);
  --button-hover: var(--admin-accent-hover);
}
.danger {
  --button-fg: var(--admin-danger);
  --button-hover: var(--admin-danger-bg);
}
/* Filled red: only for the confirm button of a destructive dialog. The same red in both
   themes (white on #c52828 = 5.66:1); the lighter dark-theme --admin-danger would fail with white text. */
.destructive {
  --button-bg: var(--admin-danger-solid);
  --button-fg: var(--admin-on-solid);
  --button-border: var(--admin-danger-solid);
  --button-hover: var(--admin-danger-solid-hover);
}
.ghost {
  --button-bg: transparent;
  --button-border: transparent;
  box-shadow: none;
}
.sm {
  min-height: var(--control-sm);
  padding: 0 var(--admin-space-2);
  font-size: var(--text-13);
}
.lg {
  min-height: var(--control-lg);
  padding: 0 var(--admin-space-4);
}
.iconOnly {
  width: var(--control-md);
  padding: 0;
}

.spin {
  animation: spin 700ms linear infinite;
}
@keyframes spin {
  to {
    rotate: 360deg;
  }
}
```

Loading pattern (no new component needed, and the label width stays stable):

```tsx
import {LoaderCircle} from 'lucide-react'
import {cx} from '@/lib/cx'

<button
  className={cx(controls.button, controls.primary)}
  data-loading={saving || undefined}
  disabled={saving || uploading}
>
  {saving && <LoaderCircle aria-hidden size={14} className={controls.spin} />}
  {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
</button>
```

> Standardize on `cx()` from `lib/cx.ts` in the admin too, instead of template strings.

### 3.3 Segmented control (Apple-style), replacing inverted toggles and bare radios

It fixes "pressed toggle looks like a primary CTA" (research §7.5.6) and the unstyled native radios (§7.5.9). It works with either `<button aria-pressed>` or `<label><input type=radio>`.

```css
.segmented {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  background: var(--admin-hover);
  border-radius: var(--radius-control);
}
.segmented > button,
.segmented > label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--admin-space-2);
  min-height: var(--control-sm);
  padding: 0 var(--admin-space-3);
  color: var(--admin-text-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-inner);
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.segmented > :hover {
  color: var(--admin-text);
}
.segmented > button[aria-pressed='true'],
.segmented > label:has(input:checked) {
  color: var(--admin-text);
  background: var(--admin-raised); /* white on the gray track; #222 on the #1a1a1a track in dark */
  box-shadow:
    0 0 0 1px var(--admin-border),
    var(--shadow-xs);
}
.segmented > label > input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.segmented > label:has(input:focus-visible) {
  outline: 2px solid var(--admin-focus);
  outline-offset: 2px;
}
```

### 3.4 Surfaces, messages, and small parts

```css
/* Legacy padded card. Unchanged API, new material. */
.card {
  padding: var(--admin-space-5);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

/* Structured card: header / body / footer (the "settings card"). */
.surface {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.surfaceHeader {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-1);
  padding: var(--admin-space-5) var(--admin-space-5) 0;
}
.surfaceTitle,
.legend {
  margin: 0;
  padding: 0;
  font-size: var(--text-16);
  line-height: var(--leading-16);
  font-weight: 600;
  letter-spacing: var(--tracking-snug);
}
.surfaceBody {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-5);
  padding: var(--admin-space-5);
}
.surfaceFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-3);
  padding: var(--admin-space-3) var(--admin-space-5);
  color: var(--admin-text-secondary);
  background: var(--admin-surface-subtle);
  border-top: 1px solid var(--admin-border);
  border-radius: 0 0 calc(var(--radius-card) - 1px) calc(var(--radius-card) - 1px);
  font-size: var(--text-13);
}

/* Messages. The default tone stays "error" for back-compat; add data-tone for others. */
.notice {
  --notice-fg: var(--admin-danger);
  --notice-bg: var(--admin-danger-bg);
  display: flex;
  align-items: flex-start;
  gap: var(--admin-space-2);
  padding: var(--admin-space-3) var(--admin-space-4);
  color: var(--notice-fg);
  background: var(--notice-bg);
  border-radius: var(--radius-control);
  font-weight: 500;
}
.notice > svg {
  flex: none;
  margin-top: 2px;
}
.notice[data-tone='info'] {
  --notice-fg: var(--admin-info);
  --notice-bg: var(--admin-info-bg);
}
.notice[data-tone='warning'] {
  --notice-fg: var(--admin-warning);
  --notice-bg: var(--admin-warning-bg);
}
.notice[data-tone='success'] {
  --notice-fg: var(--admin-success);
  --notice-bg: var(--admin-success-bg);
}
.error {
  color: var(--admin-danger);
  font-weight: 500;
}
.warning {
  color: var(--admin-warning);
  font-weight: 500;
}
.success {
  color: var(--admin-success);
  font-weight: 500;
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 var(--admin-space-2);
  color: var(--admin-text-secondary);
  background: var(--admin-hover);
  border-radius: var(--radius-full);
  font-size: var(--text-12);
  font-weight: 500;
  white-space: nowrap;
}

.kbd {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  color: var(--admin-text-secondary);
  background: var(--admin-raised);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-inner); /* text-like chip: exempt from the concentric rule (§2.5) */
  box-shadow: 0 1px 0 var(--admin-border);
  font: 500 var(--text-12) / 1 var(--admin-font-mono);
}

.skeleton {
  border-radius: var(--radius-control);
  background: linear-gradient(90deg, var(--admin-hover), var(--admin-active), var(--admin-hover)) 0 0 / 200% 100%;
  animation: shimmer 1.4s var(--ease-in-out) infinite;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}

/* One row pattern for every list. */
.rows {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  min-height: 48px;
  padding: var(--admin-space-2) var(--admin-space-2) var(--admin-space-2) var(--admin-space-3);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-control);
  transition:
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}
.rowTitle {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rowActions {
  display: flex;
  gap: var(--admin-space-1);
}
/* + the data-hidden variant from §2.4a */
```

### 3.5 Icons

Use `lucide-react` everywhere, at 14–16px with `strokeWidth={2}`, `aria-hidden`, and colored by `currentColor`. All of these names are verified to exist in the installed version:

| Where                             | Icon                                    |
| --------------------------------- | --------------------------------------- |
| Drag handles (replaces `⠿`)       | `GripVertical`                          |
| Open page (replaces inline SVG)   | `ExternalLink`                          |
| Copy link → copied                | `Copy` → `Check`                        |
| New client / resource / Add email | `Plus`                                  |
| Search affix                      | `Search`                                |
| Delete                            | `Trash2`                                |
| Hide / restore resource           | `EyeOff` / `Eye`                        |
| Busy                              | `LoaderCircle` + `.spin`                |
| Notices                           | `CircleAlert`, `Info`, `TriangleAlert`, `CircleCheck` |
| Type segments                     | `FileText`, `Video`, `Link`, `Presentation` |
| Empty states                      | `Users`, `Layers`, `Inbox`              |
| Sign out                          | `LogOut`                                |

```tsx
// components/admin/OpenLinkButton.tsx
import {ExternalLink} from 'lucide-react'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'

export function OpenLinkButton({slug}: {slug: string}) {
  return (
    <a href={`/${slug}`} target="_blank" rel="noopener" className={cx(controls.button, controls.sm)}>
      Open
      <ExternalLink aria-hidden size={14} strokeWidth={2} />
    </a>
  )
}
```

### 3.6 Dialog motion: shared `components/admin/dialog.module.css`

Both dialogs import one stylesheet, which fixes the duplicated values and the size mismatch (research §7.5.3). Native `<dialog>` + `@starting-style` + `transition-behavior: allow-discrete` animate entry *and* exit with no JavaScript.

```css
.dialog {
  width: min(var(--dialog-width, 440px), calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  padding: 0;
  color: var(--admin-text);
  background: var(--admin-surface);
  border: 0;
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-modal);
  opacity: 1;
  translate: 0 0;
  scale: 1;
  transition:
    opacity var(--duration-slow) var(--ease-out),
    translate var(--duration-slow) var(--ease-out),
    scale var(--duration-slow) var(--ease-out),
    overlay var(--duration-slow) allow-discrete,
    display var(--duration-slow) allow-discrete;
}
.dialog:not([open]) {
  opacity: 0;
  translate: 0 8px;
  scale: 0.98;
}
@starting-style {
  .dialog[open] {
    opacity: 0;
    translate: 0 8px;
    scale: 0.98;
  }
}
.dialog::backdrop {
  background: rgb(0 0 0 / 0);
  transition:
    background-color var(--duration-slow) var(--ease-out),
    overlay var(--duration-slow) allow-discrete,
    display var(--duration-slow) allow-discrete;
}
.dialog[open]::backdrop {
  background: var(--admin-backdrop);
}
@starting-style {
  .dialog[open]::backdrop {
    background: rgb(0 0 0 / 0);
  }
}

.wide {
  --dialog-width: 640px;
}
.header {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-1);
  padding: var(--admin-space-5) var(--admin-space-5) 0;
}
.title {
  font-size: var(--text-16);
  line-height: var(--leading-16);
  font-weight: 600;
  letter-spacing: var(--tracking-snug);
}
.body {
  padding: var(--admin-space-4) var(--admin-space-5) var(--admin-space-5);
  color: var(--admin-text-secondary);
}
.footer {
  position: sticky; /* long resource forms keep Save in reach */
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: var(--admin-space-2);
  padding: var(--admin-space-3) var(--admin-space-5);
  background: var(--admin-surface-subtle);
  border-top: 1px solid var(--admin-border);
}
```

Notes:

- `ConfirmDialog` stays mounted, so it animates both ways. `ResourceDialog` unmounts in `onClose` (`setEditing(null)`), so it animates in only. That's acceptable. Keeping it mounted to animate out isn't worth the state complexity.
- Destructive confirms use `controls.destructive` (filled red). Neutral confirms use `primary`.
- `ResourceDialog` gets `className={cx(dialog.dialog, dialog.wide)}` and the sticky `footer`, which fixes "Save scrolls out of view" (research §3.6).

### 3.7 Toasts: `components/admin/Toaster.tsx`

Use these for confirmations that shouldn't move layout: Saved, Reassigned, Resource saved/deleted, Order saved. The `?saved=1` inline text goes away (research §7.5.15).

```tsx
'use client'
import {CircleAlert, CircleCheck} from 'lucide-react'
import {createContext, use, useCallback, useState} from 'react'
import styles from './Toaster.module.css'

type Tone = 'neutral' | 'success' | 'error'
type Toast = {id: number; message: string; tone: Tone}
type Push = (message: string, tone?: Tone) => void

const ToastContext = createContext<Push>(() => {})
export const useToast = () => use(ToastContext)

let nextId = 0

export function Toaster({children}: {children: React.ReactNode}) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback<Push>((message, tone = 'neutral') => {
    const id = ++nextId
    setToasts((list) => [...list.slice(-2), {id, message, tone}])
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 4000)
  }, [])

  return (
    <ToastContext value={push}>
      {children}
      {/* Always mounted, so screen readers hear additions. */}
      <ol className={styles.region} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <li key={toast.id} className={styles.toast} data-tone={toast.tone}>
            {toast.tone === 'success' && <CircleCheck aria-hidden size={16} />}
            {toast.tone === 'error' && <CircleAlert aria-hidden size={16} />}
            {toast.message}
          </li>
        ))}
      </ol>
    </ToastContext>
  )
}
```

```css
/* components/admin/Toaster.module.css */
.region {
  position: fixed;
  right: var(--admin-space-5);
  bottom: var(--admin-space-5);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--admin-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  min-height: 40px;
  padding: 0 var(--admin-space-4);
  color: var(--admin-accent-text);
  background: var(--admin-accent);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-float);
  font-weight: 500;
  pointer-events: auto;
  transition:
    opacity var(--duration-base) var(--ease-out),
    translate var(--duration-base) var(--ease-out);
}
@starting-style {
  .toast {
    opacity: 0;
    translate: 0 8px;
  }
}
.toast[data-tone='error'] {
  color: var(--admin-on-solid);
  background: var(--admin-danger-solid);
}
```

Mount it once in `app/(admin)/admin/(panel)/layout.tsx` around `<main>`. Then convert the saved flag into a toast and clean the URL:

```tsx
// components/admin/SavedToast.tsx
'use client'
import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useRef} from 'react'
import {useToast} from './Toaster'

export function SavedToast() {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const shown = useRef(false) // StrictMode runs effects twice in dev
  useEffect(() => {
    if (shown.current) return
    shown.current = true
    toast('Saved', 'success')
    router.replace(pathname, {scroll: false})
  }, [toast, router, pathname])
  return null
}
```

```tsx
// app/(admin)/admin/(panel)/clients/[id]/page.tsx: replace the inline <p role="status">Saved</p>
{saved && <SavedToast />}
```

Use it in the other places too: `AssignAdminSelect` → `toast('Reassigned to Erica', 'success')`, and reorder success → `toast('Order saved')`. Keep **inline** errors where they're tied to a field.

---

## 4. Admin screens (Phase 3) ✅ Completed

### 4.1 Shell: sticky translucent bar with the Vydia wordmark

```tsx
// components/admin/AdminNav.tsx (brand part)
<Link href="/admin" className={styles.brand} aria-label="Vydia Onboarding home">
  <span aria-hidden className={styles.wordmark} />
  <span aria-hidden className={styles.slash}>/</span>
  <span className={styles.product}>Onboarding</span>
</Link>
```

```css
/* components/admin/AdminNav.module.css */
.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--admin-space-2);
  text-decoration: none;
  font-weight: 600;
  letter-spacing: var(--tracking-snug);
}
/* The existing white SVG wordmark, recolored through a mask so it follows currentColor. */
.wordmark {
  width: 89px;
  height: 10px;
  background: currentColor;
  mask: url('/vydia-logo.svg') center / contain no-repeat;
}
.slash {
  color: var(--admin-border-input);
  font-weight: 300;
  font-size: 20px;
}
.link {
  display: flex;
  align-items: center;
  height: var(--control-md);
  padding: 0 var(--admin-space-3);
  color: var(--admin-text-secondary);
  border-radius: var(--radius-control);
  font-weight: 500;
  text-decoration: none;
  transition:
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}
.link:hover {
  color: var(--admin-text);
  background: var(--admin-hover);
}
.link[aria-current='page'] {
  color: var(--admin-text);
  background: var(--admin-selected);
}
```

```css
/* app/(admin)/admin/(panel)/panel.module.css */
.bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--admin-bg) var(--admin-frost), transparent);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--admin-border);
}
.shell {
  --admin-frost: 82%; /* §2.2: 100% under prefers-reduced-transparency */
  min-height: 100vh;
}
.me {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  min-width: 0;
}
/* Name + badge as one unit, so their tighter 6px gap is structure, not a negative margin (§2.5 audit #1). */
.identity {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.pageHeader {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--admin-space-4);
  margin-bottom: var(--admin-space-6);
}
.pageTitle {
  font-size: var(--text-24);
  line-height: var(--leading-24);
  font-weight: 600;
  letter-spacing: var(--tracking-tight);
}
.pageDescription {
  margin-top: var(--admin-space-1);
  color: var(--admin-text-secondary);
}
```

Delete `.roleBadge` (and its `-6px` margin, audit #1). The badge uses `controls.badge` directly.

The user cluster, in order: **theme toggle**, then avatar, then name + badge, then **Sign out**. The toggle sits immediately left of the profile picture, as the owner asked (component in §5.3). **Sign out** becomes a quieter `ghost sm` button with a `LogOut` icon, because it's a less important action.

```tsx
// app/(admin)/admin/(panel)/layout.tsx: the right-hand cluster
<div className={styles.me}>
  <ThemeToggle />
  {admin.avatar_url && (
    <Image src={admin.avatar_url} alt="" width={28} height={28} unoptimized
      referrerPolicy="no-referrer" className={styles.avatar} />
  )}
  <span className={styles.identity}>
    <span className={styles.name}>{name}</span>
    {isSuper && <span className={controls.badge}>Super admin</span>}
  </span>
  <form action="/admin/auth/signout" method="post">
    <button className={cx(controls.button, controls.ghost, controls.sm)}>
      <LogOut aria-hidden size={14} />
      Sign out
    </button>
  </form>
</div>
```

The whole panel is wrapped in `<Toaster>` (§3.7), so the cluster sits inside it. Users without a Google avatar still get the toggle, followed directly by their name.

Add `loading.tsx` and `error.tsx` to `app/(admin)/admin/(panel)/` (research §3.2). The error API in this Next version uses `retry()` and `error: unknown` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`):

```tsx
// app/(admin)/admin/(panel)/loading.tsx
import controls from '@/components/admin/controls.module.css'

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{display: 'grid', gap: 24}}>
      <div className={controls.skeleton} style={{width: 200, height: 32}} />
      <div className={controls.skeleton} style={{height: 56}} />
      <div className={controls.skeleton} style={{height: 320}} />
    </div>
  )
}
```

```tsx
// app/(admin)/admin/(panel)/error.tsx
'use client'
import {RotateCcw} from 'lucide-react'
import {useEffect} from 'react'
import controls from '@/components/admin/controls.module.css'
import {cx} from '@/lib/cx'

export default function PanelError({error, retry}: {error: unknown; retry: () => void}) {
  useEffect(() => console.error(error), [error])
  return (
    <div className={cx(controls.card)} role="alert" style={{display: 'grid', gap: 12, justifyItems: 'start'}}>
      <h1 style={{fontSize: 16, fontWeight: 600}}>This Page Didn’t Load</h1>
      <p className={controls.hint}>Nothing was changed. Check your connection and try again.</p>
      <button type="button" className={controls.button} onClick={retry}>
        <RotateCcw aria-hidden size={14} /> Try again
      </button>
    </div>
  )
}
```

> Pages export `instant = false`. A `loading.tsx` is just a Suspense boundary around the page, so it's compatible. Run `next build` to confirm, and don't remove `instant` as part of this work.

### 4.2 Admin login (`/admin/login`)

Make it look custom and still a single action: the wordmark, a one-line explanation, the official Google mark on a neutral button, and a quiet dot grid fading out behind the card.

```tsx
// app/(admin)/admin/login/page.tsx (render part; logic unchanged)
return (
  <main className={styles.page}>
    <div className={styles.card}>
      <span aria-hidden className={styles.wordmark} />
      <div className={styles.heading}>
        <h1 className={styles.title}>Sign In to Onboarding</h1>
        <p className={styles.lede}>Use your @vydia.com Google account.</p>
      </div>
      {message && (
        <p role="alert" className={controls.notice}>
          <CircleAlert aria-hidden size={16} />
          {message}
        </p>
      )}
      <form action={signInWithGoogle}>
        <button className={styles.google}>
          <GoogleMark />
          Sign in with Google
        </button>
      </form>
    </div>
    <p className={styles.footnote}>For Vydia label and creative services. Clients sign in from their own page.</p>
  </main>
)
```

The accessible name stays exactly **Sign in with Google** because the mark is `aria-hidden`, and `main` still has one button. Both e2e invariants hold. The button label is sentence case (it's a button, not a heading) and matches Google's own wording.

**No theme toggle on the login page.** `main` must contain exactly one button (`admin.spec.ts:16`). The page still renders in the right theme: the inline script in the admin root layout (§2.1) applies a saved choice, and otherwise the OS setting applies. In dark, the Google button follows the tokens (dark surface, light text, a visible border), which matches the dark variant in Google's sign-in branding guidance.

```tsx
// components/admin/GoogleMark.tsx: Google's standard multicolor "G"
export function GoogleMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
```

```css
/* app/(admin)/admin/login/login.module.css */
.page {
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--admin-space-5);
  min-height: 100dvh;
  padding: var(--admin-space-5);
}
.page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(var(--admin-grid-dot) 1px, transparent 1px);
  background-size: 20px 20px;
  mask-image: radial-gradient(ellipse 50% 45% at 50% 45%, #000 20%, transparent 75%);
  pointer-events: none;
}
.card {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-5);
  width: 100%;
  max-width: 380px;
  padding: var(--admin-space-6);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-float);
}
.wordmark {
  width: 107px;
  height: 12px;
  background: var(--admin-text);
  mask: url('/vydia-logo.svg') left center / contain no-repeat;
}
.heading {
  display: grid;
  gap: var(--admin-space-1);
}
.title {
  font-size: var(--text-20);
  line-height: var(--leading-20);
  font-weight: 600;
  letter-spacing: var(--tracking-snug);
}
.lede,
.footnote {
  color: var(--admin-text-secondary);
}
.footnote {
  font-size: var(--text-13);
}
.google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--admin-space-3);
  width: 100%;
  min-height: var(--control-lg);
  color: var(--admin-text);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-input);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-xs);
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.google:hover {
  background: var(--admin-hover);
}
.google:active {
  transform: scale(0.98);
}
```

> A white button with the multicolor G follows Google's sign-in branding guidance better than the current black button with no mark.

### 4.3 Clients index

- **Header:** title plus a one-line description ("Each client gets a private page and a list of emails that can open it.") and the **New client** button with a `Plus` icon.
- **Toolbar:** a search field as an `inputGroup` with a `Search` affix and a `/` `<kbd>` hint. **Mine / All / Unassigned** becomes a `.segmented` control. Show a result count ("12 clients") in secondary text, right-aligned.
- **Table:** a 40px header row on `--admin-surface-subtle` (13/500, secondary). Rows are 52px tall. Dates use `tabular`. Email is secondary and ellipsized. The whole row becomes clickable through a stretched link, while the action buttons stay on top.
- **Copy link** swaps `Copy` → `Check` and says "Copied". The clipboard fallback input stays as-is.
- **Empty states** get an icon, a title, a description, and the CTA.

```tsx
// components/admin/ClientTable.tsx: keyboard shortcut and toolbar
const search = useRef<HTMLInputElement>(null)

useEffect(() => {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
    event.preventDefault()
    search.current?.focus()
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [])

<div className={styles.tools}>
  <label className={cx(controls.inputGroup, styles.search)}>
    <span className={controls.affix} aria-hidden>
      <Search size={14} />
    </span>
    <input ref={search} type="search" value={query} aria-label="Search clients" placeholder="Search clients"
      onChange={(event) => setQuery(event.target.value)} />
    <kbd className={cx(controls.kbd, styles.slashHint)} aria-hidden>/</kbd>
  </label>
  {showOwner && (
    <div role="group" aria-label="Show clients" className={controls.segmented}>
      {SCOPES.map((option) => (
        <button key={option.value} type="button" aria-pressed={scope === option.value}
          onClick={() => setScope(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )}
  <p className={cx(controls.hint, styles.count)} aria-live="polite">
    {visible.length} {visible.length === 1 ? 'client' : 'clients'}
  </p>
</div>
```

```css
/* components/admin/ClientTable.module.css (additions) */
.slashHint {
  align-self: center;
  margin-right: var(--admin-space-2);
}
/* Scope through this module's own .search class. A bare `.inputGroup` here would be
   hashed per-file and never match (the same trap as research §7.1). */
.search:focus-within .slashHint {
  display: none;
}
.count {
  margin-left: auto;
}

.table th {
  height: 40px;
  padding: 0 var(--admin-space-4);
  color: var(--admin-text-secondary);
  background: var(--admin-surface-subtle);
  font-size: var(--text-13);
  font-weight: 500;
}
.table td {
  height: 52px;
  padding: 0 var(--admin-space-4);
}
.table tbody tr {
  position: relative; /* anchors the stretched link */
  transition: background-color var(--duration-fast) var(--ease-out);
}
.table tbody tr:hover {
  background: var(--admin-hover);
}
.name {
  font-weight: 500;
  text-decoration: none;
}
.name::after {
  content: ''; /* the whole row is the link… */
  position: absolute;
  inset: 0;
}
.name:focus-visible {
  outline: none;
}
.table tbody tr:has(.name:focus-visible) {
  outline: 2px solid var(--admin-focus);
  outline-offset: -2px;
}
.actions {
  position: relative; /* …except the buttons */
  z-index: 1;
}
.date {
  color: var(--admin-text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
```

> `position: relative` on `<tr>` works in current Chrome, Firefox, and Safari. Verify in the Safari row of the QA matrix (§8). If it misbehaves, drop `.name::after`, and the name link still works.

**Optional human touch:** a 24px initials avatar per client, with a hue derived from the slug, so a long list has visual anchors.

```tsx
// components/admin/ClientAvatar.tsx
const hue = (seed: string) => [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7)
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('')

export function ClientAvatar({name, slug}: {name: string; slug: string}) {
  const h = hue(slug)
  return (
    <span aria-hidden className={styles.avatar}
      // Pastel on light, deep tint on dark: light-dark() follows the active theme (§5).
      style={{
        background: `light-dark(hsl(${h} 70% 93%), hsl(${h} 35% 20%))`,
        color: `light-dark(hsl(${h} 45% 28%), hsl(${h} 70% 88%))`,
      }}>
      {initials(name)}
    </span>
  )
}
```

Measured across all 360 hues: the worst case is **5.53:1 in light** and **8.92:1 in dark**, both at hue 60 (yellow). Every client's initials pass WCAG AA (4.5:1) in both themes.

### 4.4 Client form: structured cards and a floating save bar

Layout changes:

1. Each section becomes a `.surface` with a header (title + one-line description) and a body. The descriptions bring back a *little* guidance after the hint-stripping in `291af01`. Keep each to one line, or skip them if you prefer the bare look.
2. **Link** uses an `inputGroup` with a mono `welcometovydia.com/` affix. The slug-change message becomes `.warning` (amber), not error red.
3. **Resources** rows get `data-hidden` styling (§2.4a), an `EyeOff`/`Eye` ghost button, and a "Hidden" badge when hidden.
4. **Save** moves into a sticky floating bar that knows whether you have unsaved changes and supports `⌘↵`.
5. **Assigned to** moves into its own small surface ("Owner") above Details, labelled "Saves immediately" so the different save model is explicit (research §4.1).

```tsx
// components/admin/ClientForm.tsx: additions
const payload = buildPayload()
// Sorting hidden ids makes Remove→Restore count as "no change".
const snapshot = JSON.stringify({...payload, hiddenResourceIds: [...payload.hiddenResourceIds].sort()})
const [baseline] = useState(snapshot)
const dirty = snapshot !== baseline

useEffect(() => {
  if (!dirty) return
  const warn = (event: BeforeUnloadEvent) => event.preventDefault()
  window.addEventListener('beforeunload', warn)
  return () => window.removeEventListener('beforeunload', warn)
}, [dirty])

<form
  className={styles.form}
  noValidate
  onSubmit={/* unchanged */}
  onKeyDown={(event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.requestSubmit() // goes through the same slug-change confirm
    }
  }}
>
  <section className={controls.surface} aria-labelledby="details-title">
    <header className={controls.surfaceHeader}>
      <h2 id="details-title" className={controls.surfaceTitle}>Details</h2>
      <p className={controls.description}>Who this page is for, where it lives, and who can open it.</p>
    </header>
    <div className={controls.surfaceBody}>
      {/* Name field unchanged */}
      <div className={controls.field}>
        <label htmlFor="client-slug" className={controls.label}>Link</label>
        <div className={controls.inputGroup}>
          <span className={controls.affix}>{siteHost}/</span>
          <input id="client-slug" value={slug} maxLength={60} spellCheck={false}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={errors.slug ? 'client-slug-error' : slugChanged ? 'client-slug-warning' : undefined}
            onChange={/* unchanged */} className="mono" />
        </div>
        {slugChanged && <p id="client-slug-warning" role="status" className={controls.warning}>The old link will stop working.</p>}
        {errors.slug && <p id="client-slug-error" role="alert" className={controls.error}>{errors.slug}</p>}
      </div>
      {/* … */}
    </div>
  </section>

  {/* … Resources, Client-Specific Resources … */}

  <div className={styles.saveBar} data-dirty={dirty || undefined}>
    <p className={styles.saveStatus}>
      {uploading ? 'Uploading files…' : dirty ? 'Unsaved changes' : isNew ? 'Fill in the details, then save.' : 'No changes'}
    </p>
    <span className={styles.shortcut} aria-hidden>
      <kbd className={controls.kbd}>⌘</kbd>
      <kbd className={controls.kbd}>↵</kbd>
    </span>
    <button className={cx(controls.button, controls.primary)} data-loading={saving || undefined}
      disabled={saving || uploading}>
      {saving && <LoaderCircle aria-hidden size={14} className={controls.spin} />}
      {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
    </button>
  </div>
</form>
```

Also add `aria-describedby` to the Name and Email fields in the same way, which closes research §4.2's gap.

```css
/* components/admin/ClientForm.module.css */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-5);
}
.saveBar {
  position: sticky;
  bottom: var(--admin-space-4);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  /* Concentric (§2.5): 6px button radius + 6px gap = the bar's 12px radius. */
  padding: 6px 6px 6px var(--admin-space-4);
  background: color-mix(in srgb, var(--admin-surface) var(--admin-frost), transparent);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  backdrop-filter: saturate(180%) blur(12px);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-float);
  transition: border-color var(--duration-base) var(--ease-out);
}
.saveStatus {
  flex: 1;
  color: var(--admin-text-secondary);
}
.saveBar[data-dirty] .saveStatus {
  color: var(--admin-text);
  font-weight: 500;
}
.saveBar[data-dirty] .saveStatus::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: var(--admin-space-2);
  vertical-align: middle;
  background: var(--admin-warning);
  border-radius: 50%;
}
.shortcut {
  display: inline-flex;
  gap: 2px;
}
```

> On Windows and Linux, render `Ctrl` instead of `⌘`. Detect it once with `navigator.userAgentData?.platform ?? navigator.platform` in an effect, defaulting to `⌘` for SSR.

### 4.5 Resource fields

- **Type** becomes a `.segmented` radio group showing `FileText PDF · Video Video · Link Link · Presentation Slides`, with labels from `typeLabel()`. When Link is selected, a `controls.description` underneath says "Pitch forms and external pages". `RESOURCE_TYPES` is untouched.
- **File / Cover** inputs get `className={controls.file}`. The current file is a row (`mono` file name + ghost **Remove file**). The cover thumbnail is 64px with `--radius-control`.
- **URL** uses an `inputGroup` with a mono `https://` affix (§2.4b).
- **Category** gets the chevron automatically through `select.input`.
- Upload status gets a `LoaderCircle` + "Uploading…". PDF-preview fallbacks use `data-tone="info"` with the `Info` icon instead of the red error notice (research §7.5.5).
- Inline-editor **Delete** on client-specific drafts stays without confirmation (nothing persists until Save), but becomes a ghost danger `iconOnly` button with `Trash2` and the existing `aria-label`.

```tsx
<fieldset className={styles.types}>
  <legend className={controls.label}>Type</legend>
  <div className={controls.segmented}>
    {RESOURCE_TYPES.map((option) => {
      const Icon = TYPE_ICONS[option.value]
      return (
        <label key={option.value}>
          <input type="radio" name={`${id}-type`} value={option.value}
            checked={draft.type === option.value} onChange={() => changeType(option.value)} />
          <Icon aria-hidden size={14} />
          {typeLabel(option.value)}
        </label>
      )
    })}
  </div>
  {draft.type === 'link' && <p className={controls.description}>Pitch forms and external pages</p>}
</fieldset>

// TYPE_ICONS = {pdf: FileText, video: Video, link: Link, slides: Presentation}
```

### 4.6 Core resources page

- Category groups become `.surface` cards: a header with `GripVertical` + the category name + a count `badge`, and a body with rows.
- Rows: the handle uses `GripVertical`, with `cursor: grab` and `grabbing` while dragging. Edit and Delete become `ghost sm` buttons, which cuts visual noise in long lists without hiding them.
- Dragging: `--shadow-drag` + `scale: 1.01` on the lifted item, and the gap it leaves gets a dashed placeholder outline.
- Reorder success shows the toast "Order saved". Failure keeps the existing notice copy ("…It has been put back.").

```css
/* components/admin/SortableResourceList.module.css (changes) */
.handle {
  display: inline-grid;
  place-items: center;
  width: var(--control-sm);
  height: var(--control-sm);
  /* Optical alignment (owner's original −6px, audit #4): line the 16px icon, not its 28px hit box,
     up with the text edge above it. */
  margin-inline: calc((var(--control-sm) - var(--icon-md)) / -2);
  padding: 0;
  color: var(--admin-icon);
  background: none;
  border: 0;
  cursor: grab;
  touch-action: none;
  transition: color var(--duration-fast) var(--ease-out);
}
/* No hover fill: a filled square 6px from the row edge would break the concentric rule (§2.5).
   The icon darkening is the feedback, and it fixes research §7.5.13's invisible hover. */
.handle:hover {
  color: var(--admin-text);
}
.handle:focus-visible {
  border-radius: var(--radius-inner); /* the focus ring is the only shape the handle ever draws */
}
.row[data-dragging],
.group[data-dragging] {
  position: relative;
  z-index: 2;
  scale: 1.01;
  box-shadow: var(--shadow-drag);
  cursor: grabbing;
}
```

### 4.7 Copy polish and the Title Case inventory

**Every heading in scope, and its final text.** Headings are Title Case (principle 6). Text that comes from data (client names, resource categories, resource titles) is shown exactly as entered and never re-cased.

| Surface | Heading (element)                                   | Now                                | Final                                   |
| ------- | --------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Admin   | Clients page title (super) `h1`                     | Clients                            | Clients                                 |
| Admin   | Clients page title (regular) `h1`                   | Your clients                       | **Your Clients**                        |
| Admin   | New client page `h1`                                | New client                         | **New Client**                          |
| Admin   | Client detail `h1`                                  | *(client name)*                    | *(client name, as entered)*             |
| Admin   | Resources page `h1` (both roles)                    | Resources                          | Resources                               |
| Admin   | Login `h1`                                          | Vydia Onboarding                   | **Sign In to Onboarding**               |
| Admin   | Panel error boundary `h1` (new)                     | n/a                                | **This Page Didn’t Load**               |
| Admin   | Client form card `h2`                               | Details                            | Details                                 |
| Admin   | Client form card `h2` (new, supers)                 | n/a                                | **Owner**                               |
| Admin   | Client form card `h2`                               | Resources                          | Resources                               |
| Admin   | Client form card `h2`                               | Client-Specific Resources          | Client-Specific Resources (unchanged)   |
| Admin   | Category headings `h2`/`h3`                         | *(category)*                       | *(category, as entered)*                |
| Admin   | Resource dialog title                               | New resource / Edit resource       | **New Resource / Edit Resource**        |
| Admin   | Slug-change dialog title                            | Change this client’s link?         | **Change This Client’s Link?**          |
| Admin   | Delete dialog titles                                | Delete {name}? / Delete {title}?   | Delete {name}? / Delete {title}?        |
| Admin   | Empty state, super (render as `h2`, today a `<p>`)  | No clients yet                     | **No Clients Yet**                      |
| Admin   | Empty state, regular                                | No clients assigned to you yet     | **No Clients Assigned to You Yet**      |
| Admin   | Empty state, resources                              | No resources yet                   | **No Resources Yet**                    |
| Auth    | Expired notice `h1`                                 | This link has expired              | **This Link Has Expired** (e2e-safe, §0.2) |
| Auth    | Enter-email screen, visually hidden `h1`            | Enter your email                   | **Enter Your Email**                    |
| Auth    | Sent screen, visually hidden `h1`                   | Check your inbox                   | **Check Your Inbox**                    |
| Email   | Headline `h1`                                       | Open your Vydia Onboarding page    | **Welcome to Vydia** (owner's choice, §7.3) |

**Not headings, so they stay sentence case:** buttons (New client, Save, Sign in with Google, Copy link, Resend email), form labels and legends (Name, Link, Additional emails, Type), the **Super admin** badge, nav links, placeholders, toasts, inline messages ("Email sent, check your inbox", "No clients match “x”."), the theme toggle's label, and the email **subject**.

**Other copy changes**

| Where              | Now                         | Proposed                                                                               |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| Empty, super       | (title only)                | *Create one to get a private page and a link to send.* plus a [New client] button      |
| Empty, regular     | (title only)                | *Create one, or ask a super admin to assign you one.*                                  |
| Delete client body | This permanently deletes…   | (keep; it's already precise)                                                           |
| Save bar           | (n/a)                       | Unsaved changes / No changes / Fill in the details, then save.                         |
| Owner card         | label "Assigned to"         | Card **Owner**, description *Saves immediately. Only the owner and super admins can see this client.* The select keeps its "Assigned to" label. |

`docs/admin-guide.md` is updated to the new heading text in the Phase 7 cleanup.

---

## 5. Light and Dark Themes (Phase 3) ✅ Completed

The owner asked for dark mode to be **in scope, simple, and accessible, with the toggle next to the admin's profile picture**. It applies to the admin panel and the admin login. The client site is already dark and keeps its own design, and the email handles dark mode itself (§7).

### 5.1 How it works

- **Colors:** every semantic token is `light-dark(light, dark)` (§2.2). Which half applies is decided by `color-scheme` alone, so no component knows about themes.
- **Precedence:**
  1. `<html data-theme="light|dark">` (the admin's saved choice) sets `color-scheme` to that theme.
  2. With no attribute, `:root { color-scheme: light dark }` follows the OS.
- **Native controls:** scrollbars, the date picker, the file button, and select menus follow `color-scheme` automatically.
- **Persistence:** the choice is saved in `localStorage`, **not a cookie**. This Next version's guide (`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`, "Storing the theme in a cookie") warns that reading a cookie in a root layout under Cache Components "forces blocking every segment under the layout". A tiny inline script in `<head>` applies the saved choice before first paint instead, so there's no flash and no server read.
- **Returning to "follow my OS" without a third state:** if you toggle to the theme your OS already uses, the saved preference is cleared. The toggle stays two-state, and "system" is still reachable.

### 5.2 The no-flash script: `components/admin/theme.ts`

```ts
// Shared by the root layout (server) and the toggle (client). No React, no 'use client'.
export const THEME_KEY = 'vydia-admin-theme'
export type Theme = 'light' | 'dark'

// Runs synchronously in <head>, before first paint. Only a saved choice sets data-theme;
// otherwise CSS follows the OS. try/catch: localStorage can be unavailable (privacy modes).
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`
```

It's rendered in `app/(admin)/layout.tsx` (§2.1) with `suppressHydrationWarning` on `<html>`, exactly as the Next guide shows. The attribute persists across client-side navigations, so the script only needs to run on the initial document.

### 5.3 The toggle: `components/admin/ThemeToggle.tsx`

Design: a **28px circular icon button with a moon**, placed directly left of the 28px avatar so the two circles read as a pair. Its pressed (lit) look is drawn by CSS `light-dark()`, not by JavaScript, so it's correct on the very first paint, even before hydration.

```tsx
'use client'
import {Moon} from 'lucide-react'
import {useSyncExternalStore} from 'react'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import {THEME_KEY, type Theme} from './theme'
import styles from './ThemeToggle.module.css'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const systemTheme = (): Theme => (darkQuery().matches ? 'dark' : 'light')

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : systemTheme()
}

// Re-render when the attribute changes (this tab) or the OS theme flips.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']})
  const query = darkQuery()
  query.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    query.removeEventListener('change', onChange)
  }
}

function applyTheme(next: Theme) {
  const root = document.documentElement
  try {
    if (next === systemTheme()) {
      localStorage.removeItem(THEME_KEY) // matches the OS again, so follow it from now on
      delete root.dataset.theme
    } else {
      localStorage.setItem(THEME_KEY, next)
      root.dataset.theme = next
    }
  } catch {
    root.dataset.theme = next // storage blocked: still switch for this visit
  }
}

export function ThemeToggle() {
  // null on the server and during hydration; the real value right after.
  const theme = useSyncExternalStore(subscribe, readTheme, () => null)

  const toggle = () => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // A soft crossfade between themes where supported; an instant switch otherwise.
    if (!reduce && document.startViewTransition) document.startViewTransition(() => applyTheme(next))
    else applyTheme(next)
  }

  return (
    <button
      type="button"
      className={cx(controls.button, styles.toggle)}
      aria-label="Dark theme"
      aria-pressed={theme === null ? undefined : theme === 'dark'}
      title="Dark theme"
      onClick={toggle}
    >
      <Moon aria-hidden size={16} strokeWidth={2} />
    </button>
  )
}
```

```css
/* components/admin/ThemeToggle.module.css */
.toggle {
  width: var(--control-sm);
  min-height: var(--control-sm);
  padding: 0;
  border-color: transparent;
  border-radius: var(--radius-full); /* a circle, paired with the avatar beside it */
  box-shadow: none;
  /* "Lit" in dark, quiet in light. Correct before hydration because it's pure CSS. */
  color: light-dark(var(--admin-icon), var(--admin-text));
  background: light-dark(transparent, var(--admin-selected));
}
.toggle:hover:not(:disabled) {
  color: var(--admin-text);
  background: var(--admin-active);
}
```

```css
/* admin.css: the theme crossfade (only runs when startViewTransition is called above) */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--duration-base);
  animation-timing-function: var(--ease-out);
}
```

### 5.4 Accessibility

| Concern               | How it's met                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name and state        | The standard WAI-ARIA **toggle button**: a constant name, "Dark theme", plus `aria-pressed`. Screen readers announce "Dark theme, toggle button, pressed / not pressed", and the state change is announced on activation. The icon is `aria-hidden`. |
| Before hydration      | `aria-pressed` is omitted until the real value is known (`useSyncExternalStore` server snapshot is `null`), so assistive tech is never told the wrong state.                                                                                          |
| Pointer and keyboard  | It's a native `<button>`: Enter and Space work, and it's in the tab order right before the avatar and Sign out. The 28×28 target exceeds WCAG 2.2's 24×24 minimum (2.5.8). It has the global blue focus ring (7.56:1 on the dark surface). The `title` gives mouse users a tooltip. |
| Contrast              | Every token pair is checked in **both** themes (§2.2 comments). The lit toggle icon is `#ededed` on `#222` (13.6:1), and the quiet one is `#8f8f8f` on white (3.23:1, a non-text icon).                                                               |
| User settings         | The OS theme is the default. `prefers-reduced-motion` skips the crossfade. `prefers-contrast: more` strengthens borders and secondary text. `prefers-reduced-transparency` makes the frosted bars solid (§2.2). Forced-colors mode keeps native focus outlines (§3.1). |
| No flash              | The saved theme is applied in `<head>` before paint (§5.2), so there's never a light frame for dark-mode users.                                                                                                                                         |

### 5.5 Things that change appearance in dark

- **Wordmark:** it's a `mask` filled with `currentColor` (§4.1, §4.2), so it turns light automatically.
- **Login dot grid:** uses `--admin-grid-dot`.
- **Shadows:** they fade to near-nothing on cards and deepen on floating layers. In dark, depth comes from lighter surfaces (`#0a0a0a` page < `#111` card < `#222` raised).
- **Primary button:** inverts to a white button with black text. The **destructive** button stays the same red in both themes (§3.2), and so does the error toast.
- **Images** (avatars, cover thumbnails) are untouched. Thumbnails keep their 1px border, so white-background covers don't bleed into the dark surface.
- **Unchanged:** the client site and the email (its own dark mode, §7).

### 5.6 Tests

The admin panel can't be e2e-tested (Google sign-in), but the login page can, and it shares the root layout and tokens. Add these to `tests/e2e/a11y.spec.ts`, which already defines `expectNoViolations`:

```ts
test.describe('accessibility, admin login in dark mode', () => {
  test.use({colorScheme: 'dark'})

  test('admin login', async ({page}) => {
    await page.goto('/admin/login?error=no-access')
    await expectNoViolations(page)
  })
})

test('a saved admin theme is applied before paint', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('vydia-admin-theme', 'dark'))
  await page.goto('/admin/login')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
```

---

## 6. Client sign-in screens (Phase 4, light touch) ✅ Completed

These live in the **site** system (dark, Public Sans, pills), which the owner likes. Polish them without restyling. Every string and id in §0.2 stays.

### 6.1 Visible focus (fixes research §7.3)

```css
/* components/ui/controls.module.css */
.button:focus-visible,
.input:focus-visible,
.textButton:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.9); /* was --color-ink: 1.08:1 on the page */
  outline-offset: 3px;
}

.button {
  transition:
    background-color 120ms var(--switch-ease),
    opacity 200ms ease,
    transform 120ms var(--switch-ease);
}
.button:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.06); /* was identical to the resting color */
}
.primary:hover:not(:disabled) {
  background: #e5e5e5;
}
.button:active:not(:disabled) {
  transform: scale(0.98);
}
```

Apply the same white outline to `ResourceCard.module.css` `.card:focus-visible`. It's one line, on the resources page, and only affects keyboard focus.

### 6.2 Enter your email / Sent

```css
/* app/(site)/[slug]/EnterEmail.module.css (additions) */

/* States arrive instead of popping: the input → "Email sent" swap reads as one motion. */
.panel > :not(h1) {
  transition:
    opacity 280ms var(--switch-ease),
    translate 280ms var(--switch-ease);
}
@starting-style {
  .panel > :not(h1) {
    opacity: 0;
    translate: 0 6px;
  }
}

/* Replaces `.resend { font-size: 14px !important; font-weight: 500 !important }` (§2.5 audit #12).
   Two classes outrank `.form button`, so no !important is needed. The look is unchanged. */
.form .resend {
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums; /* the countdown must not jitter as digits change width */
}

.input:focus-visible {
  box-shadow:
    0 0 32px rgb(255 255 255 / 0.22),
    inset 0 0 24px rgb(255 255 255 / 0.12);
}

.panel .message {
  color: var(--color-danger-on-dark); /* token instead of the literal #ff7b7b */
}

@media (prefers-reduced-motion: reduce) {
  .panel > :not(h1) {
    transition: none;
  }
}
```

```css
/* app/(site)/globals.css: one new token */
--color-danger-on-dark: #ff7b7b; /* 6.94:1 on #1a1a1a */
```

**Headings to Title Case** (§4.7): the visually hidden `h1`s in `EnterEmail.tsx` become **Enter Your Email** and **Check Your Inbox**. Everything else stays exactly as tested: the placeholder, **Continue**, the status line "Email sent, check your inbox" (a paragraph, not a heading), `Resend email (Ns)`, `#enter-email-message`, and the not-approved message.

**Don't add links** (such as "Use a different email" as an `<a>`) inside `main` on `/`. If that feature is wanted later, it must be a `<button>`, and the e2e tests must be updated with it.

### 6.3 Link expired

`Notice` keeps its layout. Swap the border to `rgb(255 255 255 / 0.12)` (a hairline, not a bright `#e5e7eb` stroke on dark), and give the title `letter-spacing: -0.01em; text-wrap: balance`. The heading becomes **This Link Has Expired** (`app/(site)/auth/expired/page.tsx`). That still satisfies `getByRole('heading', {name: 'This link has expired'})`, because the match is case-insensitive (§0.2). The body copy and the **Send a new link** link are unchanged.

---

## 7. The magic-link email (Phase 5) ✅ Completed in the repo (Supabase paste is a manual step, see below)

### 7.1 Direction

The current email is a hybrid of site and Tailwind values with an Outlook-fragile button (research §5.4–5.6). The new one follows the Vercel transactional pattern: a white card on a soft canvas, a small dark wordmark top-left, one clear headline, one black button, a fallback link, and a quiet footer. It also adds:

- a **bulletproof** button (VML for Outlook desktop), a fixed-width Outlook table, and a hidden **preheader**;
- **dark mode** for clients that honor `prefers-color-scheme` (Apple Mail, iOS Mail, Outlook for Mac/iOS), which swaps in the existing white logo;
- styled **alt text**, so the brand still reads with images off;
- honest, human copy that keeps every safety message.

**Decided (§10):** the email is *light*, with a dark wordmark and its own dark mode. The headline is **Welcome to Vydia**.

### 7.2 New asset: dark wordmark PNG

Email clients block SVG, and the existing PNG is white. Generate an ink version from the same SVG. `sharp` already ships with Next (`next/package.json` lists `sharp ^0.35.5`). Add it as an explicit devDependency so the script doesn't rely on a transitive install.

```ts
// scripts/export-email-logo.ts  →  npm run email:logo
import {mkdir, readFile} from 'node:fs/promises'
import sharp from 'sharp'

const svg = await readFile('public/vydia-logo.svg', 'utf8')
const ink = svg.replaceAll('fill="white"', 'fill="#171717"')

await mkdir('public/email', {recursive: true})
await sharp(Buffer.from(ink), {density: 300})
  .resize({width: 568}) // 4× the 142px display width
  .png({compressionLevel: 9})
  .toFile('public/email/vydia-logo-ink.png')
console.log('Wrote public/email/vydia-logo-ink.png')
```

```jsonc
// package.json scripts
"email:logo": "tsx scripts/export-email-logo.ts",
"email:preview": "tsx --env-file-if-exists=.env.local scripts/preview-email.ts"
```

`proxy.ts` already skips `.png`, so `/email/vydia-logo-ink.png` is served without auth. **Keep `public/vydia-logo.png`.** The dark-mode variant uses it, and emails already sent reference it.

### 7.3 The template

Write it once as `supabase/templates/magic-link.html`, then copy it byte-for-byte to `confirm-signup.html` (a test enforces this, §7.4). Keep the href **exactly** as today, including the raw `&`.

```html
<!-- Subject: Open your Vydia Onboarding page -->
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>Open your Vydia Onboarding page</title>
    <!--[if mso]>
      <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
      /* Stop iOS and Gmail turning the address into a blue link mid-sentence. */
      a[x-apple-data-detectors], u + #body a { color: inherit !important; text-decoration: none !important; font: inherit !important; }
      .logo-on-dark { display: none; }
      @media (prefers-color-scheme: dark) {
        .canvas { background: #0a0a0a !important; }
        .card { background: #111111 !important; border-color: #262626 !important; }
        .ink { color: #ededed !important; }
        .soft { color: #a1a1a1 !important; }
        .rule { border-color: #262626 !important; }
        .btn { background: #ededed !important; color: #0a0a0a !important; }
        .logo-on-light { display: none !important; }
        .logo-on-dark { display: block !important; max-height: none !important; overflow: visible !important; }
      }
      @media (max-width: 520px) {
        .card-pad { padding: 32px 24px !important; }
      }
    </style>
  </head>
  <body id="body" class="canvas" style="margin:0;padding:0;background:#fafafa;">
    <!-- Preheader: the inbox preview line. The zero-width filler stops clients from pulling body text in after it. -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#fafafa;opacity:0;">
      One click and you’re in. This link works once and expires in 1 hour.
      &#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="canvas" bgcolor="#fafafa" style="background:#fafafa;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <!--[if mso]><table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" bgcolor="#ffffff"
            style="max-width:480px;background:#ffffff;border:1px solid #ebebeb;border-radius:12px;">
            <tr>
              <td class="card-pad" style="padding:40px;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <!-- Wordmark: ink for light, white for dark. Alt text is styled so it still reads with images off. -->
                <img class="logo-on-light" src="{{ .SiteURL }}/email/vydia-logo-ink.png" width="142" height="16" alt="VYDIA"
                  style="display:block;border:0;outline:none;height:16px;width:142px;color:#171717;font-size:16px;font-weight:700;letter-spacing:2px;" />
                <!--[if !mso]><!-->
                <div class="logo-on-dark" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
                  <img src="{{ .SiteURL }}/vydia-logo.png" width="142" height="16" alt="VYDIA"
                    style="display:block;border:0;height:16px;width:142px;color:#ededed;font-size:16px;font-weight:700;letter-spacing:2px;" />
                </div>
                <!--<![endif]-->

                <h1 class="ink" style="margin:32px 0 12px;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.02em;color:#171717;">
                  Welcome to Vydia
                </h1>
                <p class="soft" style="margin:0 0 8px;font-size:15px;line-height:24px;color:#4d4d4d;">
                  Here’s your link to your Vydia Onboarding page. Use the button below to open it as
                  <span class="ink" style="color:#171717;font-weight:500;">{{ .Email }}</span>.
                  For your security, it works once and expires in 1 hour.
                </p>
                <p class="soft" style="margin:0 0 28px;font-size:15px;line-height:24px;color:#4d4d4d;">
                  Open it in the browser you’ll come back with. You’ll stay signed in there.
                </p>

                <!-- Bulletproof button: VML for Outlook desktop, a real link everywhere else. -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <!--[if mso]>
                        <v:roundrect href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}"
                          style="height:44px;v-text-anchor:middle;width:180px;" arcsize="18%" stroke="f" fillcolor="#171717">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600;">Open my page</center>
                        </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-->
                      <a class="btn" href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}"
                        style="display:inline-block;padding:12px 24px;background:#171717;color:#ffffff;font-size:15px;line-height:20px;font-weight:600;text-decoration:none;border-radius:8px;">
                        Open my page
                      </a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>

                <p class="soft" style="margin:28px 0 0;font-size:13px;line-height:20px;color:#666666;">
                  Button not working? Paste this link into your browser:
                </p>
                <p style="margin:4px 0 0;font-size:13px;line-height:20px;word-break:break-all;">
                  <a class="soft" href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}"
                    style="color:#666666;text-decoration:underline;">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}</a>
                </p>

                <hr class="rule" style="margin:32px 0 24px;border:0;border-top:1px solid #ebebeb;" />

                <p class="soft" style="margin:0;font-size:13px;line-height:20px;color:#737373;">
                  If you didn’t ask for this link, you can safely ignore this email. Replies to this address aren’t
                  read. For help, contact your Vydia label services rep.
                </p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>
```

Copy decisions:

| Part      | Before                                       | After                                                    | Why                                                               |
| --------- | -------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| Subject   | Open your Vydia Onboarding page              | **unchanged**                                            | Referenced in config, the checklist, and the docs; still clear    |
| Preheader | (none, so the preview repeated the H1)       | One click and you’re in. This link works once and expires in 1 hour. | Adds information instead of repeating the subject       |
| H1        | Open your Vydia Onboarding page (= subject)  | **Welcome to Vydia** (owner's choice; Title Case)        | A greeting, not a repeat of the subject. Because both templates must be identical, returning clients see it too, and "welcome" reads fine on a repeat visit. |
| Body      | "Use this button… Open it in the browser you want to stay signed in on." | "Here’s your link to your Vydia Onboarding page. Use the button below to open it as {email}…", then the browser tip | Now that the headline is a greeting, the first sentence says what the email *is*. Keeps D19's browser guidance. |
| Button    | Open my page                                 | **unchanged**                                            | Already good                                                      |
| Fallback  | (none)                                       | Button not working? Paste this link…                     | Outlook, and copying to another browser                           |
| Footer    | If you didn’t ask for this link…             | + replies aren’t read, plus who to contact               | `welcome@onboarding.vydia.com` is send-only (launch checklist)    |

Contrast (light): H1 `#171717` 17.9:1 · body `#4d4d4d` 8.45:1 · fallback `#666` 5.74:1 · footer `#737373` 4.74:1 · button 17.9:1. Dark: text `#ededed` on `#111` 16.1:1 · soft `#a1a1a1` 7.3:1.

> Supabase renders these with Go templates. Keep the template variables exactly as written. Don't add `{{ if }}` logic or new variables without testing on the local stack first.

### 7.4 Guard rails: `tests/email-templates.test.ts`

```ts
import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const read = (name: string) => readFileSync(`supabase/templates/${name}.html`, 'utf8')
const magic = read('magic-link')
const confirm = read('confirm-signup')
const LINK = '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}'

describe('sign-in email templates', () => {
  it('are byte-identical (Supabase sends either one)', () => {
    expect(confirm).toBe(magic)
  })

  it('keep the subject on the first line', () => {
    expect(magic.split('\n')[0]).toBe('<!-- Subject: Open your Vydia Onboarding page -->')
  })

  it('link to our confirm route in the VML button, the button, and the fallback', () => {
    expect(magic.split(LINK).length - 1).toBeGreaterThanOrEqual(4) // VML href, <a> href, fallback href + text
    expect(magic).not.toContain('ConfirmationURL')
  })

  it('load images only from the site', () => {
    const sources = [...magic.matchAll(/src="([^"]+)"/g)].map((match) => match[1])
    expect(sources.length).toBeGreaterThan(0)
    for (const src of sources) expect(src.startsWith('{{ .SiteURL }}/')).toBe(true)
  })

  it('stay well under Gmail’s 102 KB clipping limit', () => {
    expect(Buffer.byteLength(magic)).toBeLessThan(30 * 1024)
  })
})
```

### 7.5 Preview without sending: `scripts/preview-email.ts`

```ts
import {mkdir, readFile, writeFile} from 'node:fs/promises'

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const vars: Record<string, string> = {
  '.SiteURL': site,
  '.Email': 'lil@example.com',
  '.TokenHash': 'preview-token',
  '.RedirectTo': `${site}/lil-example`,
}

const template = await readFile('supabase/templates/magic-link.html', 'utf8')
const html = template.replace(/\{\{\s*(\.\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '')
await mkdir('.email-preview', {recursive: true})
await writeFile('.email-preview/magic-link.html', html)
console.log('Open .email-preview/magic-link.html (images load from', site + ')')
```

Add `.email-preview/` to `.gitignore`. Run `npm run dev` alongside so the logo URLs resolve.

### 7.6 Ship it

1. `npm run email:logo` → commit `public/email/vydia-logo-ink.png`.
2. Write the template, `cp supabase/templates/magic-link.html supabase/templates/confirm-signup.html`, then `npm test`.
3. **Local:** `supabase stop && supabase start` (config isn't reloaded by `db reset`), sign in through `/<slug>`, and inspect the mail at `http://127.0.0.1:55324`. The local cap is `email_sent = 2` per hour.
4. **Deploy the app first.** The new logo must be live at `SITE_URL/email/vydia-logo-ink.png` before any email references it.
5. **Hosted:** Supabase → Authentication → Emails → Templates → **Magic Link** *and* **Confirm signup**: `pbcopy < supabase/templates/magic-link.html`, paste over everything, then Save (`docs/launch-checklist.md` Part 4.5).
6. Send to real inboxes and walk the QA matrix (§8).

---

## 8. QA and accessibility

**Automated, every PR:** `npm run lint && npm run typecheck && npm test && npm run format:check`, plus `npm run e2e` where the environment allows (it's the guard for §0.2).

**Contrast:** re-run this on any new color pair before merging.

```bash
node -e '
const L=h=>{h=h.replace("#","");const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const r=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2)};
console.log(r(process.argv[1],process.argv[2]))' "#666666" "#ffffff"
```

**Extend axe coverage:** the admin panel is untested because Google sign-in can't be automated. Add an admin storage state when the "test-only token mint" from iteration-two-plan §E lands. Until then, run the axe browser extension by hand on each admin screen.

**Manual matrix:**

| Surface                    | Chrome | Safari | Firefox | iOS Safari | Light | Dark | Keyboard only  | Reduced motion | Increased contrast | Forced colors |
| -------------------------- | ------ | ------ | ------- | ---------- | ----- | ---- | -------------- | -------------- | ------------------ | ------------- |
| Admin login                | ✓      | ✓      | ✓       | –          | ✓     | ✓    | ✓              | ✓              | ✓                  | ✓             |
| Shell + theme toggle       | ✓      | ✓      | ✓       | –          | ✓     | ✓    | ✓ (Space/Enter) | ✓ (no fade)   | ✓                  | ✓             |
| Clients (row link, `/`)    | ✓      | ✓ (tr) | ✓       | –          | ✓     | ✓    | ✓              | –              | ✓                  | ✓             |
| Client form (save bar, ⌘↵) | ✓      | ✓      | ✓       | –          | ✓     | ✓    | ✓              | ✓              | ✓                  | ✓             |
| Dialogs (enter/exit)       | ✓      | ✓      | ✓       | –          | ✓     | ✓    | ✓ (Esc)        | ✓              | ✓                  | ✓             |
| Sign-in / Sent / Expired   | ✓      | ✓      | ✓       | ✓          | –     | (site is dark) | ✓ (focus ring) | ✓          | –                  | –             |

**Theme-specific checks:**

- Reload in each theme: there's no flash of the other theme.
- Toggling to the OS's own theme clears the saved choice. Flip the OS setting afterwards: the admin follows.
- The toggle's lit state is correct before hydration (throttle the CPU in DevTools to see the pre-hydration frame).
- A destructive confirm and an error toast are the same red in both themes.
- The wordmark, the chevrons, and the date picker are all legible in dark.

**Email matrix:** Gmail (web, iOS, Android) · Apple Mail (macOS, iOS, light and dark) · Outlook (Windows desktop, Mac, outlook.com) · images-off view in Outlook · a corporate gateway if available (link scanners can consume the token; that behavior is unchanged and documented in D33). Check that the preheader appears, the button is clickable in Outlook desktop, the fallback link wraps, the alt text is legible, and dark mode swaps the logo.

---

## 9. Rollout

Each PR is shippable on its own and leaves the app working.

| PR | Contents                                                                                                                                  | Risk   | Done when                                                                                       | Status |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- | ------ |
| 1  | **Foundations + fixes:** theme-aware tokens v2 with aliases (the light pin was skipped, see §11), Roboto Mono, base layer, concentric radius tokens, hidden-row fix, URL prefix fix, site focus ring | Low    | Screens look the same or crisper. Hidden rows strike through. `docs.google.com` saves correctly. Dark mode ships with the toggle in the same pass. | ✅ Done |
| 2  | **Primitives:** controls v2, segmented, inputGroup, file, notice tones, badge, kbd, skeleton, icons, `dialog.module.css`, Toaster          | Low–med | Every existing call site renders correctly. Dialogs animate. Toasts announce.                    | ✅ Done |
| 3  | **Admin screens + themes:** shell (wordmark, identity group, **theme toggle next to the avatar**), login, clients index, client form (surfaces, save bar, ⌘↵, beforeunload), resource fields, resources page, loading/error. The §2.5 override audit is applied. Title Case headings (§4.7). **Remove the light pin.** Add the §5.6 tests. | Medium | Admin e2e and the new dark/no-flash tests pass. Every manual matrix row is green in **both** themes. | ✅ Done |
| 4  | **Client sign-in polish** (§6), including the Title Case headings and the `.resend` `!important` removal                                 | Low    | sign-in, access, and a11y e2e pass unchanged                                                    | ✅ Done |
| 5  | **Email:** logo asset, "Welcome to Vydia" template, tests, preview script. Then deploy and paste into Supabase (both templates).        | Medium (manual deploy step) | Email matrix is green. Old emails still show a logo.                                            | ✅ Done in repo; ⏳ manual Supabase deploy pending |
| 6  | *(optional)* Client initials avatars (later removed, §12.4)                                                                                                      | Low    | Contrast spot-checked in both themes                                                            | ✅ Done |
| 7  | **Cleanup:** delete the back-compat aliases (`--admin-muted`, `--admin-radius`), replace any remaining template-string classNames with `cx`, update `docs/admin-guide.md` (research §7.7, plus the new headings) and `research.md` | Low | `grep -r "admin-muted\|admin-radius" app components` returns nothing                            | ✅ Done |

---

## 10. Decision log (resolved 2026-11-11)

The owner's review notes, each with what changed in this document.

| # | Decision                              | Owner's call                                                                                                     | Outcome in this plan                                                                                                                                                       |
| - | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Card radius / geometry                | "I like your idea of the concentric, feel free to undo my manual overrides if it fits the principle you laid out" | Concentric is now a strict rule with exact values (principle 5 in §1, the §2.2 shape tokens, §2.5). Every manual override is audited in §2.5: 7 undone or tokenized, 1 replaced, 5 kept with a reason. The save bar padding and handle styling changed to satisfy the rule (§4.4, §4.6). |
| 2 | Input border strength                 | Approved as planned                                                                                              | `#c9c9c9` by default. Strict 3:1 (`#949494`) applies automatically under `prefers-contrast: more` (§2.2).                                                                  |
| 3 | Section descriptions                  | Approved as planned                                                                                              | One line per card (§4.4)                                                                                                                                                   |
| 4 | Email look                            | Approved as planned                                                                                              | Light card, ink wordmark, its own dark mode (§7)                                                                                                                           |
| 5 | Email headline                        | "Welcome to Vydia"                                                                                               | The H1 is **Welcome to Vydia**. The first body sentence now says what the email is (§7.3). The subject is unchanged.                                                       |
| 6 | Heading casing                        | "Headings should be Title Case"                                                                                  | Applies to **all** headings (principle 6, full inventory in §4.7). "Client-Specific Resources" stays. Non-headings stay sentence case. The e2e impact was checked and is none (§0.2). |
| 7 | Admin dark mode                       | "Incorporate, keep simple and accessible, put the toggle next to the admin profile pic"                          | In scope (§5). Theme-aware tokens via `light-dark()`, follows the OS by default, a one-button moon toggle left of the avatar, no-flash script, a full a11y table, and new tests. Shipped in PR 3. |
| 8 | Monospace                             | Approved, with Roboto Mono                                                                                       | Roboto Mono (§2.1). The export was verified in this Next version, and the `.mono` size was retuned for its width.                                                           |

## 11. Implementation Status (completed 2026-11-11)

All seven PRs' worth of work is implemented in the working tree (not committed). Verification run: `npm run typecheck`, `npm run lint`, `npx vitest run` (171 tests, including the new `tests/email-templates.test.ts`) and `next build` all pass. Screenshots confirmed the admin login in light and dark, the client Enter-your-email screen, and the email in light and dark.

**Deviations from the plan**

- **No temporary light pin (§2.4).** The pin only existed to protect half-migrated screens. Everything was migrated in one pass, so dark mode ships immediately with the toggle.
- **Phase 6** was the optional client initials avatars; dark mode itself shipped under Phase 3 as the plan specified.
- **The `.mono` utility** is applied via `className="mono"` on the slug and URL inputs and file names.
- **The Resources page** description paragraph for regular admins is unchanged.

**Not done, and why**

- **Playwright e2e could not run**: the suite needs a live Supabase backend (`global-setup` calls the Auth admin API), which wasn't available. The two new dark-mode tests in `tests/e2e/a11y.spec.ts` are written but unrun. Run `npm run e2e` where Supabase is reachable.
- **The admin panel screens were not visually checked after sign-in**, because Google sign-in can't be automated. Use the manual matrix in §8.
- **Email deploy (§7.6 steps 3–6) is manual:** deploy the app so `/email/vydia-logo-ink.png` is live, then paste `supabase/templates/magic-link.html` into both Supabase templates (Magic Link and Confirm signup), then check real inboxes.
- **`research.md` was not rewritten.** It describes the system as it was before this refresh.

## 12. Revision 3: Owner Critiques (completed 2026-11-11)

Seven critiques after reviewing the implementation. Each was researched, then implemented. **This revision supersedes earlier sections wherever they disagree** (the wordmark, the theme toggle's place, input borders, helper text, the email logo and body copy).

### 12.1 Research findings

- **`public/vydia-logo.svg` is now the 28×28 mark** (two ink-colored paths). Three things used the old wordmark file: the admin bar and login page (as a CSS mask, which works fine with the mark), `CardCover` (the client site's placeholder tile), and `scripts/export-email-logo.ts`. The tile would have shown a dark mark on a dark tile, at the wrong aspect ratio.
- The old wordmark was recovered from git as `public/vydia-wordmark.svg`, and `CardCover` now points at it. The client site looks exactly as before.
- **Favicon files** (`app/icon0.svg`, `icon1.png`, `apple-icon.png`, `favicon.ico`, and the two manifest PNGs) all held the old artwork. An ink mark disappears on a dark browser tab, so the SVG favicon carries its own `prefers-color-scheme` rule.
- **The mobile header** put the brand text, two nav links, the toggle, the avatar, the name, the badge, and Sign out in one row. That can't fit a 390px phone, and the nav links (32px) didn't match Sign out (28px).
- **Border tokens:** `--admin-border-input` was `#c9c9c9` against `--admin-border` `#ebebeb`. Buttons share that token, so they changed with the inputs.
- **Copy audit.** Removed text: login lede and footnote, Clients description, three card descriptions, the owner card, "Pitch forms and external pages", client count, `/` hint, `⌘↵` hint, "Hidden" badge, category count badges, empty-state helper lines, the read-only resources paragraph, and the email's browser tip and support line. Kept: field labels, errors, toasts, the **Super admin** badge, resource type labels, and status text only when it signals something ("Unsaved changes", "Uploading files…").

### 12.2 Decisions and what shipped

| # | Critique | Outcome |
| - | -------- | ------- |
| 1 | Use the new logo; no splash, just logo + "Onboarding" | Admin bar: the mark (24px, follows the theme color through a mask) then **Onboarding**, with the slash removed. Login: the mark above the title. |
| 2 | Header must work on mobile; profile picture opens a small menu | New `AccountMenu`: a 28px avatar button (an initial if there's no photo) opens a popover with the name, the **Super admin** badge, a **Dark theme** switch, and **Sign out**. It closes on outside click and Escape, returns focus to the avatar, and is a disclosure (`aria-expanded`, `aria-controls`). Under 520px the "Onboarding" text hides and the paddings tighten, so the mark, two links, and avatar always fit. |
| 3 | Clients and Resources buttons the size of Sign out | Nav links are `--control-sm` (28px) tall, 13px text, 8px padding, the same as the old Sign out button. |
| 4 | Input border same as other borders; `#C5C5C5` on hover | `--admin-border-input` = `--admin-border`. `--admin-border-hover` = `#c5c5c5` (light). Dark hover stays `#525252`, since `#c5c5c5` would glare on `#111`. Under **Increase Contrast** the stronger border still applies. **Tradeoff:** `#ebebeb` on white is about 1.2:1, below WCAG 1.4.11's 3:1 for field edges. Labels sit above every field and focus turns the border blue, so fields stay identifiable. |
| 5 | Use the logo as the favicon | `scripts/export-brand-assets.ts` (`npm run brand:assets`) writes all of them from `public/vydia-logo.svg`: the SVG favicon (dark-tab aware), `icon1.png`, `apple-icon.png`, a two-size `favicon.ico`, and the two manifest icons. |
| 6 | Keep it simple | Copy audit above. The email is now: mark, **Welcome to Vydia**, one sentence, the button, the fallback link, and one ignore line. |
| 7 | "Name" → "Account name" | The label on the new and edit client form. The validation message "Client name is required." is unchanged. |

**Email logo.** The email uses the mark: `public/email/vydia-mark-ink.png` (light) and `vydia-mark-white.png` (dark mode), both 112px shown at 28px. The old `vydia-logo-ink.png` is deleted. `public/vydia-logo.png` stays, because emails already sent reference it.

**Scripts.** `npm run email:logo` is replaced by `npm run brand:assets`.

### 12.3 Verification

`typecheck`, `lint`, and `next build` pass, and `prettier` is clean on the changed files. All 167 unit tests pass. `tests/schema-parity.test.ts` fails because `sanity/schema.json` was deleted from the working tree outside this work. Screenshots confirmed the login page, the email, and the favicon assets. **The signed-in header and account menu were not viewed live**, because Google sign-in can't be automated. Check them on a phone-width window.

### 12.4 Follow-up Fixes

- **Client photos removed.** The initials avatars next to client names in the Clients table (and their `ClientAvatar` component) are gone. Names are plain links again.
- **Account menu alignment.** Sign out and the Dark theme row are both left-aligned with an icon then label. The cause was CSS order: the shared button rule (`justify-content: center`) could load after each component's override and win. Both overrides now use a doubled class (`.item.item`, `.row.row`) so they win regardless of order.
