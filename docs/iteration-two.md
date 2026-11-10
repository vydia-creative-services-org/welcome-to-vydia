# Vydia Onboarding - Goal

## Project Context

Vydia Onboarding is an internal onboarding tool for Vydia's label services team. When a new client signs, label services builds them a personalized "Vydia Onboarding" page in a lightweight admin panel: they enter the client's name, email, and any auxiliary emails (managers, secondary addresses), and choose which resources the client sees. The app generates a unique link, which label services copies and emails to the client from their own inbox. The client opens the link, enters an approved email, receives a magic link, and lands on their resources page.

Today label services uses Seismic, a high-end sales-enablement tool that is overkill for a gated, personalized resource list. We want a simple replacement on Vydia's approved stack.

**What already exists:** a Next.js app that renders the client resources page from Sanity content. Its UI is good; keep it largely as-is. We are deprecating Sanity. Its current resources are the seed data for this app and will be migrated into Supabase once. Nothing else exists yet - no auth, no admin, no per-client pages.

## User Roles

The app has two kinds of users: admins and client users.

**Admin (label services + creative services)** - signs in with Google SSO only. Must have a @vydia.com Google account and be listed in the `admins` table; the app rejects anyone else, Vydia account or not. Admins are added and removed by hand in the Supabase table editor; v1 has no admin-management screen. Label services and creative services have identical permissions — creative services own the product but rarely use it. Admins can create, edit, and delete clients, client emails, client-exclusive resources, and main resources. Account fields: email, display name, avatar (from Google).

**Client user** - anyone whose email an admin has attached to a client: the client, their manager, or an alternate address. Signs in with a magic link only - no passwords, no self-signup. Every email signs in separately with its own magic link. Can view the resources page of each client their email is attached to, and nothing else. Cannot edit anything. An email can belong to more than one client (e.g. a manager with several clients).

Sessions never expire, so returning clients don't need a new magic link each visit. Because sessions are permanent, every page load checks access against the current client–email links, never against anything cached in the session. Removing an email ends that person's access, even with a valid session.

**Clients should never feel "signed in."** No account area, no sign-out button, no profile, no list of other pages they can reach. A URL shows either the resources page or the Enter your email screen - nothing else.

## User Flows

### Admin creates a new client

1. Admin signs in at `/admin` with Google and lands on the client index.
2. Admin clicks **New client**.
3. Admin enters the client name. The slug auto-fills from the name (e.g. "Lil Example" → `lil-example`); the admin can edit it.
4. Admin enters the primary client email and optionally adds auxiliary emails, each with an optional label (Manager, Alt, etc.).
5. Admin reviews the list of all main resources. **Remove** grays a resource out and hides it for this client only; **Restore** brings it back.
6. Admin optionally adds client-exclusive resources (title, type, URL or file, optional cover image, category).
7. Admin clicks **Save**, which saves the client, emails, hides, and exclusive resources together, all or nothing. Admin lands on the client's detail page, with the Welcome link front and center beside a **Copy link** button.
8. Admin pastes the link into their own email to the client.

### Client signs in for the first time

1. Client clicks the link in label services' email (`/[slug]`).
2. Client has no access to this slug yet → sees the **Enter your email** screen.
3. Client enters their email and clicks **Send link**.
4. The server checks whether that email is attached to the client at this slug.
5. **Approved:** Supabase sends a magic link via Resend. "Email sent, check your inbox" replaces the input. A **Resend email** button stays grayed out through a 60-second countdown, then becomes clickable.
6. **Not approved:** the app sends nothing and shows: "This email isn't approved to view this page. Please contact Vydia label services if you're having trouble." The input stays so they can try another email.
7. Client clicks the magic link → session is created → client is redirected to `/[slug]` and sees their resources.

Each auxiliary email repeats this flow independently.

### Returning client

1. Client opens `/[slug]` with a session whose email is still attached to that client → goes straight to resources.

### Client opens a page they can't see

1. Someone opens a `/[slug]` that doesn't exist, belongs to a deleted client, has since been changed, or belongs to a client their session isn't attached to.
2. They see the exact same **Enter your email** screen as on a valid slug - no 404, no "no access" page, no hint whether the client exists.
3. If they enter an email on a slug with no client, they always get the not-approved message from step 6 above, indistinguishable from a wrong email on a real client's slug.
4. If they sign in while holding a session for a different email, the new session replaces the old one.

This stops anyone from guessing slugs to learn which clients are on Vydia.

### Admin edits an existing client

1. Admin opens a client from the index.
2. Admin edits any of name, slug, primary email, auxiliary emails, hidden main resources, and exclusive resources, then clicks **Save**.
3. **Removing an email** revokes access immediately: that person's next page load shows the Enter your email screen.
4. **Changing the slug** breaks the old link. Before saving, the admin sees a warning: "The old link will stop working - send the client the new one." The app keeps no redirects; an old slug behaves like any unknown slug.

### Admin deletes a client

1. On the client detail page, admin clicks **Delete client** and confirms in a dialog.
2. The client, their email links, hides, and exclusive resources are permanently deleted.
3. Anyone whose email was attached only to that client loses all access. The deleted client's slug behaves like any unknown slug and is free to reuse.

### Admin manages main resources

1. Admin opens **Resources** in the admin nav.
2. Admin can create, edit, reorder, and delete main resources. Changes apply to every client immediately.
3. A new main resource appears automatically for every existing client; admins can hide it per client afterward.

## Screens

### Client side

The client side has exactly two states per URL: the resources page or the Enter your email screen.

- **`/[slug]` — Resources page**: Keep the current design: client name at the top, then a scrolling list of resources, each with cover image, title, and type. Shows main resources, minus hidden ones, plus this client's exclusive resources. Toggles between list and grid view; grid view groups by category. No sign-out button, account menu, or links to other clients.
- **`/[slug]` — Enter your email**: Shown on every slug the visitor can't access, whether or not a client exists there. Same visual style as the resources page: a single centered input with the placeholder "Enter your email" and a **Send link** button. Never shows the client's name, which would confirm the client exists.
  - *After an approved email:* "Email sent, check your inbox" replaces the input, plus the 60-second **Resend email** button.
  - *After an unapproved email:* the not-approved message appears under the input, which stays.
- **Magic link expired/used**: "This link has expired" plus a button back to the Enter your email screen for that slug.

### Admin side

- **`/admin/login`**: Single **Sign in with Google** button. Non-admins see "You don't have access."
- **`/admin` — Client index**: Table of all clients. Columns: client name, primary email, number of auxiliary emails, slug, a **Copy link** button, date created. Search by name or email. **New client** button.
- **`/admin/clients/new` — New client**: Single-page form, top to bottom: name, slug, primary email, auxiliary emails (add/remove rows), main resources (with Remove/Restore), exclusive resources (add/edit/delete), Save.
- **`/admin/clients/[id]` — Client detail**: Welcome link at the top with **Copy link**. Below it, the same fields as the new-client form, all editable. **Delete client** at the bottom.
- **`/admin/resources` — Main resources**: All main resources grouped by category, with create, edit, delete, and drag-to-reorder.

### Field constraints

- Client name: required, max 100 chars
- Slug: required, unique, lowercase letters/numbers/hyphens, 3–60 chars
- Emails: valid email format, stored lowercase, no duplicates within one client
- Resource title: required, max 120 chars
- Resource type: one of the allowed values in `/sanity/schema.json`
- Resource URL or file: one required; files and cover images live in Supabase Storage
- Cover image: optional, JPG/PNG/WebP, max 5 MB
- Resource category: required, free text. The input suggests existing categories as you type. Categories match case-insensitively, so "getting started" and "Getting Started" group together.

## Success State

- An admin creates a client with a primary email and two auxiliary emails → the client appears in the index, and each of the three addresses can sign in via magic link and see the same resources page.
- Someone enters an email not attached to the client on that client's slug → they see the not-approved message, no email arrives, and Supabase creates no user.
- A made-up slug (e.g. `/does-not-exist`) → shows the same Enter your email screen as a real slug, and entering any email shows the same not-approved message. Nothing on the page or in the response reveals whether a client exists.
- A user signed in for Client A opens Client B's URL → sees the Enter your email screen, not an error, and never sees B's name or resources.
- An exclusive resource added for Client A → visible on A's page and not on B's.
- An admin hides a main resource for one client → it disappears from that client's page only; every other client still sees it.
- An admin removes an auxiliary email → that person's next page load shows the Enter your email screen, even though their session never expired.
- Both a label services member and a creative services member can sign in to `/admin` with Google; a non-admin Google account is rejected.

## Key Mutations

- **Create client** — inserts the client, client emails, hidden main resources, and exclusive resources in one transaction (RPC).
- **Update client** — name, slug, primary email.
- **Add / remove client email** — removal ends access immediately.
- **Hide / unhide main resource for a client.**
- **Create / update / delete client-exclusive resource.**
- **Delete client** — cascades to emails, hides, and exclusive resources.
- **Create / update / delete / reorder main resource** — admin-only, from the resources index.
- **Seed main resources from Sanity** — one-time migration script.

## Business Rules

- Admins sign in only with Google SSO; client users sign in only with a magic link.
- The app sends a magic link only when the email is attached to the client at the visited slug. The server runs that check before asking Supabase to send anything.
- Every slug renders the same Enter your email screen for a visitor without access, whether or not a client exists. The app never returns a 404 or a "no access" page on the client side.
- An email entered on a slug with no client always gets the not-approved message, exactly as a wrong email on a real client's slug would.
- No self-signup. Client users exist only because an admin added their email.
- A client user can read only the clients their email is attached to, and only those clients' resources. Enforced with Supabase RLS, not just in the UI.
- Every request checks access against the live client–email links, so removing an email takes effect immediately despite non-expiring sessions.
- Exclusive resources belong to exactly one client and are never visible to other clients.
- On a client's page, main resources can only be hidden, not edited. Main resources are edited only on the resources index, and edits affect everyone.
- Slugs are unique across all clients.
- Emails are compared case-insensitively.
- Resend cooldown is 60 seconds per email.

## Constraints

- The client pages must work well on mobile; the admin panel is desktop-first.
- The app sends one email: the magic link. Label services send the Welcome link from their own inbox.
- Single organization (Vydia); no multi-tenancy.
- Stack: Next.js on Vercel, Supabase (database, auth, storage), Resend as Supabase's custom SMTP sender from [sending address, e.g. welcome@vydia.com]. Magic-link email uses Vydia branding.
- The app reads Sanity once, for the migration, and never at runtime.

## Sample Data

The Sanity schema at `/sanity/schema.json` is the source of truth for resource fields and types. The Supabase schema, the TypeScript types, and the migration script must map to it 1:1 — same field names, same allowed types, same required/optional rules. If the sample data below disagrees with the Sanity schema, the schema wins; update the sample data to match. If the schema lacks something this app needs (e.g. category or sort order), add it to the Sanity schema first so the 1:1 mapping holds.

- Client: `{ name: "Lil Example", slug: "lil-example" }`
- Client emails: `{ email: "lil@example.com", label: "Client", is_primary: true }`, `{ email: "manager@mgmt.com", label: "Manager", is_primary: false }`
- Main resource: `{ title: "Vydia Dashboard Walkthrough", type: "video", file: "walkthrough.mp4", category: "Getting Started", coverImage: "walkthrough.jpg", sortOrder: 1 }`
- Exclusive resource: `{ client: "lil-example", title: "Q1 Release Plan", type: "pdf", file: "q1-plan.pdf", category: "Your Releases" }`

## Out of Scope (v1)

- Migrating existing Seismic clients. Label services recreate active clients by hand as needed.
- Analytics on who viewed which resource
- Clients editing their own info or resources
- In-app sending of the Welcome email
- An admin-management screen (admins are managed in Supabase directly)
