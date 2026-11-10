-- Rename "artist" to "client" across the schema.
-- Tables, columns, constraints, indexes, triggers, and policies are renamed in place, so data,
-- grants, and RLS are kept. Functions are renamed (keeping their grants) and then replaced,
-- because function bodies are stored as text and still name the old tables and columns.

alter table public.artists rename to clients;
alter table public.artist_emails rename to client_emails;
alter table public.artist_hidden_resources rename to client_hidden_resources;

alter table public.client_emails rename column artist_id to client_id;
alter table public.client_hidden_resources rename column artist_id to client_id;
alter table public.resources rename column artist_id to client_id;

alter table public.clients rename constraint artists_pkey to clients_pkey;
alter table public.clients rename constraint artists_slug_key to clients_slug_key;
alter table public.clients rename constraint artists_slug_check to clients_slug_check;
alter table public.clients rename constraint artists_name_check to clients_name_check;
alter table public.clients rename constraint artists_created_by_fkey to clients_created_by_fkey;
alter table public.client_emails rename constraint artist_emails_pkey to client_emails_pkey;
alter table public.client_emails rename constraint artist_emails_artist_id_fkey to client_emails_client_id_fkey;
alter table public.client_emails rename constraint artist_emails_artist_id_email_key to client_emails_client_id_email_key;
alter table public.client_hidden_resources rename constraint artist_hidden_resources_pkey to client_hidden_resources_pkey;
alter table public.client_hidden_resources rename constraint artist_hidden_resources_artist_id_fkey to client_hidden_resources_client_id_fkey;
alter table public.client_hidden_resources rename constraint artist_hidden_resources_resource_id_fkey to client_hidden_resources_resource_id_fkey;
alter table public.resources rename constraint resources_artist_id_fkey to resources_client_id_fkey;

alter index public.artist_emails_one_primary rename to client_emails_one_primary;
alter index public.artist_emails_email rename to client_emails_email;
alter index public.resources_artist rename to resources_client;

alter trigger artists_touch on public.clients rename to clients_touch;

alter policy artists_read on public.clients rename to clients_read;
alter policy artists_insert on public.clients rename to clients_insert;
alter policy artists_update on public.clients rename to clients_update;
alter policy artists_delete on public.clients rename to clients_delete;
alter policy artist_emails_auth_hook on public.client_emails rename to client_emails_auth_hook;

alter function public.can_view_artist(uuid) rename to can_view_client;
alter function public.get_artist_page(text) rename to get_client_page;
alter function public.save_artist(jsonb) rename to save_client;

create or replace function private.default_sort_order() returns trigger language plpgsql as $$
begin
  if new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order
      from public.resources where client_id is not distinct from new.client_id;
  end if;
  return new;
end $$;

create or replace function private.check_hide_target() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.resources where id = new.resource_id and client_id is not null) then
    raise exception 'Only main resources can be hidden' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.can_view_client(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.client_emails ae
                  where ae.client_id = target and ae.email = public.jwt_email())
$$;

create or replace function public.can_view_main_resource(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.client_emails ae
     where ae.email = public.jwt_email()
       and not exists (select 1 from public.client_hidden_resources h
                        where h.client_id = ae.client_id and h.resource_id = target))
$$;

create or replace function public.get_client_page(p_slug text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'client', jsonb_build_object('id', a.id, 'name', a.name),
    'resources', coalesce((
      select jsonb_agg(to_jsonb(r) order by (r.client_id is not null), r.sort_order, r.added_on, r.id)
        from public.resources r
       where r.client_id = a.id
          or (r.client_id is null and not exists (
                select 1 from public.client_hidden_resources h
                 where h.client_id = a.id and h.resource_id = r.id))
    ), '[]'::jsonb))
  from public.clients a
  where a.slug = lower(btrim(p_slug))
$$;

create or replace function public.email_can_access_slug(p_slug text, p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.clients a
             join public.client_emails ae on ae.client_id = a.id
            where a.slug = lower(btrim(p_slug)) and ae.email = lower(btrim(p_email)))
     and not exists (select 1 from public.admins ad where ad.email = lower(btrim(p_email)))
$$;

create or replace function public.reorder_main_resources(ids uuid[]) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.resources r set sort_order = o.ord::integer
    from unnest(ids) with ordinality as o(id, ord)
   where r.id = o.id and r.client_id is null;
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
    insert into public.clients (name, slug, created_by)
    values (btrim(payload ->> 'name'), payload ->> 'slug', auth.uid())
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

create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_email    text := lower(btrim(event -> 'user' ->> 'email'));
  v_provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', 'email');
  v_is_admin boolean := exists (select 1 from public.admins where email = v_email);
begin
  if v_provider = 'google' and v_is_admin then
    return '{}'::jsonb;
  end if;
  if v_provider = 'email' and not v_is_admin
     and exists (select 1 from public.client_emails where email = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Not approved'));
end $$;

notify pgrst, 'reload schema';
