create type public.admin_role as enum ('super', 'regular');

alter table public.admins
  add column role public.admin_role not null default 'regular';
comment on column public.admins.role is
  'super = sees every client and edits core resources. regular = sees assigned clients only. Set by hand in the Supabase table editor.';

alter table public.clients
  add column assigned_admin public.email_address
    references public.admins (email) on update cascade on delete set null;
create index clients_assigned_admin on public.clients (assigned_admin);

insert into public.admins (email, role) values
  ('mason.omara@vydia.com',   'super'),
  ('erica.johnson@vydia.com', 'super'),
  ('chris.maltese@vydia.com', 'super')
on conflict (email) do update set role = 'super';

update public.clients
   set assigned_admin = 'mason.omara@vydia.com'
 where assigned_admin is null;

alter table public.clients alter column assigned_admin set default public.jwt_email();

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

create function public.is_client_contact(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.client_emails ce
                  where ce.client_id = target and ce.email = public.jwt_email())
$$;

create or replace function public.can_view_client(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_manage_client(target) or public.is_client_contact(target)
$$;

revoke execute on function public.is_super_admin(), public.can_manage_client(uuid), public.is_client_contact(uuid)
  from public, anon;
grant execute on function public.is_super_admin(), public.can_manage_client(uuid), public.is_client_contact(uuid)
  to authenticated, service_role;

create policy admins_super_read on public.admins for select to authenticated
  using (public.is_super_admin());

drop policy clients_read on public.clients;
drop policy clients_insert on public.clients;
drop policy clients_update on public.clients;
drop policy clients_delete on public.clients;

create policy clients_read on public.clients for select to authenticated
  using (public.is_super_admin()
         or (public.is_admin() and assigned_admin = public.jwt_email())
         or public.is_client_contact(id));

create policy clients_insert on public.clients for insert to authenticated
  with check (public.is_super_admin()
              or (public.is_admin() and assigned_admin = public.jwt_email()));

create policy clients_update on public.clients for update to authenticated
  using (public.is_super_admin() or (public.is_admin() and assigned_admin = public.jwt_email()))
  with check (public.is_super_admin() or (public.is_admin() and assigned_admin = public.jwt_email()));

create policy clients_delete on public.clients for delete to authenticated
  using (public.is_super_admin() or (public.is_admin() and assigned_admin = public.jwt_email()));

drop policy emails_admin_all on public.client_emails;
create policy emails_admin_all on public.client_emails for all to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

drop policy hides_admin_write on public.client_hidden_resources;
create policy hides_admin_write on public.client_hidden_resources for all to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

drop policy resources_read on public.resources;
drop policy resources_insert on public.resources;
drop policy resources_update on public.resources;
drop policy resources_delete on public.resources;

create policy resources_read on public.resources for select to authenticated using (
     (client_id is null and public.is_admin())
  or (client_id is not null and public.can_view_client(client_id))
  or (client_id is null and public.can_view_main_resource(id))
);

create policy resources_insert on public.resources for insert to authenticated
  with check (public.is_super_admin() or (client_id is not null and public.can_manage_client(client_id)));

create policy resources_update on public.resources for update to authenticated
  using (public.is_super_admin() or (client_id is not null and public.can_manage_client(client_id)))
  with check (public.is_super_admin() or (client_id is not null and public.can_manage_client(client_id)));

create policy resources_delete on public.resources for delete to authenticated
  using (public.is_super_admin() or (client_id is not null and public.can_manage_client(client_id)));

drop policy "admins manage resource objects" on storage.objects;

create policy "admins upload resource objects" on storage.objects for insert to authenticated
  with check (bucket_id in ('resource-files', 'resource-images') and public.is_admin());

create policy "super admins manage resource objects" on storage.objects for all to authenticated
  using (bucket_id in ('resource-files', 'resource-images') and public.is_super_admin())
  with check (bucket_id in ('resource-files', 'resource-images') and public.is_super_admin());

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

create or replace function private.normalize_category() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  existing text;
begin
  new.category := regexp_replace(btrim(new.category), '\s+', ' ', 'g');
  select r.category into existing
    from public.resources r
   where lower(r.category) = lower(new.category) and r.id <> new.id
   order by r.created_at
   limit 1;
  if existing is not null then
    new.category := existing;
  end if;
  return new;
end $$;

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

  if exists (select 1 from jsonb_array_elements(v_emails) e where nullif(btrim(e ->> 'email'), '') is null)
     or exists (select 1 from jsonb_array_elements(v_excl) r where nullif(r ->> 'id', '') is null) then
    raise exception 'every email and exclusive resource needs a value' using errcode = '23502';
  end if;

  if (select count(*) from jsonb_array_elements(v_emails) e where coalesce((e ->> 'isPrimary')::boolean, false)) <> 1 then
    raise exception 'exactly one primary email is required' using errcode = '23514';
  end if;

  if (select count(*) <> count(distinct lower(btrim(e ->> 'email'))) from jsonb_array_elements(v_emails) e) then
    raise exception 'duplicate email' using errcode = '23505', constraint = 'client_emails_client_id_email_key';
  end if;

  if v_id is null then
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

  delete from public.client_emails ae
   where ae.client_id = v_id
     and not exists (select 1 from jsonb_array_elements(v_emails) e
                      where lower(btrim(e ->> 'email')) = ae.email);
  update public.client_emails set is_primary = false where client_id = v_id;
  insert into public.client_emails (client_id, email, label, is_primary)
  select v_id, lower(btrim(e ->> 'email')), nullif(btrim(e ->> 'label'), ''),
         coalesce((e ->> 'isPrimary')::boolean, false)
    from jsonb_array_elements(v_emails) e
  on conflict (client_id, email) do update
    set label = excluded.label, is_primary = excluded.is_primary;

  delete from public.client_hidden_resources where client_id = v_id;
  insert into public.client_hidden_resources (client_id, resource_id)
  select v_id, h::uuid from jsonb_array_elements_text(v_hidden) h
  on conflict do nothing;

  delete from public.resources x
   where x.client_id = v_id
     and not exists (select 1 from jsonb_array_elements(v_excl) r
                      where (r ->> 'id')::uuid = x.id);

  insert into public.resources as t
    (id, client_id, title, type, file, url, cover_image, cover_image_alt, cover_image_lqip,
     pdf_preview, pdf_preview_lqip, category, sort_order, added_on)
  select (r ->> 'id')::uuid, v_id, btrim(r ->> 'title'), (r ->> 'type')::public.resource_type,
         nullif(r ->> 'file', ''), nullif(r ->> 'url', ''), nullif(r ->> 'coverImage', ''),
         nullif(r ->> 'coverImageAlt', ''), nullif(r ->> 'coverImageLqip', ''),
         nullif(r ->> 'pdfPreview', ''), nullif(r ->> 'pdfPreviewLqip', ''), r ->> 'category',
         x.ord::integer, coalesce((r ->> 'addedOn')::timestamptz, now())
    from jsonb_array_elements(v_excl) with ordinality as x(r, ord)
  on conflict (id) do update set
    title = excluded.title, type = excluded.type, file = excluded.file, url = excluded.url,
    cover_image = excluded.cover_image, cover_image_alt = excluded.cover_image_alt,
    cover_image_lqip = excluded.cover_image_lqip, pdf_preview = excluded.pdf_preview,
    pdf_preview_lqip = excluded.pdf_preview_lqip, category = excluded.category,
    sort_order = excluded.sort_order, added_on = excluded.added_on
  where t.client_id = v_id;

  return v_id;
end $$;

notify pgrst, 'reload schema';
