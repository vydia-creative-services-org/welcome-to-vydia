# Plan: Super admins and regular admins

## Goal

Split today's single admin role into two:

| Capability                                      | Super admin                        | Regular admin                         |
| ----------------------------------------------- | ---------------------------------- | ------------------------------------- |
| See the client list                             | Every client                       | Only clients assigned to them         |
| Open a client's admin page / public `/[slug]`   | Every client                       | Only clients assigned to them         |
| Create a client                                 | Yes (assigned to them by default)  | Yes (always assigned to them)         |
| Edit / delete a client, its emails, its hides   | Any client                         | Only clients assigned to them         |
| Add / edit client-specific resources            | Any client                         | Only clients assigned to them         |
| View core resources (`/admin/resources`)        | Yes                                | Yes, read-only                        |
| Add / edit / delete / reorder core resources    | Yes                                | **No**                                |
| Reassign a client to another admin              | Yes                                | No                                    |

Definitions:

- **Core resource**: a row in `public.resources` with `client_id is null`. Every client sees these unless that client hides them. The code calls these "main resources".
- **Client-specific resource**: a row with `client_id = <client>`. Only that client's page shows it. This already works (`get_client_page` and `resources_read` scope it). The new part is limiting **which admins** can see and edit it.
- **Assigned**: a client is assigned to the admin who created it. Super admins can reassign it later.

Super admins at launch:

- `mason.omara@vydia.com`
- `erica.johnson@vydia.com`
- `chris.maltese@vydia.com` (head of label ops)

Everyone else in `public.admins` is a regular admin.

Confirmed decisions:

- Regular admins **can** hide core resources on their own clients' pages.
- Regular admins **can** delete their own clients.
- A client has **exactly one** assigned admin (or none, meaning only super admins see it).
- **All existing clients are assigned to `mason.omara@vydia.com`** at migration time. Super admins reassign them to reps afterwards.

---

## Where things stand

Everything that matters here is enforced in Postgres through RLS and `security definer` helpers. The Next.js layer just calls Supabase with the user's own session (`lib/supabase/server.ts`), so **most of this feature lives in one migration.** The app changes are mainly about UI and clearer error messages.

What exists today (after `20261110215541_rename_artist_to_client.sql`):

- `public.admins (email pk, display_name, avatar_url, user_id, …)`: a flat list with no role.
- `public.is_admin()`: true for a listed `@vydia.com` email signed in with Google OAuth.
- `public.can_view_client(id)`: `is_admin()` or the user's email is on the client.
- `public.clients.created_by uuid → auth.users`: already set by `save_client` to `auth.uid()`.
- Every write policy (`clients_*`, `emails_admin_all`, `resources_*`, `hides_admin_write`) checks only `is_admin()`.
- `reorder_main_resources`, `save_client`, and `take_storage_garbage` check only `is_admin()`.
- Storage policy `"admins manage resource objects"` gives every admin `ALL` on both buckets.
- `lib/admin/auth.ts#getAdmin` reads `admins` with **no filter** and expects one row. That works only because the `admins_self` policy hides everyone else's row. **This will break once super admins can read the whole table.**

---

## Design decisions

1. **Role lives on `public.admins` as an enum column** (`'super' | 'regular'`, default `'regular'`). Roles are managed by hand in the Supabase table editor, the same way admins are today. No in-app role UI in v1. Admins can't promote themselves: no policy grants `update` on `admins` to `authenticated`, and `claim_admin_profile()` only touches profile fields.

2. **Assignment is a new column, `clients.assigned_admin → admins.email`**, not a reuse of `created_by`.
   - `created_by` points at `auth.users.id`, and `admins.user_id` stays null until an admin's first sign-in, so a super admin couldn't assign a client to someone who hasn't signed in yet.
   - Keying on email matches how `admins` is keyed and how `is_admin()` identifies the caller (`jwt_email()`).
   - `on delete set null`: if an admin is removed, their clients become visible to super admins only, and a super admin can reassign them.
   - `created_by` stays as an audit field.
   - One owner per client (confirmed). A single nullable column is enough, so no join table is needed.

3. **One new helper, `can_manage_client(id)`, used by every client-scoped policy.** `can_view_client()` is rewritten in terms of it, so the public `/[slug]` page and the admin pages pick up the restriction with no app changes.

4. **Core resources are writable only by super admins.** `resources_insert/update/delete` become `is_super_admin() or (client_id is not null and can_manage_client(client_id))`. The `with check` on update also stops a regular admin from changing a resource's `client_id` to `null` to turn it into a core resource.

5. **Regular admins can still hide core resources on their own clients (confirmed).** Hiding is part of a client's configuration (`client_hidden_resources`), not an edit to the core resource. `hides_admin_write` is scoped by `can_manage_client(client_id)`, so a regular admin can hide or restore core resources only on clients assigned to them.

6. **Regular admins can delete their own clients (confirmed).** `clients_delete` uses `can_manage_client(id)`. Deleting a client cascades to its emails, hides, and client-specific resources, and their files go through the existing garbage queue.

6. **Storage deletes move to the service role.** Regular admins need to upload files for client-specific resources, but they shouldn't be able to delete arbitrary objects (such as a core resource's PDF) through the Storage API. Admins keep `insert` on storage. `delete`/`update` become super-admin-only. `sweepStorage()` still pulls the garbage queue through the user's session (`take_storage_garbage` is admin-gated), then deletes those exact paths with the service client.

---

## 1. Migration

New file: `supabase/migrations/<timestamp>_admin_roles.sql`. Create it with `supabase migration new admin_roles`.

```sql
-- Two admin roles. Super admins see and edit everything. Regular admins see only the clients
-- assigned to them, and can read but not edit core (client_id is null) resources.

------------------------------------------------------------------------------------------------
-- Schema
------------------------------------------------------------------------------------------------

create type public.admin_role as enum ('super', 'regular');

alter table public.admins
  add column role public.admin_role not null default 'regular';

comment on column public.admins.role is
  'super = sees every client and edits core resources. regular = sees assigned clients only. Set by hand.';

-- Add the column without a default first. A stable default like jwt_email() would be evaluated
-- once at ALTER time (null in a migration) and stamped onto every existing row.
alter table public.clients
  add column assigned_admin public.email_address
    references public.admins (email) on update cascade on delete set null;

create index clients_assigned_admin on public.clients (assigned_admin);

------------------------------------------------------------------------------------------------
-- Seed super admins and backfill assignments
------------------------------------------------------------------------------------------------

insert into public.admins (email, role) values
  ('mason.omara@vydia.com',   'super'),
  ('erica.johnson@vydia.com', 'super'),
  ('chris.maltese@vydia.com', 'super')   -- head of label ops
on conflict (email) do update set role = 'super';

-- Every existing client goes to Mason, whoever created it. Super admins can reassign them
-- to individual reps from the client page after deploy. The insert above guarantees the
-- admins row exists, so the foreign key holds.
update public.clients
   set assigned_admin = 'mason.omara@vydia.com'
 where assigned_admin is null;

-- From now on, a new client defaults to the admin who inserts it.
alter table public.clients alter column assigned_admin set default public.jwt_email();

------------------------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------------------------

create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
     and exists (select 1 from public.admins a
                  where a.email = public.jwt_email() and a.role = 'super')
$$;

create function public.can_manage_client(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or (public.is_admin()
          and exists (select 1 from public.clients c
                       where c.id = target and c.assigned_admin = public.jwt_email()))
$$;

-- Admins now only "view" the clients they can manage. Client users are unchanged.
create or replace function public.can_view_client(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_manage_client(target)
      or exists (select 1 from public.client_emails ce
                  where ce.client_id = target and ce.email = public.jwt_email())
$$;

revoke execute on function public.is_super_admin(), public.can_manage_client(uuid) from public, anon;
grant  execute on function public.is_super_admin(), public.can_manage_client(uuid) to authenticated, service_role;

------------------------------------------------------------------------------------------------
-- Policies
------------------------------------------------------------------------------------------------

-- admins: everyone still reads their own row. Super admins can read the full list
-- (for the owner column and the reassign dropdown).
create policy admins_super_read on public.admins for select to authenticated
  using (public.is_super_admin());

-- clients
drop policy clients_insert on public.clients;
drop policy clients_update on public.clients;
drop policy clients_delete on public.clients;

-- A regular admin can only create clients assigned to themselves.
create policy clients_insert on public.clients for insert to authenticated
  with check (public.is_super_admin()
              or (public.is_admin() and assigned_admin = public.jwt_email()));

-- `with check` uses the column, not can_manage_client(id). That helper would re-read the
-- pre-update row, which would let a regular admin hand a client to someone else.
create policy clients_update on public.clients for update to authenticated
  using (public.can_manage_client(id))
  with check (public.is_super_admin()
              or (public.is_admin() and assigned_admin = public.jwt_email()));

create policy clients_delete on public.clients for delete to authenticated
  using (public.can_manage_client(id));
-- clients_read already uses can_view_client(id), which is now restricted.

-- client_emails
drop policy emails_admin_all on public.client_emails;
create policy emails_admin_all on public.client_emails for all to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

-- client_hidden_resources
drop policy hides_admin_write on public.client_hidden_resources;
create policy hides_admin_write on public.client_hidden_resources for all to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));
-- hides_read already uses can_view_client(client_id).

-- resources
drop policy resources_read   on public.resources;
drop policy resources_insert on public.resources;
drop policy resources_update on public.resources;
drop policy resources_delete on public.resources;

create policy resources_read on public.resources for select to authenticated using (
     (client_id is null and public.is_admin())                       -- every admin reads core
  or (client_id is not null and public.can_view_client(client_id))   -- managed client / own client
  or (client_id is null and public.can_view_main_resource(id))       -- client users, minus hides
);

create policy resources_insert on public.resources for insert to authenticated
  with check (public.is_super_admin()
              or (client_id is not null and public.can_manage_client(client_id)));

create policy resources_update on public.resources for update to authenticated
  using      (public.is_super_admin() or (client_id is not null and public.can_manage_client(client_id)))
  with check (public.is_super_admin() or (client_id is not null and public.can_manage_client(client_id)));

create policy resources_delete on public.resources for delete to authenticated
  using (public.is_super_admin() or (client_id is not null and public.can_manage_client(client_id)));

------------------------------------------------------------------------------------------------
-- Storage
------------------------------------------------------------------------------------------------

drop policy "admins manage resource objects" on storage.objects;

-- Any admin can upload (signed upload URLs need insert). The upload only matters once a
-- resources row points at it, and the resources policies above decide that.
create policy "admins upload resource objects" on storage.objects for insert to authenticated
  with check (bucket_id in ('resource-files', 'resource-images') and public.is_admin());

-- Only super admins touch existing objects directly. Regular cleanup goes through
-- take_storage_garbage() + the service role (see lib/admin/storage.ts).
create policy "super admins manage resource objects" on storage.objects for all to authenticated
  using      (bucket_id in ('resource-files', 'resource-images') and public.is_super_admin())
  with check (bucket_id in ('resource-files', 'resource-images') and public.is_super_admin());

-- "viewers read visible files" stays as is. It reads through resources RLS, so a regular
-- admin can sign URLs for core files and their own clients' files, nothing else.

------------------------------------------------------------------------------------------------
-- Functions
------------------------------------------------------------------------------------------------

create or replace function public.reorder_main_resources(ids uuid[]) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.resources r set sort_order = o.ord::integer
    from unnest(ids) with ordinality as o(id, ord)
   where r.id = o.id and r.client_id is null;
end $$;

-- save_client: same body as 20261110215541, with an explicit ownership check so a regular admin
-- editing someone else's client gets "not found" (P0002), the same as a missing id.
-- Only the top of the function changes. Copy the rest of the body unchanged.
create or replace function public.save_client(payload jsonb) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_id     uuid := nullif(payload ->> 'id', '')::uuid;
  v_emails jsonb := coalesce(payload -> 'emails', '[]'::jsonb);
  v_hidden jsonb := coalesce(payload -> 'hiddenResourceIds', '[]'::jsonb);
  v_excl   jsonb := coalesce(payload -> 'exclusiveResources', '[]'::jsonb);
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_id is not null and not public.can_manage_client(v_id) then
    raise exception 'client not found' using errcode = 'P0002';
  end if;

  -- … validation unchanged …

  if v_id is null then
    -- assigned_admin falls back to its default (jwt_email()). Spelled out here for clarity.
    insert into public.clients (name, slug, created_by, assigned_admin)
    values (btrim(payload ->> 'name'), payload ->> 'slug', auth.uid(), public.jwt_email())
    returning id into v_id;
  else
    update public.clients
       set name = btrim(payload ->> 'name'), slug = payload ->> 'slug'
     where id = v_id;
    if not found then
      raise exception 'client not found' using errcode = 'P0002';
    end if;
  end if;

  -- … emails / hides / exclusive resources unchanged …
  return v_id;
end $$;

notify pgrst, 'reload schema';
```

> **Note on `save_client`:** Its exclusive-resource upsert ends with `on conflict (id) do update … where t.client_id = v_id`. That already stops a regular admin from overwriting a core resource by reusing its id: the `where` filters it out, and the new `resources_update` policy would block it anyway.

After the migration, run `npm run db:types` to regenerate `lib/supabase/database.types.ts`. That adds `admin_role`, `admins.role`, and `clients.assigned_admin`.

---

## 2. Auth helper: `lib/admin/auth.ts`

`getAdmin()` has to filter by the caller's email, since super admins can now read every `admins` row and `.maybeSingle()` would error. It should also return the role.

```ts
import 'server-only'
import {redirect} from 'next/navigation'
import {cache} from 'react'
import type {Database} from '@/lib/supabase/database.types'
import {createClient} from '@/lib/supabase/server'

export type AdminRole = Database['public']['Enums']['admin_role']

export const getAdmin = cache(async () => {
  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  const email = typeof auth?.claims?.email === 'string' ? auth.claims.email.toLowerCase() : null
  if (!email) return null

  const {data: admin} = await supabase
    .from('admins')
    .select('email, display_name, avatar_url, role')
    .eq('email', email)
    .maybeSingle()
  if (!admin) return null

  return {supabase, admin, isSuper: admin.role === 'super'}
})

export type AdminSession = NonNullable<Awaited<ReturnType<typeof getAdmin>>>

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdmin()
  if (session) return session
  const supabase = await createClient()
  const {data: auth} = await supabase.auth.getClaims()
  redirect(auth?.claims ? '/admin/login?error=no-access' : '/admin/login')
}

/** For pages only. Server actions should return a typed error instead of redirecting. */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin()
  if (!session.isSuper) redirect('/admin')
  return session
}
```

RLS is the real enforcement. Every app-side role check below exists to give a clear error message or hide a control, not as the security boundary.

---

## 3. Server actions

### `app/(admin)/admin/(panel)/resources/actions.ts`

Add an early super-admin check to all three actions:

```ts
const SUPER_ONLY = 'Only super admins can change core resources.'

export async function upsertMainResource(input: ResourceInputValue): Promise<ResourceResult> {
  const {supabase, isSuper} = await requireAdmin()
  if (!isSuper) return {ok: false, errors: {form: SUPER_ONLY}}
  // … unchanged …
}

export async function deleteMainResource(id: string): Promise<{ok: boolean}> {
  const {supabase, isSuper} = await requireAdmin()
  if (!isSuper) return {ok: false}
  // … unchanged …
}

export async function reorderMainResources(ids: string[]): Promise<{ok: boolean}> {
  const {supabase, isSuper} = await requireAdmin()
  if (!isSuper) return {ok: false}
  // … unchanged …
}
```

### `app/(admin)/admin/(panel)/clients/actions.ts`

`saveClient` and `deleteClient` need no logic changes. RLS and `save_client` handle ownership. Two small fixes:

1. `deleteClient` currently treats "0 rows deleted" as success. Under RLS, a regular admin deleting someone else's client deletes nothing with no error. Ask for the deleted id back and check it:

   ```ts
   export async function deleteClient(id: string): Promise<{ok: false; message: string}> {
     const {supabase} = await requireAdmin()
     const {data, error} = await supabase.from('clients').delete().eq('id', id).select('id')
     if (error || !data?.length) return {ok: false, message: 'Couldn’t delete the client. Nothing was changed.'}
     await sweepStorage(supabase)
     redirect('/admin')
   }
   ```

2. Map `P0002` from `save_client` to a friendly form error in `lib/admin/errors.ts`, e.g. "This client no longer exists or isn’t assigned to you."

Add a new reassign action:

```ts
const assignInput = z.object({clientId: z.uuid(), adminEmail: z.email().nullable()})

export async function assignClient(input: z.input<typeof assignInput>): Promise<{ok: boolean; message?: string}> {
  const {supabase, isSuper} = await requireAdmin()
  if (!isSuper) return {ok: false, message: 'Only super admins can reassign clients.'}
  const parsed = assignInput.safeParse(input)
  if (!parsed.success) return {ok: false, message: 'That isn’t a valid admin.'}

  const {data, error} = await supabase
    .from('clients')
    .update({assigned_admin: parsed.data.adminEmail?.toLowerCase() ?? null})
    .eq('id', parsed.data.clientId)
    .select('id')
  if (error || !data?.length) return {ok: false, message: 'Couldn’t reassign the client.'}
  refresh()
  return {ok: true}
}
```

### `app/(admin)/admin/(panel)/uploads/actions.ts`

Storage RLS can't tell whether an upload is meant for a core or a client resource, because the path is only `${resourceId}/…`. Rejecting obvious misuse here keeps orphaned files to a minimum. `scripts/storage-sweep.ts` already cleans up anything that gets through.

```ts
export async function createUploadTarget(input: UploadRequest): Promise<UploadTarget> {
  const {supabase, isSuper} = await requireAdmin()
  // … parse as today …

  if (!isSuper) {
    const {data: existing} = await supabase
      .from('resources')
      .select('client_id')
      .eq('id', request.resourceId)
      .maybeSingle()
    if (existing && existing.client_id === null) {
      return {ok: false, message: 'Only super admins can change core resources.'}
    }
  }
  // … unchanged …
}
```

### `lib/admin/storage.ts`

Regular admins lose storage `delete`, so the actual removal moves to the service client. The garbage queue is still claimed through the user's session, which keeps it admin-gated.

```ts
import 'server-only'
import type {ServerClient} from '@/lib/supabase/server'
import {createServiceClient} from '@/lib/supabase/service'

export async function sweepStorage(supabase: ServerClient) {
  const {data, error} = await supabase.rpc('take_storage_garbage')
  if (error || !data?.length) return
  const byBucket = new Map<string, string[]>()
  for (const {bucket, path} of data) byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path])

  const service = createServiceClient()
  for (const [bucket, paths] of byBucket) {
    const {error: removeError} = await service.storage.from(bucket).remove(paths)
    if (removeError) console.error(`storage cleanup failed for ${bucket}:`, removeError.message)
  }
}
```

`SUPABASE_SECRET_KEY` is already required in production for the magic-link flow (`email_can_access_slug`), so this adds no new env var.

---

## 4. Pages and components

### Panel layout: `app/(admin)/admin/(panel)/layout.tsx`

Pass the role to the nav and show a small badge next to the name:

```tsx
const {admin, isSuper} = await requireAdmin()
// …
<AdminNav />
<div className={styles.me}>
  {/* avatar */}
  <span className={styles.name}>{name}</span>
  {isSuper && <span className={styles.roleBadge}>Super admin</span>}
  {/* sign out */}
</div>
```

The "Resources" nav link stays for everyone, since regular admins can view core resources.

### Client list: `app/(admin)/admin/(panel)/page.tsx`

The query needs no change, because RLS already returns only the caller's clients. For super admins, add an owner column and a "Mine / All" filter:

```tsx
export default async function ClientIndex() {
  const {supabase, admin, isSuper} = await requireAdmin()
  const {data} = await supabase
    .from('clients')
    .select(
      'id, name, slug, created_at, assigned_admin, owner:admins!clients_assigned_admin_fkey(display_name), client_emails(email, is_primary)',
    )
    .order('created_at', {ascending: false})

  const rows = (data ?? []).map((client) => ({
    // … existing fields …
    owner: client.owner?.display_name ?? client.assigned_admin ?? null,
    isMine: client.assigned_admin === admin.email,
  }))

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{isSuper ? 'Clients' : 'Your clients'}</h1>
        {/* New client link unchanged */}
      </header>
      <ClientTable rows={rows} showOwner={isSuper} />
    </>
  )
}
```

The `owner` embed returns `null` for regular admins (they can only read their own `admins` row), which is fine because they don't see the column.

`components/admin/ClientTable.tsx`:

- Add `owner: string | null` and `isMine: boolean` to `ClientRow`, plus a `showOwner` prop.
- When `showOwner` is set, render an "Owner" column (show "Unassigned" for null) and a segmented control above the table: **All** / **Mine** / **Unassigned**.
- Include `owner` in the search haystack.
- Update the regular-admin empty state: "No clients assigned to you yet."

### Client detail: `app/(admin)/admin/(panel)/clients/[id]/page.tsx`

The existing `notFound()` already covers an unassigned client, because RLS returns no row. For super admins, add a reassign control in the header:

```tsx
const {supabase, isSuper} = await requireAdmin()

const [{data: client, error}, context, {data: admins}] = await Promise.all([
  supabase.from('clients').select('id, name, slug, updated_at, assigned_admin, client_emails(...), ...').eq('id', id).maybeSingle(),
  loadResourceContext(supabase),
  isSuper
    ? supabase.from('admins').select('email, display_name').order('display_name')
    : Promise.resolve({data: null}),
])
// …
{isSuper && admins && (
  <AssignAdminSelect clientId={client.id} current={client.assigned_admin} admins={admins} />
)}
```

New `components/admin/AssignAdminSelect.tsx` (client component):

```tsx
'use client'
import {useState, useTransition} from 'react'
import {assignClient} from '@/app/(admin)/admin/(panel)/clients/actions'
import controls from './controls.module.css'

type Props = {
  clientId: string
  current: string | null
  admins: {email: string; display_name: string | null}[]
}

export function AssignAdminSelect({clientId, current, admins}: Props) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <label className={controls.field}>
      <span className={controls.label}>Assigned to</span>
      <select
        className={controls.input}
        defaultValue={current ?? ''}
        disabled={pending}
        onChange={(event) => {
          const adminEmail = event.target.value || null
          start(async () => {
            const result = await assignClient({clientId, adminEmail})
            setMessage(result.ok ? 'Reassigned' : (result.message ?? 'Couldn’t reassign.'))
          })
        }}
      >
        <option value="">Unassigned (super admins only)</option>
        {admins.map((admin) => (
          <option key={admin.email} value={admin.email}>
            {admin.display_name ?? admin.email}
          </option>
        ))}
      </select>
      {message && <span role="status" className={controls.hint}>{message}</span>}
    </label>
  )
}
```

The client's own form (`ClientForm`) needs no change. Its core resource section only offers Remove/Restore (hides), and regular admins keep that ability on their own clients. Its "Client specific" section writes through `save_client`, which is now ownership-checked.

### Core resources: `app/(admin)/admin/(panel)/resources/page.tsx` and `SortableResourceList`

Render read-only for regular admins:

```tsx
export default async function MainResources() {
  const {supabase, isSuper} = await requireAdmin()
  const {mainResources, categories} = await loadResourceContext(supabase)
  return (
    <>
      {!isSuper && (
        <p className={controls.hint} role="note">
          Core resources appear on every client page. Only super admins can change them. You can hide one
          for a specific client from that client’s page.
        </p>
      )}
      <SortableResourceList groups={groupByCategory(mainResources)} categories={categories} canEdit={isSuper} />
    </>
  )
}
```

`components/admin/SortableResourceList.tsx`:

```tsx
type Props = {groups: Groups; categories: string[]; canEdit: boolean}

export function SortableResourceList({groups, categories, canEdit}: Props) {
  // …
  if (!canEdit) return <ReadOnlyResourceList groups={optimisticGroups} />
  // … existing DnD tree unchanged …
}

function ReadOnlyResourceList({groups}: {groups: Groups}) {
  return (
    <div className={styles.list}>
      {groups.map((group) => (
        <section key={group.key} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.category}</h2>
          <ul className={controls.rows}>
            {group.items.map((resource) => (
              <li key={resource.id} className={controls.row}>
                <span className={controls.rowTitle}>{resource.title}</span>
                <span className={controls.hint}>{typeLabel(resource.type)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

The read-only list has no `DndContext`, no "Add resource" button, and no Edit/Delete buttons. It's a separate component rather than a pile of `canEdit &&` checks, so none of the drag handles or keyboard instructions get rendered by mistake. Reuse the existing class names so it looks the same as the editable list.

### Public client page: `app/(site)/[slug]/page.tsx`

No change. `get_client_page` is `security invoker` and reads `clients` through `clients_read → can_view_client()`. A regular admin opening an unassigned client's link gets the same "not found" as an unknown slug, and the "Open" button on the detail page works as before for clients they manage.

---

## 5. Edge cases

- **Slug collisions leak existence.** A regular admin creating `some-slug` that belongs to a client they can't see gets "That link is taken." That's acceptable, since the slug is a public URL anyway, but don't add more detail to that message.
- **Category casing.** `private.normalize_category()` is a non-definer trigger, so its lookup runs under the caller's RLS. A regular admin won't match the casing of categories that only exist on clients they can't see, which can create near-duplicate categories. Fix by making the trigger `security definer set search_path = ''` in the same migration. It only reads `resources.category`.
- **`default_sort_order()` trigger** has the same issue, but it filters to `client_id is not distinct from new.client_id`, which the caller can always see. No change needed.
- **Removed admin.** `on delete set null` unassigns their clients, and super admins reassign them. If you'd rather block deletion while an admin still has clients, switch to `on delete restrict`.
- **Admin who is also a client contact.** `email_can_access_slug` already blocks magic links for admin emails, and `is_admin()` requires Google OAuth, so nothing changes here.
- **Shared inboxes** (`labelservices@`, `creativeservices@`) aren't on the super admin list, so they become `regular`. Every existing client goes to Mason, including ones these accounts created, so they start with **no clients**. They see only the clients they create from now on, unless a super admin reassigns some to them.
- **Regular admins start empty.** Because every existing client goes to Mason, every regular admin sees an empty client list on day one. Super admins need to reassign clients to reps after deploy (see Rollout).
- **Performance.** Each helper call runs one or two indexed lookups, and `clients_assigned_admin` covers the new one. If the client list grows large, wrap helpers as `(select public.is_super_admin())` in the policies so Postgres evaluates them once per statement instead of once per row.

---

## 6. Tests

### pgTAP: new `supabase/tests/roles.test.sql`

Same layout as `rls.test.sql`: fixture rows, `set local role authenticated`, swap JWT claims.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into public.admins (email, role) values
  ('boss@vydia.com', 'super'),
  ('rep1@vydia.com', 'regular'),
  ('rep2@vydia.com', 'regular')
on conflict (email) do update set role = excluded.role;

insert into public.clients (id, name, slug, assigned_admin) values
  ('00000000-0000-0000-0000-0000000000a1', 'Rep1 Client', 'rep1-client', 'rep1@vydia.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'Rep2 Client', 'rep2-client', 'rep2@vydia.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'Orphan',      'orphan',      null);
insert into public.client_emails (client_id, email, is_primary) values
  ('00000000-0000-0000-0000-0000000000a1', 'one@example.com', true),
  ('00000000-0000-0000-0000-0000000000a2', 'two@example.com', true);
insert into public.resources (id, client_id, title, type, url, category) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Core', 'link', 'https://core.test', 'Getting Started'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Rep1 only', 'link', 'https://e1.test', 'Yours'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', 'Rep2 only', 'link', 'https://e2.test', 'Yours');

set local role authenticated;

-- Regular admin
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"rep1@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';

select ok(public.is_admin() and not public.is_super_admin(), 'rep1 is a regular admin');
select is((select count(*)::int from public.clients), 1, 'regular admins list only their clients');
select ok(public.get_client_page('rep1-client') is not null, 'regular admins open their client page');
select ok(public.get_client_page('rep2-client') is null, 'another admin''s client page is invisible');
select ok(public.get_client_page('orphan') is null, 'unassigned clients are invisible to regular admins');
select is((select count(*)::int from public.client_emails), 1, 'regular admins read only their clients'' emails');
select is((select count(*)::int from public.resources where client_id is null), 1, 'regular admins read core resources');
select is((select count(*)::int from public.resources where title = 'Rep2 only'), 0, 'regular admins never see other clients'' resources');

-- RLS `using` failures on UPDATE/DELETE are silent (0 rows), not errors, so check the effect.
-- Only `with check` violations raise 42501 (tested below).
update public.resources set title = 'Hacked' where id = '00000000-0000-0000-0000-0000000000c1';
delete from public.resources where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select is((select title from public.resources where id = '00000000-0000-0000-0000-0000000000c1'), 'Core',
  'regular admins cannot edit or delete core resources');
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"rep1@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';

select throws_ok(
  $$ insert into public.resources (client_id, title, type, url, category) values (null, 'New core', 'link', 'https://x.test', 'X') $$,
  '42501', null, 'regular admins cannot create core resources'
);
select throws_ok(
  $$ update public.resources set client_id = null where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'regular admins cannot promote a client resource to core'
);
select throws_ok($$ select public.reorder_main_resources(array[]::uuid[]) $$, '42501', null,
  'regular admins cannot reorder core resources');
select throws_ok(
  $$ select public.save_client(jsonb_build_object('id', '00000000-0000-0000-0000-0000000000a2', 'name', 'X', 'slug', 'rep2-client',
       'emails', jsonb_build_array(jsonb_build_object('email', 'two@example.com', 'isPrimary', true)))) $$,
  'P0002', null, 'regular admins cannot save another admin''s client'
);
select throws_ok(
  $$ update public.clients set assigned_admin = 'rep2@vydia.com' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'regular admins cannot hand their client to someone else'
);

-- New client is auto-assigned
select lives_ok(
  $$ select public.save_client(jsonb_build_object('name', 'Fresh', 'slug', 'fresh-client',
       'emails', jsonb_build_array(jsonb_build_object('email', 'fresh@example.com', 'isPrimary', true)))) $$,
  'regular admins can create clients'
);
select is((select assigned_admin::text from public.clients where slug = 'fresh-client'), 'rep1@vydia.com',
  'a new client is assigned to its creator');

-- Hiding core resources: allowed on own clients only
select lives_ok(
  $$ insert into public.client_hidden_resources (client_id, resource_id)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1') $$,
  'regular admins can hide a core resource on their own client'
);
select throws_ok(
  $$ insert into public.client_hidden_resources (client_id, resource_id)
     values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'regular admins cannot hide resources on another admin''s client'
);

-- Deleting clients: allowed on own clients only (RLS makes the other delete a silent no-op)
delete from public.clients where slug = 'fresh-client';
delete from public.clients where id = '00000000-0000-0000-0000-0000000000a2';
reset role;
select is((select count(*)::int from public.clients where slug = 'fresh-client'), 0,
  'regular admins can delete their own clients');
select is((select count(*)::int from public.clients where id = '00000000-0000-0000-0000-0000000000a2'), 1,
  'regular admins cannot delete another admin''s client');
set local role authenticated;

-- Super admin
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","email":"boss@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';

select ok(public.is_super_admin(), 'boss is a super admin');
select is((select count(*)::int from public.clients), 3, 'super admins see every client, including unassigned');
select lives_ok(
  $$ update public.resources set title = 'Core v2' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'super admins edit core resources'
);
select ok(public.get_client_page('orphan') is not null, 'super admins open any client page');

select * from finish();
rollback;
```

(Set `plan(n)` to the final number of assertions.)

Also update `supabase/tests/rls.test.sql`. Its `ops@vydia.com` fixture is now `regular` by default, so the assertion `'admins see every client page directly'` will fail. Either insert `ops@vydia.com` with `role = 'super'`, or rewrite that assertion to "super admins see every client page" and add a regular-admin version.

### Vitest

- `tests/admin-lib.test.ts`: cover the new `P0002` mapping in `mapSaveError`.
- If `ClientTable`'s filter logic gets pulled into a pure function (recommended: `filterClients(rows, {query, scope})`), unit-test the All/Mine/Unassigned scopes.

### Playwright

The e2e suite has no Google sign-in for admins, so admin role coverage belongs in pgTAP. In e2e:

- `scripts/e2e-fixtures.ts` inserts clients with the service role, where `jwt_email()` is null, so `assigned_admin` stays null. Nothing breaks, because client-user specs don't depend on it. Add an explicit `assigned_admin` only if an admin e2e persona is added later.

---

## 7. Rollout

1. Land the migration and app changes in one PR. The app changes depend on the new columns and types, and the old app code would break against the new RLS (`getAdmin` `.maybeSingle()` on a multi-row result for super admins).
2. Before merging, check the backfill against a prod snapshot or branch DB. This should return no rows: `select name from clients where assigned_admin is distinct from 'mason.omara@vydia.com';`
3. `npm run db:push`, then deploy. Supabase applies the migration in one transaction.
4. Smoke test: sign in as a super admin (all clients, can edit core) and as a regular admin (empty list, `/admin/resources` read-only, another client's `/slug` returns 404). Then create a client as the regular admin and confirm it shows up only for them and for super admins.
5. Reassign existing clients from Mason to their reps from each client's page, using the "Assigned to" dropdown. Until that's done, regular admins can't see clients they used to manage.
6. Update `docs/admin-guide.md` with: who the super admins are, how to make someone a super admin (table editor → `admins.role`), and how reassignment works.

---

## 8. Decisions

- Super admins: `mason.omara@vydia.com`, `erica.johnson@vydia.com`, `chris.maltese@vydia.com`. The shared `labelservices@` / `creativeservices@` inboxes stay regular.
- Regular admins can hide core resources on their own clients.
- Regular admins can delete their own clients.
- One assigned admin per client.
- All existing clients are assigned to `mason.omara@vydia.com` in the migration.

---


## 9. Todo list

Work through the phases in order. Each phase ends with a check that has to pass before moving on. Phases 1–8 ship as **one PR**: the old app code breaks against the new RLS, and the new app code needs the new columns. Nothing below has been implemented yet.

### Phase 0: Prep

- [ ] Branch off `main` (e.g. `admin-roles`). Don't build on `artist-to-client` unless that branch has merged.
- [ ] Read the relevant Next.js guides in `node_modules/next/dist/docs/` before touching app code (per `AGENTS.md`), especially `02-guides/server-actions.md` and the `refresh` / `redirect` API references.
- [ ] Start the local stack: `supabase start`, then `npm run dev`.
- [ ] Get a baseline: `npm run lint && npm run typecheck && npm run test && npm run db:test` all pass on the untouched branch.
- [ ] Confirm all three super admin addresses sign in with Google as `@vydia.com` accounts: `mason.omara@`, `erica.johnson@`, `chris.maltese@`.
- [ ] Note how many clients are in production now. That's the reassignment workload for Phase 10.

**Check:** baseline is green and the branch exists.

### Phase 1: Database migration

- [ ] `supabase migration new admin_roles` creates `supabase/migrations/<ts>_admin_roles.sql`.
- [ ] **Schema**
  - [ ] Create enum `public.admin_role ('super', 'regular')`.
  - [ ] Add `admins.role public.admin_role not null default 'regular'`, plus a column comment.
  - [ ] Add `clients.assigned_admin public.email_address references admins(email) on update cascade on delete set null`, with **no default yet**.
  - [ ] Create index `clients_assigned_admin`.
- [ ] **Seed and backfill**
  - [ ] Upsert the three super admins with `role = 'super'` (`on conflict (email) do update set role = 'super'`).
  - [ ] `update clients set assigned_admin = 'mason.omara@vydia.com' where assigned_admin is null`. This must run **after** the seed so the foreign key holds.
  - [ ] **After** the backfill: `alter column assigned_admin set default public.jwt_email()`.
- [ ] **Helpers**
  - [ ] `public.is_super_admin()`: `security definer`, `set search_path = ''`.
  - [ ] `public.can_manage_client(uuid)`: super admin, or admin whose email equals `assigned_admin`.
  - [ ] Replace `public.can_view_client(uuid)` with `can_manage_client(target) or <client email match>`.
  - [ ] Revoke from `public, anon`. Grant to `authenticated, service_role`.
- [ ] **Policies: `admins`**
  - [ ] Add `admins_super_read` (select, `is_super_admin()`). Keep `admins_self`.
- [ ] **Policies: `clients`**
  - [ ] Drop and recreate `clients_insert`: with check `is_super_admin() or (is_admin() and assigned_admin = jwt_email())`.
  - [ ] Drop and recreate `clients_update`: using `can_manage_client(id)`, with check on the `assigned_admin` column directly (not the helper).
  - [ ] Drop and recreate `clients_delete`: using `can_manage_client(id)`.
- [ ] **Policies: `client_emails`**: recreate `emails_admin_all` with `can_manage_client(client_id)`.
- [ ] **Policies: `client_hidden_resources`**: recreate `hides_admin_write` with `can_manage_client(client_id)`.
- [ ] **Policies: `resources`**
  - [ ] Recreate `resources_read`: core rows for any admin, client rows via `can_view_client`, core rows for client users via `can_view_main_resource`.
  - [ ] Recreate `resources_insert`, `resources_update` (using **and** with check), and `resources_delete`: `is_super_admin() or (client_id is not null and can_manage_client(client_id))`.
- [ ] **Storage policies**
  - [ ] Drop `"admins manage resource objects"`.
  - [ ] Add `"admins upload resource objects"` (insert, `is_admin()`).
  - [ ] Add `"super admins manage resource objects"` (all, `is_super_admin()`).
  - [ ] Leave `"viewers read visible files"` as it is.
- [ ] **Functions**
  - [ ] `reorder_main_resources`: gate on `is_super_admin()`.
  - [ ] `save_client`: copy the **full** current body from `20261110215541_rename_artist_to_client.sql`. Add the `can_manage_client(v_id)` check right after the `is_admin()` check (raise `P0002`), and set `assigned_admin` explicitly on insert.
  - [ ] `private.normalize_category`: recreate as `security definer set search_path = ''` so category casing matches across clients the caller can't see.
- [ ] End with `notify pgrst, 'reload schema';`.
- [ ] Apply locally: `supabase db reset` (replays every migration from scratch).
- [ ] Spot-check in `psql` / Studio: the three super admins have `role = 'super'`, every client has `assigned_admin = 'mason.omara@vydia.com'`, and the column default is `jwt_email()`.

**Check:** `supabase db reset` runs clean, and the spot-checks match.

### Phase 2: Database tests

- [ ] Create `supabase/tests/roles.test.sql` from the snippet in section 6. Cover:
  - [ ] Regular admin: sees only their clients, client pages, emails, and client resources.
  - [ ] Regular admin: can't see unassigned clients or other admins' clients.
  - [ ] Regular admin: reads core resources, but can't insert, update, delete, or reorder them.
  - [ ] Regular admin: can't move a client resource to core (`client_id = null` → `42501`).
  - [ ] Regular admin: `save_client` on someone else's client → `P0002`.
  - [ ] Regular admin: can't change `assigned_admin` to someone else → `42501`.
  - [ ] Regular admin: a new client is assigned to them automatically.
  - [ ] Regular admin: can hide and restore core resources on their own client, but not on another client's.
  - [ ] Regular admin: can delete their own client. Deleting another admin's client is a no-op.
  - [ ] Super admin: sees every client (including unassigned), edits core resources, opens any client page, reads every `admins` row.
  - [ ] A Google session that isn't on the list, and a magic-link session for an admin email, both still get nothing.
  - [ ] Set `plan(n)` to the final assertion count.
- [ ] Update `supabase/tests/rls.test.sql`: insert `ops@vydia.com` with `role = 'super'` so `'admins see every client page directly'` still holds, or rename that assertion to say "super admins".
- [ ] Review `supabase/tests/functions.test.sql` and `safe-statements.test.sql` for anything that assumes a single admin role or calls `save_client` / `reorder_main_resources` as an admin, and update the fixtures to match.
- [ ] Run `npm run db:test`.

**Check:** every pgTAP file passes locally.

### Phase 3: Types and auth helper

- [ ] `npm run db:types` regenerates `lib/supabase/database.types.ts`. Confirm it now has `admin_role`, `admins.role`, and `clients.assigned_admin`.
- [ ] `lib/admin/auth.ts`:
  - [ ] Read the email from `getClaims()` and filter `admins` with `.eq('email', email)`. Required, or super admins break on `.maybeSingle()`.
  - [ ] Select `role` and return `isSuper`.
  - [ ] Export `AdminRole` and `AdminSession` types.
  - [ ] Add `requireSuperAdmin()` (redirects to `/admin`) for pages.
- [ ] `npm run typecheck`. Fix any call sites that destructure `getAdmin()` / `requireAdmin()`.

**Check:** typecheck passes. Signing in locally as a super admin and as a regular admin both reach `/admin`.

### Phase 4: Server actions

- [ ] `resources/actions.ts`:
  - [ ] Add a `SUPER_ONLY` message constant.
  - [ ] `upsertMainResource`: if not super, return `{ok: false, errors: {form: SUPER_ONLY}}`.
  - [ ] `deleteMainResource`: if not super, return `{ok: false}`.
  - [ ] `reorderMainResources`: if not super, return `{ok: false}`.
- [ ] `clients/actions.ts`:
  - [ ] `saveClient`: handle `error.code === 'P0002'` with `formError: 'This client no longer exists or isn’t assigned to you.'`. It's form-level, so it goes here rather than in `mapSaveError`, which returns per-field errors.
  - [ ] `deleteClient`: add `.select('id')` and treat an empty result as a failure.
  - [ ] Add `assignClient({clientId, adminEmail})`: super-only, Zod-validated, `.select('id')` row check, `refresh()`.
- [ ] `uploads/actions.ts`: for non-super admins, look up `resources.client_id` by `resourceId` and reject if it's an existing core resource.
- [ ] Make sure `ResourceDialog` / `SortableResourceList` show the returned `errors.form` (they should already, but check).

**Check:** typecheck and lint pass. Calling each action manually as a regular admin returns the expected error.

### Phase 5: Storage cleanup

- [ ] `lib/admin/storage.ts`: keep `take_storage_garbage` on the user client. Do the `.remove()` calls through `createServiceClient()`.
- [ ] Confirm `SUPABASE_SECRET_KEY` is set in local `.env.local` and in every Vercel environment (Production, Preview).
- [ ] Manual test as a regular admin: add a client-specific PDF, replace it, then delete the resource. The old objects should disappear from the `resource-files` bucket.
- [ ] Manual test as a regular admin: try to delete a core resource's object through the Storage API. It should be denied.

**Check:** no orphaned objects after the regular-admin flow, and the direct delete is denied.

### Phase 6: UI

- [ ] **Panel layout** (`layout.tsx`): add a "Super admin" badge next to the name, plus a `roleBadge` style in `panel.module.css`.
- [ ] **Client list** (`(panel)/page.tsx`):
  - [ ] Select `assigned_admin` and `owner:admins!clients_assigned_admin_fkey(display_name)`.
  - [ ] Map `owner` and `isMine` onto each row.
  - [ ] Title: "Clients" for super admins, "Your clients" for regular admins.
  - [ ] Pass `showOwner={isSuper}`.
- [ ] **`ClientTable.tsx`**:
  - [ ] Add `owner` and `isMine` to `ClientRow`, and a `showOwner` prop.
  - [ ] Pull filtering into a pure `filterClients(rows, {query, scope})` so it can be unit-tested.
  - [ ] Owner column ("Unassigned" for null), shown only when `showOwner` is set.
  - [ ] All / Mine / Unassigned control (super admins only). Default to **Mine**, since Mason will start with every client.
  - [ ] Include the owner name in search.
  - [ ] Regular-admin empty state: "No clients assigned to you yet."
  - [ ] Styles in `ClientTable.module.css`.
- [ ] **Client detail** (`clients/[id]/page.tsx`):
  - [ ] Select `assigned_admin`.
  - [ ] For super admins, also load `admins(email, display_name)`.
  - [ ] Render `<AssignAdminSelect>` in the header for super admins.
- [ ] **`components/admin/AssignAdminSelect.tsx`**: new client component (see section 4), using `useTransition`, a status message, and an accessible label.
- [ ] **Core resources page** (`resources/page.tsx`): pass `canEdit={isSuper}` and show the read-only note to regular admins.
- [ ] **`SortableResourceList.tsx`**:
  - [ ] Add a `canEdit` prop.
  - [ ] Add a `ReadOnlyResourceList` (no DnD, no Add / Edit / Delete), reusing the existing classes.
  - [ ] Return it early when `!canEdit`.
- [ ] **`ClientForm`**: no changes. Confirm the Remove/Restore toggles and the "Client specific" section still work for a regular admin.
- [ ] Manual pass in the browser as each role:
  - [ ] Super admin: sees all clients, owner column, and filter. Reassigns a client. Edits, reorders, and deletes core resources.
  - [ ] Regular admin: empty list at first. Creates a client, which then appears. Adds client-specific resources. Hides a core resource on that client. Deletes the client.
  - [ ] Regular admin: `/admin/resources` is read-only. `/admin/clients/<other-id>` returns 404. `/<other-slug>` returns 404.
  - [ ] Keyboard and screen-reader check on the new select and filter control.

**Check:** both role walkthroughs behave as described in the Goal table.

### Phase 7: App tests and CI checks

- [ ] `tests/admin-lib.test.ts`: confirm `mapSaveError` still returns `null` for `P0002` (the action handles it).
- [ ] New unit tests for `filterClients`: query matching, and the All / Mine / Unassigned scopes.
- [ ] `tests/e2e/a11y.spec.ts` / `admin.spec.ts`: no admin-session e2e exists, so nothing to add. Confirm the signed-out redirects still pass.
- [ ] `scripts/e2e-fixtures.ts`: no change needed (service-role inserts leave `assigned_admin` null). Confirm `npm run e2e:setup` still runs.
- [ ] Run everything: `npm run lint && npm run typecheck && npm run test && npm run db:test && npm run format:check`.
- [ ] Run `npm run e2e` locally against the dev server.

**Check:** every command passes. These match the `check` and `db` jobs in `.github/workflows/ci.yml`.

### Phase 8: Docs

- [ ] `docs/admin-guide.md`: add a roles section covering:
  - [ ] The two roles and what each can do (copy the Goal table).
  - [ ] Who the super admins are.
  - [ ] How to make someone a super admin: Supabase table editor → `admins` → `role`.
  - [ ] How clients get assigned (creator, by default) and how super admins reassign them.
  - [ ] That regular admins can hide core resources on their own clients but not edit them.
- [ ] Mark this plan as implemented, or move it to `docs/admin-roles-plan.md` next to the other plans.

### Phase 9: Review and PR

- [ ] Self-review the migration against section 1 line by line. In particular, check that `save_client`'s body was copied **in full**.
- [ ] Run `/security-review` on the branch. Focus on RLS gaps, storage policies, and the service-client delete.
- [ ] Commit with an author email that maps to a Vydia-team GitHub user (the Vercel author check).
- [ ] Open the PR against `main`. List the behavior changes in the description, especially that regular admins start with an empty client list.
- [ ] Get the Vercel preview green. Supabase migrations don't run on preview unless a branch DB is set up, so test against a Supabase branch or the local stack.
- [ ] Get approval.

### Phase 10: Deploy and follow-up

- [ ] Against a prod snapshot or Supabase branch: run the migration, then `select name from clients where assigned_admin is distinct from 'mason.omara@vydia.com';`. It should return no rows.
- [ ] Pick a quiet window, since regular admins lose access to existing clients until those are reassigned.
- [ ] Run `npm run db:push` against production, then merge the PR right away so the Vercel production deploy starts. In the minutes between the two, the old app runs against the new RLS. Super admins' `/admin` page may error (`getAdmin` `.maybeSingle()` sees several rows), and regular admins see no clients. Keep that window short.
- [ ] Smoke test in production with one super admin and one regular admin (Rollout step 4).
- [ ] Reassign existing clients from Mason to their reps with the "Assigned to" dropdown. Track progress with the **Mine** filter on Mason's account.
- [ ] Tell the team: what changed, who the super admins are, and who to ask for reassignment.
- [ ] After a week: check the Supabase logs for `42501` / `P0002` spikes that point to a missed path, and run `npm run storage:sweep` (dry run) to confirm no orphaned files are piling up.
