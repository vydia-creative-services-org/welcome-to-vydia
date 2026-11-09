# Welcome to Vydia - Goal

## Project Context

Welcome to Vydia is an internal onboarding tool for Vydia's label services team. When a new artist signs with Vydia, label services creates a personalized "Welcome to Vydia" page for them in a lightweight admin panel: they add the artist's name, the artist's email, any auxiliary emails (managers, secondary addresses), and adjust which resources the artist sees. The app generates a unique link that label services copies and emails to the artist themselves (outside the app). The artist opens the link, enters an approved email, receives a magic link, and lands on their personalized resources page.

Today this is done in Seismic, a high-end sales-enablement tool that is overkill for what is essentially a gated, personalized resource list. We want a simple replacement on Vydia's approved stack.

**What already exists:** a Next.js app that renders the artist resources page from content stored in Sanity. The resources page UI is good and should be kept largely as-is. Sanity is being deprecated; its current resources are the seed data for this app and will be migrated into Supabase once. Nothing else (auth, admin, per-artist pages) exists yet.

## User Roles

There are two kinds of users: admins and artist users.

**Admin (label services + creative services)** - signs in with Google SSO only. Must have a @vydia.com Google account and be listed in the `admins` table; anyone else is rejected even with a Vydia account. Admins are added and removed by hand in the Supabase table editor; there is no admin-management screen in v1. Label services and creative services have identical permissions — creative services own the product but rarely use it. Admins can create, edit, and delete artists, artist emails, artist-exclusive resources, and main resources. Admins cannot sign in via magic link. Account fields: email, display name, avatar (from Google).

**Artist user** - anyone whose email has been added to an artist by an admin: the artist themselves, their manager, or an alternate address. Signs in with a passwordless magic link only - no passwords, no self-signup. Every email signs in separately with its own magic link. Can view the resources page of every artist their email is attached to, and nothing else. Cannot edit anything. An email can belong to more than one artist (e.g. a manager handling several artists).

Sessions do not expire, so returning artists don't need a new magic link every visit. Because sessions are permanent, access is checked against the current artist–email links on every page load, never cached in the session - removing an email cuts off access even though the session is still valid.

**Artists should never feel "signed in."** There is no account area, no sign-out button, no profile, and no list of other pages they can reach. A URL either shows the resources page or shows the Enter your email screen - nothing else.

## User Flows

### Admin creates a new artist

1. Admin signs in at `/admin` with Google and lands on the artist index.
2. Admin clicks **New artist**.
3. Admin enters the artist name. The slug auto-fills from the name (e.g. "Lil Example" → `lil-example`) and can be edited.
4. Admin enters the primary artist email and optionally adds auxiliary emails, each with an optional label (Manager, Alt, etc.).
5. Admin reviews the resource list: all main resources are shown. Clicking **Remove** on a main resource grays it out so it is hidden for this artist only. Clicking **Restore** un-hides it.
6. Optionally, admin adds artist-exclusive resources (title, type, URL or file, optional cover image, category).
7. Admin clicks **Save**. The artist, emails, hides, and exclusive resources are saved together (all or nothing). Admin lands on the artist's detail page with the Welcome link shown front and center and a one-click **Copy link** button.
8. Admin pastes the link into their own email to the artist.

### Artist signs in for the first time

1. Artist clicks the link in label services' email (`/[slug]`).
2. No valid access for this slug → artist sees the **Enter your email** screen.
3. Artist enters their email and clicks **Send link**.
4. The server checks whether that email is attached to the artist at this slug.
5. **Approved:** Supabase sends a magic link via Resend. The input is replaced with "Email sent, check your inbox." A **Resend email** button is grayed out with a 60-second countdown, then becomes clickable.
6. **Not approved:** nothing is sent, and the screen shows: "This email isn't approved to view this page. Please contact Vydia label services if you're having trouble." The input stays so they can try another email.
7. Artist clicks the magic link → session is created → artist is redirected to `/[slug]` and sees their resources.

Each auxiliary email repeats this flow independently.

### Returning artist

1. Artist opens `/[slug]` with a session whose email is still attached to that artist → goes straight to resources.

### Artist opens a page they can't see

1. Someone opens `/[slug]` where the slug doesn't exist, belongs to a deleted artist, is an old slug that was changed, or belongs to an artist their current session isn't attached to.
2. They see the exact same **Enter your email** screen as a real, valid slug - no 404, no "no access" page, no hint whether the artist exists.
3. If they enter an email: for a slug with no artist, the response is always the not-approved message from step 6 above, indistinguishable from a real artist with a wrong email.
4. If they sign in via a magic link while already holding a session for a different email, the new session replaces the old one.

This prevents anyone from guessing slugs to find out which artists are on Vydia.

### Admin edits an existing artist

1. Admin opens an artist from the index.
2. Admin can edit name, slug, primary email, auxiliary emails, hidden main resources, and exclusive resources, then clicks **Save**.
3. **Removing an email** revokes access immediately: that person's next page load shows the Enter your email screen.
4. **Changing the slug** breaks the old link. The admin sees a warning before saving ("The old link will stop working - send the artist the new one"). Old slugs are not kept as redirects; an old slug behaves like any unknown slug.

### Admin deletes an artist

1. On the artist detail page, admin clicks **Delete artist** and confirms in a dialog.
2. The artist, their email links, hides, and exclusive resources are permanently deleted.
3. Any user whose email was attached only to that artist can no longer access anything. The deleted artist's slug behaves like any unknown slug and can be reused.

### Admin manages main resources

1. Admin opens **Resources** in the admin nav.
2. Admin can create, edit, reorder, and delete main resources. Changes apply to every artist immediately.
3. A new main resource appears automatically for every existing artist (unless hidden later per artist).

## Screens

### Artist side

The artist side has exactly two states per URL: the resources page or the Enter your email screen.

- **`/[slug]` — Resources page**: Keep the current design. Artist name at the top, scrolling list of resources, each with cover image, title, and type. Shows main resources (minus hidden ones) plus this artist's exclusive resources. Toggle between list and grid view; grid view is grouped by category. No sign-out button, account menu, or links to other artists.
- **`/[slug]` — Enter your email**: Shown for every slug where the visitor doesn't have access, whether or not an artist exists at that slug. Same visual style as the resources page. Centered single input, placeholder "Enter your email", and a **Send link** button. Never shows the artist's name (that would confirm the artist exists).
  - *After an approved email:* input replaced by "Email sent, check your inbox" plus the 60-second **Resend email** button.
  - *After an unapproved email:* not-approved message shown under the input; input stays.
- **Magic link expired/used**: "This link has expired" plus a button back to the Enter your email screen for that slug.

### Admin side

- **`/admin/login`**: Single **Sign in with Google** button. Non-admins see "You don't have access."
- **`/admin` — Artist index**: Table of all artists. Columns: artist name, primary email, number of auxiliary emails, slug, a **Copy link** button, date created. Search by name or email. **New artist** button.
- **`/admin/artists/new` — New artist**: Single-page form, top to bottom: name, slug, primary email, auxiliary emails (add/remove rows), main resources (with Remove/Restore), exclusive resources (add/edit/delete), Save.
- **`/admin/artists/[id]` — Artist detail**: Welcome link at the top with **Copy link**. Below it, the same fields as the new-artist form, all editable. **Delete artist** at the bottom.
- **`/admin/resources` — Main resources**: List of all main resources grouped by category, with create, edit, delete, and drag-to-reorder.

### Field constraints

- Artist name: required, max 100 chars
- Slug: required, unique, lowercase letters/numbers/hyphens, 3–60 chars
- Emails: valid email format, stored lowercase, no duplicates within one artist
- Resource title: required, max 120 chars
- Resource type: one of the allowed values defined in `/sanity/schema.json`
- Resource URL or file: one is required; files and cover images are stored in Supabase Storage
- Cover image: optional, JPG/PNG/WebP, max 5 MB
- Resource category: required, free text. The input suggests existing categories as you type, and categories are matched case-insensitively, so "getting started" and "Getting Started" group together.

## Success State

- An admin creates an artist with a primary email and two auxiliary emails → the artist appears in the index, and all three addresses can each sign in via magic link and see the same resources page.
- An email not attached to the artist enters the login form on that artist's slug → it sees the not-approved message, no email arrives, and no user is created in Supabase.
- A made-up slug (e.g. `/does-not-exist`) → shows the same Enter your email screen as a real slug, and entering any email shows the same not-approved message. Nothing on the page or in the response reveals whether an artist exists.
- A user signed in for Artist A opens Artist B's URL → sees the Enter your email screen, not an error, and never sees B's name or resources.
- An exclusive resource added for Artist A → visible on A's page and not on B's.
- An admin hides a main resource for one artist → it disappears from that artist's page only; every other artist still sees it.
- An admin removes an auxiliary email → that person's next page load shows the Enter your email screen, even though their session never expired.
- Both a label services member and a creative services member can sign in to `/admin` with Google; a non-admin Google account is rejected.

## Key Mutations

- **Create artist** — inserts the artist, artist emails, hidden main resources, and exclusive resources in one transaction (RPC).
- **Update artist** — name, slug, primary email.
- **Add / remove artist email** — removal ends access immediately.
- **Hide / unhide main resource for an artist.**
- **Create / update / delete artist-exclusive resource.**
- **Delete artist** — cascades to emails, hides, and exclusive resources.
- **Create / update / delete / reorder main resource** — admin-only, from the resources index.
- **Seed main resources from Sanity** — one-time migration script.

## Business Rules

- Admins sign in only with Google SSO; artist users sign in only with a magic link.
- A magic link is sent only when the email is attached to the artist at the slug being visited. That check runs on the server, before Supabase is asked to send anything.
- Every slug renders the same Enter your email screen for a visitor without access, whether or not an artist exists. The app never returns a 404 or a "no access" page on the artist side.
- An email entered on a slug with no artist always gets the not-approved message, exactly as a wrong email on a real artist's slug would.
- No self-signup. Artist users exist only because an admin added their email.
- An artist user can read only the artists their email is attached to, and only those artists' resources. Enforced with Supabase RLS, not just in the UI.
- Access is checked against the live artist–email links on every request, so removing an email takes effect immediately despite non-expiring sessions.
- Exclusive resources belong to exactly one artist and are never visible to other artists.
- On an artist's page, main resources can only be hidden, not edited. Editing a main resource happens only on the resources index and affects everyone.
- Slugs are unique across all artists.
- Emails are compared case-insensitively.
- Resend cooldown is 60 seconds per email.

## Constraints

- The artist pages must work well on mobile; the admin panel is desktop-first.
- The only email the app sends is the magic link. Label services send the Welcome link themselves from their own inbox.
- Single organization (Vydia); no multi-tenancy.
- Stack: Next.js on Vercel, Supabase (database, auth, storage), Resend as Supabase's custom SMTP sender from [sending address, e.g. welcome@vydia.com]. Magic-link email uses Vydia branding.
- Sanity is read only once, for the migration; the app has no runtime dependency on Sanity.

## Sample Data

The Sanity schema at `/sanity/schema.json` is the source of truth for resource fields and types. The Supabase schema, the TypeScript types, and the migration script must map to it 1:1 — same field names, same allowed types, same required/optional rules. If the sample data below disagrees with the Sanity schema, the Sanity schema wins and the sample data should be updated to match. If the Sanity schema itself is missing something this app needs (e.g. category or sort order), add it to the Sanity schema first so the 1:1 mapping holds.

- Artist: `{ name: "Lil Example", slug: "lil-example" }`
- Artist emails: `{ email: "lil@example.com", label: "Artist", is_primary: true }`, `{ email: "manager@mgmt.com", label: "Manager", is_primary: false }`
- Main resource: `{ title: "Vydia Dashboard Walkthrough", type: "video", url: "https://...", category: "Getting Started", cover_image: "walkthrough.jpg", sort_order: 1 }`
- Exclusive resource: `{ artist: "lil-example", title: "Q1 Release Plan", type: "pdf", file: "q1-plan.pdf", category: "Your Releases" }`

## Out of Scope (v1)

- Migrating existing Seismic artists. Label services recreate active artists by hand as needed.
- Analytics on who viewed which resource
- Artists editing their own info or resources
- In-app sending of the Welcome email
- An admin-management screen (admins are managed in Supabase directly)
