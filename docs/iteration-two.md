# Welcome to Vydia

## Project Context

Welcome to Vydia is an internal onboarding tool for Vydia's label services team. When a new artist signs with Vydia, label services creates a personalized "Welcome to Vydia" page for them in a lightweight admin panel: they add the artist's name, the artist's email, any auxiliary emails (managers, secondary addresses), and adjust which resources the artist sees. The app generates a unique link that label services copies and emails to the artist themselves (outside the app). The artist opens the link, enters an approved email, receives a magic link, and lands on their personalized resources page.

Today this is done in Seismic, a high-end sales-enablement tool that is overkill for what is essentially a gated, personalized resource list. We want a simple replacement on Vydia's approved stack.

**What already exists:** a Next.js app that renders the artist resources page from content stored in Sanity. The resources page UI is good and should be kept largely as-is. Sanity is being deprecated; its current resources are the seed data for this app and will be migrated into Supabase once. Nothing else (auth, admin, per-artist pages) exists yet.

## User Roles

There are two kinds of users: admins and artist users.

**Admin (label services + creative services)** - signs in with Google SSO only. Must have a @vydia.com Google account and be listed in the `admins` table; anyone else is rejected even with a Vydia account. Admins are added and removed by hand in the Supabase table editor; there is no admin-management screen in v1. Label services and creative services have identical permissions — creative services own the product but rarely use it. Admins can create, edit, and delete artists, artist emails, artist-exclusive resources, and main resources. Admins cannot sign in via magic link. Account fields: email, display name, avatar (from Google).

**Artist user** - anyone whose email has been added to an artist by an admin: the artist themselves, their manager, or an alternate address. Signs in with a passwordless magic link only so no passwords and no self-signup. Every email signs in separately with its own magic link. Can view the resources page of every artist their email is attached to, and nothing else. Cannot edit anything. Sessions do not expire so returning artists don't need a new magic link every visit. An email can belong to more than one artist (e.g. a manager handling several artists).

## User Flows

### Admin creates a new artist

1. Admin signs in at `/admin` with Google and lands on the artist index.
2. Admin clicks **New artist**.
3. Admin enters the artist name. The slug auto-fills from the name (e.g. "Lil Example" → `lil-example`) and can be edited.
4. Admin enters the primary artist email and optionally adds auxiliary emails, each with an optional label (Manager, Alt, etc.).
5. Admin reviews the resource list: all main resources are shown. Clicking *Remove* on a main resource grays it out so it is hidden for this artist only. Clicking *Restore* un-hides it.
6. Optionally, admin adds artist-exclusive resources (title, type, URL or file, optional cover image, category).
7. Admin clicks **Save**. The artist, emails, hides, and exclusive resources are saved together (all or nothing). Admin lands on the artist's detail page with the Welcome link shown front and center and a one-click **Copy link** button.
8. Admin pastes the link into their own email to the artist.

### Artist signs in for the first time

1. Artist clicks the link in label services' email (`/[slug]`).
2. Not signed in → artist sees the **Enter your email** screen.
3. Artist enters their email and clicks **Send link**.
4. The input is replaced with "Email sent, check your inbox." A **Resend email** button is grayed out with a 60-second countdown, then becomes clickable.
5. If the email is approved for this artist, Supabase sends a magic link via Resend. If not, nothing is sent and a message saying this email is not approved to view this profile, please contact Vyida label services if you are having any trouble.
5. Artist clicks the magic link → session is created → artist is redirected to `/[slug]` and sees their resources.

Each auxiliary email repeats this flow independently.

[comment: every slug should return a enter your emial screen even if the artist doesnt exist, no 404 beucase we dont want people trying different slugs to see if that artist is associated with our record label or whatnot]

### Returning artist

1. Artist opens `/[slug]` → goes straight to resources.

### Admin edits an existing artist

1. Admin opens an artist from the index.
2. Admin can edit name, slug, primary email, auxiliary emails, hidden main resources, and exclusive resources, then clicks **Save**.
3. **Removing an email** revokes access immediately: that person's next page load returns them to the Enter your email screen.
4. **Changing the slug** breaks the old link. The admin sees a warning before saving ("The old link will stop working, send the artist the new one"). Old slugs are not kept as redirects.

### Admin deletes an artist

1. On the artist detail page, admin clicks **Delete artist** and confirms in a dialog.
2. The artist, their email links, hides, and exclusive resources are permanantly deleted.
3. Any user whose email was attatched only to that artsit can no longer access anything.

### Admin manages main resources

1. Admin opens **Resources** in the admin nav.
2. Admin can create, edit, reorder, and delete main resources. Changes apply to every artist immediately.
3. A new main resource appears automatically for every existing artist (unless hidden later per artist).

## Screens

### Artist side

- **/[slug] - Resources page**: Keep the current design. Artist name at the top, scrolling list of resources, each with cover image, title, and type. Shows main resources (minus hidden ones) plus this artist's exclusive resources. Toggle between list and grid view. Grid view shoudl be grouped by category.
- **/[slug] (signed out) - Enter your email**: Same visual style as the resources page. Centered single input, placeholder "Enter your email", and a Send link button. After submit: input replaced by the sent message plus the 60-second Resend email button.
- **Not approved for this slug**: Shows "You don't have access to this page"
- **Magic link expired/used**: "This link has expired" plus a button back to the Enter your email screen.
- **Unknown slug**: Standard 404.

[comment: every slug should return a enter your emial screen even if the artist doesnt exist, no 404 beucase we dont want people trying different slugs to see if that artist is associated with our record label or whatnot]

[comment: artists shouldnt feel "signed in", there shoudl be no list of pages that managers have access to ont he artist side, they jsut enter or go to the URL and they see it or dont see it (plus the enter emails tuff])]

### Admin side

- **/admin/login**: Single **Sign in with Google button**. Non-admins see "You don't have access."
- **/admin — Artist index**: Table of all artists. Columns: artist name, primary email, number of auxiliary emails, slug, a **Copy link** button, date created. Search by name or email. **New artist** button.
- **/admin/artists/new - New artist**: Single-page form, top to bottom: name, slug, primary email, auxiliary emails (add/remove rows), main resources (with Remove/Restore), exclusive resources (add/edit/delete), Save.
- **/admin/artists/[id] - Artist detail**: Welcome link at the top with Copy link. Below it, the same fields as the new-artist form, all editable. Delete artist at the bottom.
- **/admin/resources - Main resources**: List of all main resources grouped by category, with create, edit, delete, and drag-to-reorder.

### Field constraints

- Artist name: required, max 100 chars
- Slug: required, unique, lowercase letters/numbers/hyphens, 3–60 chars
- Emails: valid email format, stored lowercase, no duplicates within one artist
- Resource title: required, max 120 chars
- Resource type: one of [paste allowed values from the Sanity schema — e.g. link, pdf, video]
- Resource URL or file: one is required; files and cover images are stored in Supabase Storage
- Cover image: optional, JPG/PNG/WebP, max 5 MB
- Resource Category: required, free text

## Success State

- An admin creates an artist with a primary email and two auxiliary emails → the artist appears in the index, and all three addresses can each sign in via magic link and see the same resources page.
- An email that isn't on any artist enters the login form → it sees "Email sent," but no email arrives and no user is created in Supabase.
- An exclusive resource added for Artist A → visible on A's page and not on B's, even when A's user opens B's URL directly.
- An admin hides a main resource for one artist → it disappears from that artist's page only; every other artist still sees it.
- An admin removes an auxiliary email → that person's next page load returns them to the Enter your email screen.
- Both a label services member and a creative services member can sign in to `/admin` with Google; a non-admin Google account is rejected.

## Key Mutations

- **Create artist** - inserts the artist, artist emails, hidden main resources, and exclusive resources in one transaction (RPC).
- **Update artist** - name, slug, primary email.
- **Add / remove artist email** - removal ends access immediately.
- **Hide / unhide main resource for an artist**.
- **Create / update / delete artist-exclusive resource**.
- **Delete artist** - cascades to emails, hides, and exclusive resources.
- **Create / update / delete / reorder main resource** - admin-only, from the resources index.
- **Seed main resources from Sanity** - one-time migration script.

## Business Rules

- Admins sign in only with Google SSO; artist users sign in only with a magic link.
- Magic links are only sent to emails attached to at least one artist. The login screen responds identically either way.
- No self-signup. Artist users exist only because an admin added their email.
- An artist user can read only the artists their email is attached to, and only those artists' resources. Enforced with Supabase RLS, not just in the UI.
- Exclusive resources belong to exactly one artist and are never visible to other artists.
- On an artist's page, main resources can only be hidden, not edited. Editing a main resource happens only on the resources index and affects everyone.
- Slugs are unique across all artists.
- Emails are compared case-insensitively.
- Resend cooldown is 60 seconds per email.

## Constraints

- The artist pages must work well on mobile; the admin panel is desktop-first.
- The only email the app sends is the magic link. Label services send the Welcome link themselves from their own inbox.
- Single organization (Vydia); no multi-tenancy.
- Stack: Next.js on Vercel, Supabase (database, auth, storage), Resend as Supabase's custom SMTP sender from [sending domain, e.g. welcome@vydia.com]. Magic-link email uses Vydia branding.
- Sanity is read only once, for the migration; the app has no runtime dependency on Sanity.

## Sample Data

- Artist: { name: "Lil Example", slug: "lil-example" }
- Artist emails: { email: "lil@example.com", label: "Artist", is_primary: true }, { email: "manager@mgmt.com", label: "Manager", is_primary: false }
- Main resource: { title: "Vydia Dashboard Walkthrough", type: "video", url: "https://...", category: "Getting Started", cover_image: "walkthrough.jpg", sort_order: 1 }
- Exclusive resource: { artist: "lil-example", title: "Q1 Release Plan", type: "pdf", file: "q1-plan.pdf", category: "Your Releases" }
- Sanity Schema: /sanity/schema.json

[make sure sanity schema and sample data are aligned, sanity data can be soruce of truth and you can edit sanity stuff if neccesary. migration and types should map 1:1]

## Out of Scope

- Migrating existing Seismic artists. Label services recreate active artists by hand as needed.
- Analytics on who viewed which resource
- Artists editing their own info or resources
- In-app sending of the Welcome email
