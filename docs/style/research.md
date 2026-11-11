# Admin Panel & Emails: UX, UI, and Design System Research

> Snapshot of branch `final-style` at `4e036ac` (2026-11-11). Everything here was read from the code, the git history, and the docs in `docs/`. File references are relative to the repo root. Contrast ratios were computed with the WCAG 2.x relative-luminance formula.

---

## 0. TL;DR

- **Three separate visual systems.** The repo has three: the **client site** (dark, Public Sans, white pill buttons, glassy blur header), the **admin panel** (light, flat, dense, neutral grays, 6px radius), and the **magic-link email** (a light card with a dark header band, built from a mix of site and Tailwind values). Each has its own tokens. Nothing is shared except the font family and a few literal hex values.
- **The admin's look is deliberate and recent.** Commit `291af01` ("changed styles") and `4e036ac` ("little styles") moved it from a softer look (8/12px radius, shadows, 15px type, 40px controls) to a flat, dense, Vercel/Geist-like neutral system: `#171717` / `#4d4d4d` / `hsla(0,0%,98%)` / `hsla(0,0%,92%)`, 6px radius, 14/20 type, 32px controls, no shadows except on dialogs.
- **The admin is built from one primitives file**, `components/admin/controls.module.css`: field, label, hint, input, error, notice, success, button (default / primary / danger), card, legend, and the row pattern. Every screen composes these.
- **There is one email.** The magic link ships as two byte-identical templates (`magic-link.html` and `confirm-signup.html`, because Supabase uses "Confirm signup" for first-time users). Humans send the Welcome link from their own inboxes, never the app.
- **Real defects found** (details in §7):
  1. The "Remove" action on a client's resource row no longer greys out or strikes through the row. A CSS Modules scoping regression from `291af01` broke it, so the only feedback left is the button label changing.
  2. The URL field's `https://www.` prefix produces broken links for subdomain hosts, e.g. typed `docs.google.com/forms/…` becomes `https://www.docs.google.com/forms/…`.
  3. On the client sign-in screens (the email flow), the keyboard focus ring is `#121212` on `#1a1a1a`, a 1.08:1 contrast, so it's effectively invisible.
  4. `docs/admin-guide.md` has drifted from the UI in about ten labels ("Send link" vs **Continue**, "Main resources", "Add exclusive resource", "Open page", and others).
  5. The email has no Outlook-safe button, no fallback plain URL, no preheader, and no styled alt text for the white-on-transparent logo.

---

## 1. Architecture context (what styling sits on)

| Concern         | Choice                                                                                                                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.4 (App Router, `cacheComponents`, `partialPrefetching`), React 19.3                                                                                                                                                                                                                              |
| Styling         | **CSS Modules + CSS custom properties.** There is no Tailwind (decision D12 in `docs/iteration-two-plan.md`) and no CSS-in-JS.                                                                                                                                                                              |
| Root layouts    | **Two**, `app/(site)/layout.tsx` and `app/(admin)/layout.tsx`. Each imports its own global stylesheet (`globals.css` / `admin.css`). Crossing between them is a full page load, so **admin CSS never leaks into client pages and vice versa**. Both define `:root` tokens with different prefixes (`--color-*`/`--space-*` vs `--admin-*`). |
| Font            | Public Sans via `next/font/google`, exposed as `--font-public-sans`, in both layouts                                                                                                                                                                                                                        |
| Icons           | `lucide-react` on the site. The admin uses one hand-inlined Lucide `external-link` SVG (`OpenLinkButton.tsx`) and the braille glyph `⠿` for drag handles.                                                                                                                                                  |
| Class merging   | `lib/cx.ts` on the site. The admin uses template strings (`` `${controls.button} ${controls.primary}` ``).                                                                                                                                                                                                 |
| State hooks     | `data-*` attributes for visual state (`data-hidden`, `data-dragging`, `data-ready`, `data-pending`, `data-current`) and ARIA attributes as styling hooks (`aria-current='page'`, `aria-pressed='true'`, `aria-invalid='true'`)                                                                             |
| Analytics       | `@vercel/analytics` and `speed-insights` in both layouts                                                                                                                                                                                                                                                    |
| Metadata        | Admin `<title>` is "Vydia Onboarding · Admin". Both layouts set `robots: noindex, nofollow`.                                                                                                                                                                                                                |

---

## 2. The admin design system

### 2.1 Design direction and how it got here

The admin is **desktop-first** by spec (`docs/iteration-two.md` → Constraints: "the admin panel is desktop-first"). It reads as a quiet, utilitarian, monochrome tool: near-black on white and off-white, hairline borders, no shadows on resting surfaces, and one accent (black). The only chromatic colors carry meaning: red for danger, green for success, blue for focus.

History, from `git log` on `admin.css` / `controls.module.css`:

| Commit    | Change                                                                                                                                                                                                                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `b90effb` | Admin shell created                                                                                                                                                                                                                                                                                                                            |
| `291af01` | **Big restyle.** Radius 8/12px → 6px. Removed `--admin-shadow` and `--admin-radius-lg`. Removed `--admin-border-strong` (`#c9c9ce`). Body 15px/1.5 → **14px/20px**. Controls 40px → **32px**. Labels 13/600 → 14/500. Buttons 600 → 500. Removed the `.small` button variant. Page title 26/700 → 24/600. Added `--admin-hover` / `--admin-selected`. Added `scrollbar-gutter: stable`. The client detail "Welcome link" card (visible URL in a `<code>` box) was replaced by header buttons. Removed hint/explainer copy under sections. |
| `cd6a4c8` | Super admin badge became a filled pill (13px). Pressed scope buttons stay inverted on hover.                                                                                                                                                                                                                                                   |
| `4e036ac` | `--admin-bg` `#fafafa` → `hsla(0,0%,98%,1)` and `--admin-border` `#ebebeb` → `hsla(0,0%,92%,1)`. Same colors, rewritten in HSLA notation (matching Vercel's Geist token notation).                                                                                                                                                         |

**Takeaway:** the owner trends toward density, flatness, fewer explanatory hints, and Geist-like neutrals. New admin work should follow that: no shadows on cards, 6px radius, 32px controls, 14px text, and no extra helper copy unless it's necessary.

### 2.2 Tokens (`app/(admin)/admin.css`)

#### Color

| Token                 | Value                          | Use count\* | Used for                                                     | Contrast                                                                     |
| --------------------- | ------------------------------ | ----------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `--admin-bg`          | `hsla(0,0%,98%,1)` (= #fafafa) | 3           | Page background, top bar, drag-handle hover                  | n/a                                                                          |
| `--admin-surface`     | `#ffffff`                      | 11          | Cards, inputs, buttons, rows, dialogs                        | n/a                                                                          |
| `--admin-border`      | `hsla(0,0%,92%,1)` (= #ebebeb) | 15          | Every border and divider, and the badge fill                 | **1.19:1 on white** (see §7, non-text contrast)                              |
| `--admin-hover`       | `#f2f2f2`                      | 3           | Button hover, nav hover, table-row hover                     | n/a                                                                          |
| `--admin-selected`    | `#ebebeb`                      | 1           | Current nav link                                             | Equals `--admin-border`                                                      |
| `--admin-text`        | `#171717`                      | 9           | Body text, pressed scope button fill                         | 17.9:1 on white                                                              |
| `--admin-muted`       | `#4d4d4d`                      | 10          | Hints, table headers, dates, host/URL prefixes, dialog body  | 8.45:1 on white, 7.09:1 on badge                                             |
| `--admin-accent`      | `#171717`                      | 4           | Primary button fill (same value as text)                     | n/a                                                                          |
| `--admin-accent-text` | `#ffffff`                      | 2           | Primary button label                                         | 17.9:1                                                                       |
| `--admin-danger`      | `#b91c1c`                      | 5           | Error text, danger buttons, invalid input border             | 6.47:1 on white, 5.91:1 on danger-bg                                         |
| `--admin-danger-bg`   | `#fef2f2`                      | 3           | Notice fill, danger button hover                             | n/a                                                                          |
| `--admin-success`     | `#15803d`                      | 1           | "Saved", "Reassigned"                                        | 5.02:1 on white, 4.81:1 on bg                                                |
| `--admin-focus`       | `#2563eb`                      | 1           | Global `:focus-visible` outline (2px, offset 2px)            | 5.17:1 on white, 3.47:1 against a primary button                             |

\* Count of `var(--admin-…)` occurrences across `app/(admin)` and `components/admin`.

#### Spacing (`--admin-space-N`)

| Token | 1   | 2    | 3    | 4    | 5    | 6    | 7    |
| ----- | --- | ---- | ---- | ---- | ---- | ---- | ---- |
| px    | 4   | 8    | 12   | 16   | 24   | 32   | 48   |
| uses  | 1   | 22   | 21   | 12   | 17   | 4    | 3    |

Note that `--admin-space-5` is **24px**, while the site's `--space-5` is **20px**. The names look parallel but the values differ.

#### Shape, layout, font

| Token                   | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `--admin-radius`        | `6px` (the only radius token)                               |
| `--admin-content-width` | `1200px` (top bar inner width and `<main>` width)           |
| `--admin-font`          | `var(--font-public-sans), ui-sans-serif, system-ui, sans-serif` |

#### Global base rules

- `box-sizing: border-box` everywhere. `html { scrollbar-gutter: stable }` keeps short and long pages at the same width.
- `body`: 14px / 20px, antialiased, `--admin-bg` background, `min-height: 100vh`.
- Margins reset on `h1–h3, p, ul, ol, fieldset`. Fieldset border and padding are also reset.
- `a { color: inherit }`. Form controls inherit `font` and `color`.
- `:focus-visible { outline: 2px solid var(--admin-focus); outline-offset: 2px }`. This one global rule is the admin's entire focus treatment.
- `.visually-hidden` utility (also defined separately in the site's `globals.css`).

### 2.3 Values that bypass tokens

| Value                                 | Where                                                                  | Note                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `#000`                                | `.primary:hover` (controls), `.google:hover` (login)                   | Primary hover darkens from #171717 to pure black. There's no token for it.   |
| `rgb(0 0 0 / 0.45)`                   | Both dialog `::backdrop`s                                              | Duplicated                                                                   |
| `0 20px 50px rgb(0 0 0 / 0.25)`       | `ConfirmDialog`, `ResourceDialog`                                      | The only resting shadow, and it's duplicated                                 |
| `0 8px 24px / 0 6px 18px rgb(0 0 0 / 0.15)` | Dragged group / dragged row                                      | Lift-while-dragging                                                          |
| `6px` literal                         | `AdminNav .link` border-radius                                         | Should be `var(--admin-radius)`                                              |
| `100px`, `50%`                        | Badge pill, avatar                                                     | n/a                                                                          |
| `0 6px`, `margin-left: -6px`          | `.roleBadge`                                                           | Pulls the badge 6px toward the name (the parent `gap` is 12px)               |
| `13px`, `16px`, `24px` font sizes     | Badge, confirm title, page/dialog/login titles                         | There are no type tokens                                                     |
| `56px`, `32px`, `40px`, `28px`        | Bar height, nav link/handle/control height, Google button, avatar      | Control height is set as `min-height: 32px` in several places, never tokenized |
| `220`, `260`, `320`, `360`, `400`, `440`, `640` px | Name truncation, select/copy-field min width, email column, search, login card, dialog widths | n/a                                                                          |

### 2.4 Typography

Everything is Public Sans. There are no type tokens. The whole scale is:

| Size | Weight | Line height    | Used by                                                                                                                                                                                |
| ---- | ------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24px | 600    | 1.2            | Page titles (`panel.pageTitle`), login title, **ResourceDialog title**                                                                                                                  |
| 16px | 600    | 20px (inherited) | ConfirmDialog title                                                                                                                                                                   |
| 14px | 600    | 18px           | Brand "Vydia Onboarding" in the nav                                                                                                                                                    |
| 14px | 500    | 20px           | Field labels, **section headings (`.legend`)**, category headings, nav links, buttons, row titles, client-name links, errors, notices, success, admin name                              |
| 14px | 400    | 20px           | Body, table headers (muted), hints                                                                                                                                                     |
| 13px | 400    | 20px           | Super admin badge                                                                                                                                                                      |

**Observation:** section headings (`h2.legend`, e.g. "Details", "Resources"), field labels, and category headings (`h3`) all render at **14px/500**. Category headings are only told apart by muted color. On the long client form, the hierarchy comes almost entirely from card boundaries, not from type.

### 2.5 Primitives (`components/admin/controls.module.css`)

| Class                               | Spec                                                                                                                                                       | Notes                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `.field`                            | Flex column, gap 8, `min-width: 0`                                                                                                                         | Wraps label + control + error                                                             |
| `.label`                            | 14/500                                                                                                                                                     | Also used on `<legend>`                                                                   |
| `.hint`                             | Muted color                                                                                                                                                | Inline secondary text (type label, "+2", "Unassigned", "Uploading…")                      |
| `.input`                            | Full width, min-height 32, padding 0 12, white, 1px border, 6px radius. `[aria-invalid='true']` turns the border red.                                      | Applied to `input`, `select`, and the date input. Not applied to file inputs or radios (browser default). |
| `.error`                            | Danger color, 500                                                                                                                                          | Under fields, `role="alert"`                                                              |
| `.notice`                           | Padding 12/16, danger-bg fill, danger text, 6px radius, 500                                                                                                | Form-level errors. **Also used for non-error info** (PDF-preview fallback messages)       |
| `.success`                          | Success color, 500                                                                                                                                         | "Saved", "Reassigned"                                                                     |
| `.button`                           | Inline-flex, gap 8, min-height 32, padding 0 12, white, 1px border, 6px radius, 500, nowrap, pointer. Hover → `--admin-hover`. Disabled → 0.5 opacity + `not-allowed`. | Used on `<button>` and `<a>` (`Link`)                                                     |
| `.primary`                          | Black fill/border, white text. Hover → `#000`.                                                                                                             | One per screen: New client, New resource, Save, Done, confirm                             |
| `.danger`                           | Red **text only** (white fill, grey border). Hover → danger-bg.                                                                                            | Remove email, Delete, Delete client, danger confirm. There is no filled destructive button. |
| `.card`                             | Padding 24, white, 1px border, 6px radius, **no shadow**                                                                                                   | Form sections, table wrapper, empty states                                                |
| `.legend`                           | 14/500, `margin-bottom: 12px`                                                                                                                              | Section `<h2>` headings                                                                   |
| `.rows` / `.row` / `.rowTitle` / `.rowActions` | "One row pattern for every list": a bordered white row (padding 12, gap 12, radius 6) with an ellipsized 500-weight title, then an optional hint, then actions. | Client form resources, client-specific resources, read-only resources                     |

The site has its own, unrelated `components/ui/controls.module.css`: pill-shaped (`999px`), white-on-dark primary, `.textButton`. The admin never imports it.

### 2.6 Interaction state model

| State             | Treatment                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hover             | `#f2f2f2` fill on buttons, nav links, and table rows. The drag handle gets `--admin-bg` (barely visible on white, 1.04:1) and its text turns `--admin-text`. |
| Selected / current | Nav: `aria-current='page'` → `#ebebeb` fill. Scope toggles: `aria-pressed='true'` → **inverted** (black fill, white text, same as a primary button). |
| Disabled          | `opacity: .5`, `cursor: not-allowed`                                                                                                              |
| Invalid           | `aria-invalid='true'` → red border, plus a red `role="alert"` message below                                                                       |
| Focus             | Global blue 2px outline, 2px offset                                                                                                               |
| Dragging          | `data-dragging` → `z-index: 2` + shadow                                                                                                           |
| Busy              | Label swaps ("Saving…", "Uploading…", "Copied"), `aria-busy` on the sortable groups, disabled controls. There are **no spinners** in the admin.    |

**Motion:** none. The admin has no transitions or animations at all (`ClientTable.module.css` even sets `transition: none` on the scope buttons). The only movement is dnd-kit's drag transforms.

**Responsiveness:** none. There are zero `@media` rules in admin CSS. The top bar, the 2fr/1fr/auto email rows, and the four-column sortable rows assume desktop widths. The client table scrolls horizontally (`overflow-x: auto`) as a safety valve.

**Theme:** light only, with no `prefers-color-scheme` handling.

---

## 3. Admin information architecture and screens

### 3.1 Routes, roles, and gating

```
/admin/login                 public. One "Sign in with Google" button
/admin/auth/callback         public. OAuth code exchange → claim_admin_profile() → /admin or ?error=no-access
/admin/auth/signout   (POST) → /admin/login (303)
/admin            (panel)    Clients index
/admin/clients/new           New client form
/admin/clients/[id]          Client detail (same form, plus assign and delete)
/admin/resources             Core resources (sortable for super, read-only for regular)
```

- `proxy.ts` → `lib/supabase/proxy.ts` redirects any `/admin/*` request without a session to `/admin/login`. Static assets (`.png`, `.svg`, and so on) are excluded from the matcher. This matters because the email logo is served from `/vydia-logo.png`.
- `requireAdmin()` (`lib/admin/auth.ts`) checks that the JWT email is in `admins`, and `is_admin()` in SQL also requires an `oauth` `amr` with an `@vydia.com` email. A signed-in non-admin goes to `?error=no-access`.
- Google sign-in passes `hd: 'vydia.com'` and `prompt: 'select_account'`.
- **Roles** (`admins.role`): `super` sees all clients, edits core resources, and reassigns. `regular` sees only clients where `assigned_admin = me` and sees core resources read-only. RLS enforces the same rules, so the UI branches on `isSuper` for presentation only.

### 3.2 Shell (`app/(admin)/admin/(panel)/layout.tsx`, `panel.module.css`, `AdminNav`)

```
┌───────────────────────────────────────────────────────────────────────────┐ 56px, bg = page bg,
│ Vydia Onboarding   [Clients] [Resources]     (●) Mason O'Mara (Super admin) [Sign out] │ 1px bottom border
└───────────────────────────────────────────────────────────────────────────┘ not sticky
      max-width 1200, padding 0 24
<main> max-width 1200, padding 32 24 48
```

- The brand is **text only** (14/600). The admin never shows the Vydia logo.
- Nav links are 32px-tall pills with 12px horizontal padding. The current link is `#ebebeb`. "Clients" is active for `/admin` and `/admin/clients/*`.
- On the right: the Google avatar (28px circle, `unoptimized`, `referrerPolicy="no-referrer"`), the display name (or email) truncated at 220px, a **Super admin** pill badge for supers only, and **Sign out** as a default button inside a POST form.
- The bar background equals the page background, so only the hairline border separates it. It scrolls away with the page.
- Page pattern: `header.pageHeader` (flex, space-between, mb 24) → `h1.pageTitle` on the left, primary action on the right.
- There is no `loading.tsx`, `error.tsx`, or `not-found.tsx` in the admin tree. Navigation has no skeletons, and the detail page throws `Couldn’t load the client: …` to the default error UI. Every panel page exports `instant = false`.

### 3.3 Login (`/admin/login`)

- Centered card on the page background (grid `place-items: center`, `min-height: 100vh`): max-width 400, padding 32, 6px radius, no shadow.
- Title "Vydia Onboarding" (24/600). There's an optional error notice (red pill box), then a full-width black **Sign in with Google** button. It's 40px tall, taller than the standard 32px, and has **no Google mark**.
- Error copy comes from a whitelist (`ERRORS` map), so unknown `?error=` values render nothing (e2e-tested): `no-access` → "You don’t have access."; `google` → "Google sign-in isn’t available right now. Try again in a minute."

### 3.4 Clients index (`/admin`, `ClientTable.tsx`)

- Title: **Clients** (super) or **Your clients** (regular). Primary **New client** link-button.
- Toolbar: a search `input[type=search]` (max-width 360, placeholder "Search clients") that matches name, any email, or owner (`lib/admin/client-filter.ts`). Supers also get a **Mine / All / Unassigned** segmented group (`role="group"`, `aria-pressed` buttons), which **defaults to Mine** for supers.
- Table inside a zero-padding card. Columns: **Client** (500-weight link to detail) · **Email** (primary, with muted `+N` for additional emails, ellipsized at 320px) · **Owner** (supers only. Shows the display name, or a muted "Unassigned") · **Created** (muted, `Nov 11, 2026` in America/New_York) · actions (**Copy link**, **Open ↗**), right-aligned.
- Headers: muted, 14/400. Cells: padding 12/16 with a hairline bottom border, removed on the last row. Rows highlight on hover, but **only the name is clickable** (the hover suggests the whole row is).
- Empty states: an empty card with "No clients yet" or "No clients assigned to you yet" (padding 48/24, centered, 500). For a filter with no results: "No clients match “query”." or "No clients in this view."
- **Copy link** copies `${SITE_URL}/${slug}` and shows "Copied" for 1.5s (`aria-live="polite"` on the button). If clipboard access fails, it swaps itself for a read-only, auto-selected input (min-width 260) that reverts on blur. **Open** is a `target="_blank"` anchor to `/${slug}` with a 14px external-link icon.

### 3.5 Client form (`/admin/clients/new` and `/admin/clients/[id]`, `ClientForm.tsx`)

The detail page stacks these with 24px gaps:

```
[h1 Client name]  Saved            [Copy link] [Open ↗]       ← pageHeader
Assigned to  [select ▾]  Reassigned                            ← supers only, NOT in a card
┌ Details ─────────────────────────────────────────────┐
│ Name      [__________________________]               │
│ Link      welcometovydia.com/ [lil-example_______]    │
│           The old link will stop working.  (red, only if changed)
│ Email     [__________________________]               │
│ Additional emails                                    │
│   [manager@example.com      ] [Label   ] [Remove]    │  grid 2fr / 1fr / auto
│   [Add email]                                        │
└──────────────────────────────────────────────────────┘
┌ Resources ───────────────────────────────────────────┐  only if core resources exist
│ Category (muted h3)                                  │
│ ┌ Title ...................... PDF   [Remove] ┐      │  row pattern
└──────────────────────────────────────────────────────┘
┌ Client-Specific Resources ───────────────────────────┐
│ ┌ Q1 Plan .................... PDF   [Edit] [Delete] ┐│
│ [Add client-specific resource]                       │
└──────────────────────────────────────────────────────┘
(notice: form error)
[Save]                                                   ← primary, left-aligned, not sticky
──────────────────────────────────────────────────────── 1px border-top
[Delete client]                                          ← danger
```

Behavior worth knowing:

- **Slug auto-fill:** typing the name fills the slug with `slugify()` until the slug field is touched (on new clients only). The host prefix (`new URL(SITE_URL).host + '/'`) is muted plain text next to the input, and slug input is lowercased as you type.
- **Slug change guard:** on an existing client, a changed slug shows the red inline warning, and Save opens a `ConfirmDialog` ("Change this client’s link?" / "…send the client the new one: host/slug" / **Save and change link**).
- **Emails:** the primary email is sent as `{label: 'Client', isPrimary: true}`. Additional rows use a `<datalist>` suggesting **Manager / Alt / Assistant** (max 40 chars), and blank rows are dropped on save. The additional-email inputs have visually hidden labels ("Additional email 1", "Label for additional email 1").
- **Hide core resources:** **Remove/Restore** toggles a `Set` of hidden ids. The button `aria-label` is "Remove {title}" / "Restore {title}". The intended grey-out and strikethrough are broken (§7.1).
- **Save is all-or-nothing:** the client, emails, hides, and exclusive resources go through one `save_client` RPC. Save is disabled while saving or while any upload is in progress, and the label goes Save → Saving… / Uploading…. Success redirects to `/admin/clients/{id}?saved=1`, which shows a green **Saved** next to the H1. That flag stays in the URL until you navigate away, so "Saved" can still be showing next to unsaved edits.
- **Key-based reset:** `<ClientForm key={id:updated_at}>` remounts the form with fresh server data after each save.
- **No unsaved-changes guard** and no Cancel/back link on the form. Leaving after uploading files orphans them (cleaned by `npm run storage:sweep`, see `docs/admin-guide.md`).
- **Assign** (supers): changing the select **saves immediately** (optimistic, reverts on failure). It shows "Reassigned" in green or an error in red. The first option is "Unassigned (super admins only)".
- **Delete client:** a danger button opens a danger `ConfirmDialog` ("Delete {name}?" / "This permanently deletes the client, their emails, and their client-specific resources." / **Delete client**). On success it redirects to `/admin`.

### 3.6 Resource editing (shared by both editors)

`ResourceFields.tsx` is the field set used both inline (client-specific) and in the modal (core):

| Field       | Control                                                                 | Rules / behavior                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title       | text, max 120                                                           | Required                                                                                                                                                                                                                                          |
| Type        | Native radios in a wrapping fieldset: PDF · Video · Link (pitch forms, external pages) · Slide deck | Changing type clears the fields that no longer apply                                                                                                                                                                                              |
| File        | **Native, unstyled** `<input type=file>` with a per-type `accept`       | Hidden for Link. Shows the current file name plus **Remove file**. The MIME type is checked client-side, then again server-side when the signed upload URL is issued.                                                                             |
| URL         | Text input with a muted `https://www.` prefix                           | Shown for Link and Slides. See §7.2.                                                                                                                                                                                                              |
| Cover image | Native file input, JPG/PNG/WebP ≤ 5 MB                                  | Shows a 96×96 bordered thumbnail plus **Remove cover**. The thumbnail falls back to the auto PDF preview. A 20px-wide JPEG LQIP is generated in the browser.                                                                                     |
| Alt text    | Text                                                                    | Only shown when a cover exists                                                                                                                                                                                                                    |
| Category    | `CategoryInput`: a `<select>` of existing categories plus "+ Add new…", which reveals an autofocused text input | Categories are case-insensitively de-duplicated (`distinctCategories`)                                                                                                                                                                            |
| Added on    | `<input type=date>`                                                     | Stored as `YYYY-MM-DDT12:00:00.000Z` (noon UTC, to avoid date shifting)                                                                                                                                                                           |
| Status      | Muted "Uploading…" (`role=status`) and a red notice for messages        | PDFs: the first page is rendered with pdf.js in a Web Worker (max 1200px wide, JPEG 0.85) and uploaded as the preview. If that fails, the message "…The card will use the branded tile instead." appears **in the red error notice**.             |

**Inline editor (`ResourceEditor.tsx`, client-specific):**

- A row expands into a bordered panel with the fields, then **Done** (primary, validates locally) and **Cancel** (reverts to a snapshot, or removes the draft if it's new).
- **Add client-specific resource** is disabled while any row is open.
- Collapsed rows show the title (or "Untitled"), the type, or a red **Needs attention** if there are errors, followed by **Edit** and **Delete**. Delete has no confirmation, which is fine because nothing persists until Save.

**Modal editor (`ResourceDialog.tsx`, core, supers only):**

- Native `<dialog>` + `showModal()`, `min(640px, 100vw-32px)`, `max-height: 100vh-48px` (the content scrolls and the actions aren't sticky).
- Title "New resource" / "Edit resource" at **24px** (page-title size).
- Actions are right-aligned **Cancel · Save**. Esc and Cancel close it without asking. Unlike ConfirmDialog, a backdrop click does nothing.

### 3.7 Core resources page (`/admin/resources`)

**Super admins (`SortableResourceList.tsx`):**

- Header "Resources" + primary **New resource**.
- One card per category (12px padding, tighter than the standard 24) with a ⠿ handle plus the category name. Inside are bordered rows: grid `auto | 1fr | auto | auto` = handle, title, type, Edit/Delete.
- **Two nested dnd-kit contexts:** categories reorder among themselves, and rows reorder within their category (not across categories). There are pointer (6px activation distance) and keyboard sensors, plus custom screen-reader announcements and instructions ("To pick up an item, press space or enter…").
- Reorder is **optimistic** (`useOptimistic`) and persisted through `reorder_main_resources(ids[])`. On failure a notice says "Couldn’t save the new order. It has been put back."
- Delete opens a danger confirm ("Delete {title}?" / "It’s removed from every client’s page.").

**Regular admins (`ReadOnlyResourceList.tsx`):** the same card/row look with no handles or actions, plus an explanatory muted paragraph. This is one of the few explainer hints left after the restyle.

### 3.8 Dialog system

|                | ConfirmDialog                                      | ResourceDialog                         |
| -------------- | -------------------------------------------------- | -------------------------------------- |
| Width          | `min(440px, 100vw-32px)`                           | `min(640px, 100vw-32px)`               |
| Padding / gap  | 24 / 12                                            | 32 / 24                                |
| Title          | 16/600                                             | **24/600**                             |
| Body           | Muted                                              | Form                                   |
| Backdrop click | Cancels                                            | Ignored                                |
| Confirm style  | `primary` or `danger` (red text on white) via `tone` | primary                              |
| Shared         | Native `<dialog>`, white, 1px border, 6px radius, `0 20px 50px rgb(0 0 0/.25)`, backdrop `rgb(0 0 0/.45)`, `aria-labelledby` → title, actions right-aligned Cancel then Confirm |

---

## 4. Admin UX patterns and conventions

### 4.1 Save models (three different ones)

1. **Client form:** a local draft, then explicit **Save** of everything in one transaction, then redirect.
2. **Assigned to:** auto-saves on change, on the same page as (1).
3. **Core resources:** each dialog Save, reorder, and delete persists immediately and calls `refresh()`.

Mixing (1) and (2) on one page means that changing the owner and then abandoning the form leaves the reassignment applied. It's probably fine, but worth knowing.

### 4.2 Validation pipeline

- The Zod schemas in `lib/validation.ts` (`clientPayload`, `resourceInput`) run **on the client first** (instant field errors) and **again in the server action**.
- Errors are keyed by Zod path (`name`, `slug`, `emails.0.email`, `exclusiveResources.2.url`, …) and mapped back to fields. In ClientForm, nested resource errors are split per draft.
- Database constraint errors are translated by `lib/admin/errors.ts` (slug unique/check, duplicate email, primary email). `P0002` becomes "This client no longer exists or isn’t assigned to you."
- Forms use `noValidate`, so native browser bubbles never appear. Only the app's messages do.
- Field errors use `role="alert"`. Only `EmailRows` wires up `aria-describedby`. The Name, Link, Email, and resource fields don't link their errors to their inputs.

### 4.3 Feedback vocabulary

| Kind               | Component                                                  | Example copy                                         |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------- |
| Field error        | `.error` + `role=alert`                                    | "Enter a valid email address."                       |
| Form/server error  | `.notice` + `role=alert`                                   | "Couldn’t reach the server. Nothing was changed."    |
| Success            | `.success` + `role=status`                                 | "Saved", "Reassigned"                                |
| Warning            | `.error` styling with `role=status` (no warning style exists) | "The old link will stop working."                 |
| Progress           | Button label / muted hint                                  | "Saving…", "Uploading…", "Copied"                    |
| Summary            | `.error` in a collapsed row                                | "Needs attention"                                    |

### 4.4 Copy and voice (follow these when adding UI)

- **Typographic apostrophes and quotes** throughout (`Couldn’t`, `isn’t`, `“query”`, `…`). Never straight `'` in user-facing copy.
- **Reassure about state:** failures say what did *not* happen: "Nothing was changed.", "It has been put back."
- **Short imperative labels:** Save, Done, Cancel, Edit, Delete, Remove, Restore, Copy link, Open, Add email, New client, New resource.
- **Sentence case** for buttons, labels, and most headings. The one exception is the section heading "Client-Specific Resources" (Title Case, from commit `8bd58a0`), next to "Details", "Resources", and "Additional emails".
- Status words have no trailing period ("Saved", not "Saved.").
- Dialog titles are questions ("Delete Lil Example?", "Change this client’s link?"). The confirm button repeats the verb plus object ("Delete client", "Save and change link").
- Terminology: the codebase and docs say **main**, **core**, and **exclusive / client-specific** resources. The UI says **Resources** and **Client-Specific Resources**, and the read-only page says "Core resources".

### 4.5 Accessibility already in place

- Landmarks: `nav[aria-label=Admin]`, `main`, `header`. Every page has a single H1.
- `aria-current` on nav, `aria-pressed` on scope toggles, `role=group` with a label.
- Labelled icon-like buttons (handles: "Reorder {title}", "Reorder category {name}"). Row actions have specific labels ("Delete {title}", "Remove additional email 2").
- Native `<dialog>` handles focus trapping and Esc.
- dnd-kit keyboard sorting with spoken announcements.
- Axe (WCAG 2.2 AA) runs in e2e on the admin **login** page only (`tests/e2e/a11y.spec.ts`). Panel screens aren't axe-tested, because Google sign-in can't be automated.

---

## 5. Emails

### 5.1 What exists

There is **exactly one transactional email: the sign-in magic link.** It exists as two files because Supabase picks the template by user state:

| Supabase template | File                                     | Sent when                                                              |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Magic Link        | `supabase/templates/magic-link.html`     | The email already has a Supabase user                                  |
| Confirm signup    | `supabase/templates/confirm-signup.html` | First sign-in for that email (`signInWithOtp` with `shouldCreateUser: true`) |

The files are **byte-identical** (verified with `diff`), so first-time clients never see "confirm your account" wording. **Both must be updated together.**

The Welcome link (`/slug`) is **never emailed by the app**. Admins copy it (**Copy link**) and paste it into their own email.

### 5.2 End-to-end flow

```
Client opens /lil-example (no access) → <EnterEmail>
  types email → [Continue]  (button stays muted at 40% opacity until the address looks valid)
  → server action sendLink (app/(site)/[slug]/actions.ts)
      1. normalize email + slug; invalid → "Enter your full email address."
      2. per-IP limit: 20 per 10 min (hit_rate_limit)       → "Too many attempts…"
      3. email_can_access_slug(slug, email)                 → not approved: "This email isn’t approved…"
      4. claim_link_send(email): one per 60 s per email     → in cooldown: show "sent" silently, send nothing
      5. signInWithOtp({email, emailRedirectTo: SITE_URL/slug})   (stateless client, token-hash flow)
           └ Auth hook hook_before_user_created: allows a new email user only if the address
             is a client email and NOT an admin. Admins can only be Google users.
      → "Email sent, check your inbox"  + [Resend email (60s)] countdown
  ↓
Supabase → Resend SMTP → inbox
  From: Vydia <welcome@onboarding.vydia.com>   (send-only, replies bounce)
  Subject: Open your Vydia Onboarding page
  Button → {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}
  ↓
GET /auth/confirm (route handler, Cache-Control: no-store)
  verifyOtp({type:'email', token_hash}) ok      → 302 to safeNext(redirect_to) → resources page
  fails, but session has otp/magiclink amr < 60 s old (double-click / second tab) → same redirect
  else                                           → /auth/expired?next=/slug
       "This link has expired" / "Sign-in links work once and expire after an hour." / [Send a new link]
```

Design decisions behind this (from `docs/iteration-two-plan.md` and `docs/sign-in-plan.md`):

- **D19:** verify by `token_hash`, not PKCE, so the link works in any browser (for example, the Gmail in-app browser). That's why the email says "Open it in the browser you want to stay signed in on."
- **D33:** the link signs in on GET, with no "Continue" interstitial (this reversed D18). The accepted trade-off is that link-scanning security gateways (Outlook Safe Links, Mimecast) can consume the token, and the client then sees the expired screen.
- Sessions never expire. Access is re-checked against live client–email rows on every load.

### 5.3 Template anatomy

```
<table role=presentation 100%>  bg #f3f4f6, padding 32/16,
                                font 'Public Sans',Helvetica,Arial,sans-serif, color #262626
  <td align=center>
    <table role=presentation 100%, max-width 480>  bg #fff, 1px #e5e7eb, radius 12
      ┌──────────────────────────────────────────┐
      │  bg #121212 (bgcolor attr + style),      │  radius 12 12 0 0, padding 28/24
      │        [ VYDIA logo PNG, 160px wide ]    │  /vydia-logo.png: 640×72 white on transparent
      ├──────────────────────────────────────────┤  (~18px tall at 160w, a 4× source)
      │  padding 32/24                           │
      │  H1 20/600  "Open your Vydia Onboarding page"     mb 12
      │  P 16/1.5 #404040  "Use this button to open your page as {{ .Email }}.
      │     This link works once and expires in 1 hour. Open it in the browser
      │     you want to stay signed in on."                mb 24
      │  [ Open my page ]  <a> inline-block, padding 12/20, bg #121212,
      │                    #fff, radius 6, 600, no underline     mb 24
      │  P 14/1.5 #6b7280  "If you didn’t ask for this link, you can ignore this email."
      └──────────────────────────────────────────┘
```

- **Line 1 of each file** is `<!-- Subject: Open your Vydia Onboarding page -->`, the repo's convention for keeping the subject next to the body. The actual subject is set in `supabase/config.toml` (`[auth.email.template.*].subject`) locally, and pasted into the dashboard for hosted projects (`docs/launch-checklist.md` Part 4.5).
- It's a **fragment** with no `<html>`, `<head>`, `<meta charset>`, `<meta name="color-scheme">`, or `<style>` block. All styles are inline.
- Template variables used: `.SiteURL`, `.Email`, `.TokenHash`, `.RedirectTo`. It does **not** use `.ConfirmationURL`, which would route through Supabase's verify endpoint and bypass `/auth/confirm` (see iteration-two-plan E3).
- The logo is a PNG on purpose ("email clients block SVG"). It's a PNG export of `docs/logo/gamma-vydia-white.svg`, hosted by the app at `SITE_URL/vydia-logo.png`. Because `proxy.ts` excludes `.png`, auth middleware never intercepts it. It **depends on Site URL being correct** in Supabase, the same dependency the button link has.

### 5.4 Email styling vs. the two app systems

| Property      | Email                                         | Client site (`globals.css`)              | Admin (`admin.css`)                   |
| ------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| Canvas        | `#f3f4f6` (Tailwind gray-100)                 | `#1a1a1a`                                | `#fafafa`                             |
| Surface       | `#ffffff` card                                | `#1a1a1a`                                | `#ffffff`                             |
| Border        | `#e5e7eb` (Tailwind gray-200)                 | `#e5e7eb` (`--color-border`)             | `#ebebeb`                             |
| Near-black    | `#121212` (= site `--color-ink`), text `#262626` | `#1a1a1a` page, `#121212` ink         | `#171717`                             |
| Muted text    | `#6b7280` (Tailwind gray-500)                 | `#6b7280` (`--color-text-muted`)         | `#4d4d4d`                             |
| Body text     | `#404040` (= site `--color-heading`)          | `#ffffff`                                | `#171717`                             |
| Card radius   | 12px (= site `--radius-lg`)                   | 12–16px                                  | 6px                                   |
| Button        | Dark fill, white, **6px**, 600, 12/20 padding | White fill, dark text, **pill 999px**, 600 | Dark fill, white, **6px**, 500, 32px |
| Font          | 'Public Sans' (**not loaded**, so effectively Helvetica/Arial) | Public Sans                  | Public Sans                           |

The email is a **hybrid**: the site's ink color and grays plus the admin's 6px button radius, on a light card. The client goes from a **dark** sign-in screen to a **light** email and back to a **dark** resources page. Brand continuity rests on the dark logo band and the near-black button.

### 5.5 Delivery configuration

| Setting               | Value / source                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| SMTP                  | Resend (`smtp.resend.com`), configured in the Supabase dashboard (`docs/launch-checklist.md` Part 4)                                                |
| Sender                | `Vydia <welcome@onboarding.vydia.com>`. **Send-only. Replies bounce.** Label services should be told so clients contact them directly.              |
| Domain auth           | DKIM + 2 CNAMEs on `onboarding.vydia.com`. DMARC is inherited from `vydia.com` (`p=quarantine`), so mail sent before Resend verification lands in spam. |
| Link expiry           | `otp_expiry = 3600`, matching "expires in 1 hour" in the email and "expire after an hour" on the expired page                                       |
| Per-email cooldown    | 60 s (`claim_link_send` in the app, plus Supabase's own `max_frequency = "60s"`), matching the UI countdown                                         |
| Project send cap      | Local `auth.rate_limit.email_sent = 2` per hour. That's very low, so local testing runs into it quickly. The checklist says to raise the hosted value (e.g. 100). |
| Local preview         | Supabase's local mail catcher at `http://127.0.0.1:55324` (`[local_smtp]`). Template changes need `supabase stop && supabase start`, because `db reset` doesn't reload `config.toml`. |
| Hosted templates      | **Not deployed from the repo.** They're pasted by hand into Supabase → Auth → Email Templates (`pbcopy < supabase/templates/magic-link.html`), once per template, per project. |

### 5.6 Email client compatibility review

| Area                     | Status                                                                                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table layout, `role=presentation` | ✅ Good base                                                                                                                                                                                                                                                         |
| Header color in clients that strip CSS | ✅ `bgcolor="#121212"` attribute as well as the inline style                                                                                                                                                                                                |
| Card width in Outlook desktop (Word engine) | ⚠️ `max-width: 480px` is ignored there, so the card stretches to full width. There's no fixed-width (`width="480"`) inner table and no MSO ghost table.                                                                                                     |
| Rounded corners in Outlook | ⚠️ `border-radius` is ignored, so corners are square. Cosmetic only.                                                                                                                                                                                                         |
| CTA button in Outlook desktop | ⚠️ Padding on an `inline-block` `<a>` is ignored, so it renders as a small dark text link with a tiny hit area. Bulletproof pattern: put `bgcolor` and padding on a `<td>` wrapper, or use VML.                                                                          |
| Images blocked (Outlook default, some corporate gateways) | ⚠️ The alt text "Vydia" renders in the client's default (usually dark) text color on the `#121212` band, so it's nearly invisible. Add `color:#ffffff; font-size:20px; font-weight:700` to the `<img>` style so the alt text is legible. |
| Fallback link            | ⚠️ None. If the button breaks, or the client copies the link to another browser (which the copy encourages), there's no plain URL to copy. Common practice is to add "Or paste this link into your browser: …".                                                          |
| Preheader                | ⚠️ None. The inbox preview shows the logo's alt text and then the H1, which repeats the subject: "Vydia Open your Vydia Onboarding page Use this button…".                                                                                                                  |
| Plain-text part          | ❓ The repo only provides HTML. Whether Supabase/Resend generates a text alternative should be confirmed in a received message's source.                                                                                                                                     |
| Dark mode                | ⚠️ There's no `color-scheme` meta. Clients that invert colors (Gmail apps, Outlook.com) may lighten the white card. The dark band and white logo mostly survive. Test on a real device (launch checklist Part 7).                                                           |
| `{{ .Email }}` auto-linking | ⚠️ Gmail and iOS will turn the address into a blue `mailto:` link in the middle of the sentence. Not harmful, but it's not in the style.                                                                                                                                   |
| Web font                 | ℹ️ Public Sans isn't loaded, so recipients see Helvetica or Arial. That's acceptable, but the email won't exactly match the site.                                                                                                                                             |
| Contrast                 | ✅ H1 15.1:1, body 10.4:1, footnote 4.83:1, button 18.7:1                                                                                                                                                                                                                     |
| Retina logo              | ✅ The 640px source shown at 160px is 4× density                                                                                                                                                                                                                              |
| No client name in email  | ✅ Consistent with the "never reveal which clients exist" rule. The slug only appears inside `redirect_to`.                                                                                                                                                                  |

### 5.7 On-site screens around the email (client side)

These belong to the email flow and use the **site** system (`components/ui/controls.module.css`, `EnterEmail.module.css`, `Notice`):

- **Enter your email:** fixed full-viewport centered panel (max-width 384). The input is a 44px pill with a transparent background and a soft white glow (`0 0 24px rgb(255 255 255/.15)` plus an inset glow). **Continue** is a white pill, dimmed to 40% until the email matches `EMAIL_PATTERN`. It stays clickable so the browser can still flag bad input. While sending, a 14px spinner appears inside the left edge of the button, out of flow so the label doesn't shift. Error messages hang absolutely below the form in `#ff7b7b` (6.94:1 on #1a1a1a), so they never push the layout.
- **Sent:** "Email sent, check your inbox" (14/500, `role=status`) above **Resend email (Ns)**, a 14/500 outline pill with a 1-second countdown. Both views have a visually hidden H1 ("Enter your email" / "Check your inbox").
- **Expired:** the `Notice` card (max-width 480, 1px `#e5e7eb` border, 12px radius on #1a1a1a, body at 78% white) plus a white-pill **Send a new link** that links back to the slug.
- **Message copy differs from the docs.** The actual not-approved text is "This email isn’t approved to view this page. Make sure you’re using the URL provided by Vydia label services, or contact them if you’re having trouble."

---

## 6. Cross-system summary

| Dimension        | Client site                                      | Admin                                     | Email                                      |
| ---------------- | ------------------------------------------------ | ----------------------------------------- | ------------------------------------------ |
| Mode             | Dark                                             | Light                                     | Light card, dark header band               |
| Token prefix     | `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--switch-*`, `--grain` | `--admin-*`             | none (inline literals)                     |
| Spacing scale    | 4, 8, 12, 16, **20**, 24, 32, 40, 64             | 4, 8, 12, 16, **24**, 32, 48              | 12, 16, 20, 24, 28, 32                     |
| Radius           | 6 / 8 / 12 / 16 / 999                            | 6 (plus pills for the badge)              | 12 card, 6 button                          |
| Buttons          | Pill, white primary                              | 6px, black primary, outline default, red-text danger | 6px, near-black                  |
| Elevation        | Blur/gradient header and footer, grain, glow     | Flat. Shadows only on dialogs and drag    | Flat                                       |
| Motion           | Rich (view-transition morphs, scroll inertia, reduced-motion respected) | None              | n/a                                        |
| Focus            | 2px `--color-ink` outline (**invisible on dark**), white on header toggle and video close | 2px blue | n/a                                        |
| Responsiveness   | Mobile-first, with breakpoints at 640, 667, 768, and 1024 | None (desktop-first)             | Fluid up to 480 (not in Outlook)           |
| Logo             | SVG in the card placeholder tile                 | **Not shown** (text brand)                | PNG in the header band                     |

---

## 7. Issues and inconsistencies

Severity: 🔴 functional or user-facing bug · 🟠 UX/a11y problem · 🟡 consistency or polish · 📄 documentation drift.

### 7.1 🔴 Hidden core resources show no visual change

`components/admin/ClientForm.module.css:46-49`:

```css
.row[data-hidden] .rowTitle { color: var(--admin-muted); text-decoration: line-through; }
```

The title span uses `controls.rowTitle` (a class hashed in `controls.module.css`). This selector targets `ClientForm.module.css`'s **own** `.rowTitle`, which is never applied, so the rule never matches. This regressed in `291af01`, when the rows moved from local `.resource`/`.resourceTitle` (which worked, and also had a grey row background) to the shared `controls.row`. Clicking **Remove** now only changes the button text to **Restore**. `docs/admin-guide.md:46` still promises "The row turns gray and struck through."

**Fix:** use `.row[data-hidden] > span:first-child` or `:global()`, or add a `data-hidden` variant to `controls.module.css` (`.row[data-hidden] .rowTitle` written in the same file as `.rowTitle`).

### 7.2 🔴 `https://www.` URL prefix corrupts subdomain URLs

`components/admin/ResourceFields.tsx:15,37-42`. When the URL field is empty or already starts with `https://www.`, anything typed without a scheme gets `https://www.` prepended. Typing `docs.google.com/forms/d/…` (a typical pitch form) or `forms.gle/…` saves `https://www.docs.google.com/…` or `https://www.forms.gle/…`, which likely don't resolve. Zod's URL check passes, so nothing warns the user. Pasting a full `https://…` URL works, because the prefix is dropped.

**Fix:** prefix only `https://`, or only add `www.` when the host has no subdomain. Alternatively, drop the prefix and normalize on blur.

### 7.3 🟠 Invisible focus ring on the client sign-in and expired screens

`components/ui/controls.module.css:42-47`: `outline: 2px solid var(--color-ink)` = `#121212` on a `#1a1a1a` page is **1.08:1**. Keyboard users can't see focus on the email input, **Continue**, **Resend email**, or **Send a new link**. `ResourceCard` uses the same ink outline. Axe doesn't check focus visibility, so `a11y.spec.ts` passes anyway. The header toggle and video close button correctly use white.

### 7.4 🟠 Admin borders are below the 3:1 non-text contrast guideline

`--admin-border` (#ebebeb) is 1.19:1 on white. Inputs and selects are only identifiable by that border (WCAG 1.4.11). This is an intentional, modern aesthetic, and labels sit above every field, but it's worth a conscious decision. A slightly darker border for **inputs only** (e.g. hsla(0,0%,80%)) would fix it without changing the look of cards and rows.

### 7.5 🟡 Admin visual and system inconsistencies

1. **Collapsed heading hierarchy:** section H2 (`.legend`), field labels, and category H3 are all 14/500 (§2.4).
2. **Dead override:** `ClientForm.module.css:13` `.section > .legend { margin: 0 }` has the same scoping problem as §7.1. Section headings keep `margin-bottom: 12px` *on top of* the 24px flex gap, so the space under a section heading is 36px instead of the intended 24px.
3. **Dialog title sizes:** ConfirmDialog is 16px and ResourceDialog is 24px.
4. **"Remove" means two things:** on core resources it's a neutral, reversible hide. On additional emails it's the red danger style.
5. **Info shown as error:** PDF-preview fallback messages ("…will use the branded tile instead") use the red `.notice`. Slug-change warnings use the red `.error` with `role=status`. There's no neutral, info, or warning style.
6. **Pressed toggle = primary button:** the inverted `aria-pressed` scope button looks exactly like a primary CTA.
7. **Table rows hover-highlight but aren't clickable.** Only the name link navigates.
8. **The Assigned-to select sits outside any card**, between the page header and the first card, and it auto-saves while the rest of the page needs Save (§4.1).
9. **Unstyled native controls:** file inputs and radios use browser defaults inside an otherwise custom-styled form.
10. **Icon approach:** an inline copy of a Lucide SVG and a `⠿` braille glyph (its rendering depends on the font), even though `lucide-react` is already a dependency (`GripVertical`, `ExternalLink`).
11. **Tokens bypassed:** the nav radius `6px` literal, the `#000` hover, duplicated dialog shadow and backdrop values, and no type or control-height tokens (§2.3).
12. **Badge:** the border color equals the fill, so the border does nothing, and a `-6px` margin hack cancels half the parent gap.
13. **Drag-handle hover** uses `--admin-bg` on white (1.04:1), so the hover is effectively invisible.
14. **No sticky Save:** on a long client form, Save sits only at the bottom, and the top bar isn't sticky.
15. **"Saved" persists** while there are new unsaved edits (it comes from the `?saved=1` query).
16. **Error-to-input linking:** only `EmailRows` uses `aria-describedby` for errors.
17. **Title Case "Client-Specific Resources"** among sentence-case headings.

### 7.6 🟡 Email polish (see §5.6)

There's no Outlook-safe button or width, no fallback URL, no preheader, no styled alt text for the logo, no `color-scheme` meta, and the H1 repeats the subject. Two identical files must be kept in sync by hand.

### 7.7 📄 `docs/admin-guide.md` vs. the UI

| Guide says (line)                                                       | UI actually says                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| "Client name" (43)                                                      | **Name**                                                                 |
| "Primary email" (44)                                                    | **Email**                                                                |
| "Under **Main resources**…" (46)                                        | Section **Resources**                                                    |
| "The row turns gray and struck through" (46)                            | Nothing changes visually (§7.1)                                          |
| "the **Welcome link** at the top" (50)                                  | No visible link, only **Copy link** / **Open**                           |
| "**Add exclusive resource**" (54)                                       | **Add client-specific resource**, in section **Client-Specific Resources** |
| "It suggests categories… as you type" (62)                              | A dropdown with **+ Add new…**                                           |
| "**Open page**" (73)                                                    | **Open**                                                                 |
| "**New main resource**" (83)                                            | **New resource**                                                         |
| "click **Send link**" (91)                                              | **Continue**                                                             |
| Not-approved message "…Please contact Vydia label services…" (92)       | "…Make sure you’re using the URL provided by Vydia label services, or contact them…" |

`docs/iteration-two.md` has the same "Send link" and "Welcome link front and center" drift.

---

## 8. Recommendations (prioritized)

**Fix now (small, high value)**

1. Restore the hidden-row styling (§7.1). Put the variant in `controls.module.css` so any list can use `data-hidden`.
2. Fix the URL prefix (§7.2).
3. Give the site's focus ring a visible color, e.g. `#fff` or a light gray (§7.3).
4. Remove or fix the dead `.section > .legend` override (§7.5.2).
5. Update `docs/admin-guide.md` to match the UI (§7.7).

**Email hardening (one pass; edit both templates identically)**

6. Wrap the CTA in a bulletproof `<td bgcolor="#121212" style="border-radius:6px">` button, and add an MSO conditional fixed-width (480) table.
7. Add a hidden preheader (e.g. "Your sign-in link works once and expires in 1 hour.") and a plain fallback URL under the button in muted 14px.
8. Style the logo's alt text white and large. Consider an `<html>/<head>` with `<meta charset>` and `color-scheme`.
9. Optionally add a contact line ("Questions? Reply to your Vydia label services contact"), since the sender address can't receive replies.
10. Consider building both files from one source (or adding a CI check that they're identical) so they can't drift.

**Admin design-system maturity (if continuing to invest)**

11. Add type tokens (`--admin-text-sm/base/lg/xl`), a control-height token (`--admin-control-h: 32px`), and elevation tokens (`--admin-shadow-overlay`, `--admin-backdrop`). Add `--admin-accent-hover` for the `#000` hover.
12. Distinguish section headings, e.g. 16/600 for `.legend` so labels stay 14/500.
13. Add a neutral or warning message style, and use it for the slug warning and PDF-preview fallbacks.
14. Standardize dialogs: one title size, and the same backdrop-click behavior.
15. Use `lucide-react` for icons (grip, external link) instead of glyphs and inline SVG.
16. Consider a sticky footer bar with Save on the client form, and a `beforeunload` guard when the form is dirty.
17. Add `loading.tsx` and `error.tsx` to the admin panel segment.
18. Decide on input border contrast (§7.4).

---

## 9. File index

**Admin shell and pages:** `app/(admin)/layout.tsx`, `app/(admin)/admin.css`, `app/(admin)/admin/(panel)/{layout.tsx,page.tsx,panel.module.css}`, `…/clients/{new/page.tsx,[id]/page.tsx,[id]/detail.module.css,actions.ts}`, `…/resources/{page.tsx,actions.ts}`, `…/uploads/actions.ts`, `app/(admin)/admin/login/{page.tsx,actions.ts,login.module.css}`, `app/(admin)/admin/auth/{callback,signout}/route.ts`

**Admin components:** `components/admin/` (`controls.module.css` is the primitives file): `AdminNav`, `ClientTable`, `ClientForm`, `EmailRows`, `ResourceEditor`, `ResourceFields`, `CategoryInput`, `ResourceDialog`, `ConfirmDialog`, `SortableResourceList`, `ReadOnlyResourceList`, `AssignAdminSelect`, `CopyLinkButton`, `OpenLinkButton`, `DeleteClientButton`

**Admin logic:** `lib/admin/` (`auth`, `client-filter`, `drafts`, `errors`, `form-initial`, `lqip`, `pdf-preview`, `resource-context`, `storage`, `upload`, `upload-rules`, `welcome-link`), `lib/validation.ts`, `lib/slug.ts`, `lib/format.ts`

**Emails and sign-in:** `supabase/templates/{magic-link,confirm-signup}.html`, `supabase/config.toml` (`[auth.email.*]`, `[local_smtp]`, `[auth.rate_limit]`, `[auth.hook.before_user_created]`), `app/(site)/[slug]/{EnterEmail.tsx,EnterEmail.module.css,actions.ts}`, `app/(site)/auth/{confirm/route.ts,expired/page.tsx}`, `components/Notice.*`, `components/ui/controls.module.css`, `lib/email.ts`, `lib/safe-redirect.ts`, `public/vydia-logo.png`, `proxy.ts`

**Docs consulted:** `docs/admin-guide.md`, `docs/iteration-two.md`, `docs/iteration-two-plan.md` (§11 Email, D19/D33/D42), `docs/sign-in-plan.md` (superseded, history), `docs/launch-checklist.md` (Resend/SMTP/template setup), `README.md`, `TASKS.md`
