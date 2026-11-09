create domain public.email_address as text
  check (value = lower(btrim(value)) and value ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');

create type public.resource_type as enum ('pdf', 'video', 'link', 'slides');

create schema if not exists private;

create table public.admins (
  email           public.email_address primary key check (email like '%@vydia.com'),
  display_name    text,
  avatar_url      text,
  user_id         uuid unique references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_sign_in_at timestamptz
);
comment on table public.admins is 'Managed by hand in the Supabase table editor. Add the email; name and avatar fill in on first Google sign-in.';

create table public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 100),
  slug       text not null unique
             check (char_length(slug) between 3 and 60
                    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                    and slug not in ('admin', 'api', 'auth', 'login', 'logout', 'account', 'studio', 'static')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artist_emails (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists (id) on delete cascade,
  email      public.email_address not null,
  label      text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (artist_id, email)
);
create unique index artist_emails_one_primary on public.artist_emails (artist_id) where is_primary;
create index artist_emails_email on public.artist_emails (email);

create table public.resources (
  id                  uuid primary key default gen_random_uuid(),
  artist_id           uuid references public.artists (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 1 and 120),
  type                public.resource_type not null,
  file                text,
  url                 text check (url ~ '^https?://'),
  cover_image         text,
  cover_image_alt     text,
  cover_image_hotspot jsonb check (cover_image_hotspot is null or (cover_image_hotspot ? 'x' and cover_image_hotspot ? 'y')),
  cover_image_lqip    text check (cover_image_lqip is null or (cover_image_lqip like 'data:image/%' and char_length(cover_image_lqip) <= 4096)),
  pdf_preview         text,
  pdf_preview_lqip    text check (pdf_preview_lqip is null or (pdf_preview_lqip like 'data:image/%' and char_length(pdf_preview_lqip) <= 4096)),
  category            text not null check (char_length(btrim(category)) > 0),
  sort_order          integer not null default 0,
  added_on            timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint resources_target check (
    case type
      when 'pdf'    then file is not null and url is null
      when 'video'  then file is not null and url is null
      when 'link'   then url is not null and file is null
      when 'slides' then (file is null) <> (url is null)
    end
  ),
  constraint resources_preview_only_pdf check (pdf_preview is null or type = 'pdf')
);
create index resources_main_order on public.resources (sort_order) where artist_id is null;
create index resources_artist on public.resources (artist_id, sort_order) where artist_id is not null;
create index resources_category_key on public.resources (lower(category));

create table public.artist_hidden_resources (
  artist_id   uuid not null references public.artists (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  primary key (artist_id, resource_id)
);

insert into public.admins (email, display_name) values
  ('labelservices@vydia.com', 'Label Services'),
  ('creativeservices@vydia.com', 'Creative Services')
on conflict (email) do nothing;

create function private.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger artists_touch before update on public.artists
  for each row execute function private.touch_updated_at();
create trigger resources_touch before update on public.resources
  for each row execute function private.touch_updated_at();

create function private.normalize_category() returns trigger language plpgsql as $$
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
create trigger resources_category before insert or update of category on public.resources
  for each row execute function private.normalize_category();

create function private.default_sort_order() returns trigger language plpgsql as $$
begin
  if new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order
      from public.resources where artist_id is not distinct from new.artist_id;
  end if;
  return new;
end $$;
create trigger resources_sort before insert on public.resources
  for each row execute function private.default_sort_order();

create function private.check_hide_target() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.resources where id = new.resource_id and artist_id is not null) then
    raise exception 'Only main resources can be hidden' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger hides_main_only before insert or update on public.artist_hidden_resources
  for each row execute function private.check_hide_target();

create table private.storage_garbage (
  bucket    text not null,
  path      text not null,
  queued_at timestamptz not null default now(),
  primary key (bucket, path)
);

create function private.queue_resource_garbage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.storage_garbage (bucket, path)
  select g.bucket, g.path from (values
    ('resource-files',  old.file,        case when tg_op = 'DELETE' then null else new.file end),
    ('resource-images', old.cover_image, case when tg_op = 'DELETE' then null else new.cover_image end),
    ('resource-images', old.pdf_preview, case when tg_op = 'DELETE' then null else new.pdf_preview end)
  ) as g(bucket, path, replacement)
  where g.path is not null and g.path is distinct from g.replacement
  on conflict do nothing;
  return null;
end $$;
create trigger resources_garbage after update or delete on public.resources
  for each row execute function private.queue_resource_garbage();

create function public.jwt_email() returns text
language sql stable set search_path = '' as $$
  select lower(nullif(auth.jwt() ->> 'email', ''))
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.jwt_email() like '%@vydia.com', false)
     and exists (select 1 from public.admins a where a.email = public.jwt_email())
     and exists (
       select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
        where m ->> 'method' = 'oauth' or m #>> '{}' = 'oauth'
     )
$$;

create function public.can_view_artist(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.artist_emails ae
                  where ae.artist_id = target and ae.email = public.jwt_email())
$$;

create function public.can_view_main_resource(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.artist_emails ae
     where ae.email = public.jwt_email()
       and not exists (select 1 from public.artist_hidden_resources h
                        where h.artist_id = ae.artist_id and h.resource_id = target))
$$;

revoke execute on function public.jwt_email(), public.is_admin(), public.can_view_artist(uuid),
  public.can_view_main_resource(uuid) from public, anon;
grant execute on function public.jwt_email(), public.is_admin(), public.can_view_artist(uuid),
  public.can_view_main_resource(uuid) to authenticated, service_role;

alter table public.admins                  enable row level security;
alter table public.artists                 enable row level security;
alter table public.artist_emails           enable row level security;
alter table public.resources               enable row level security;
alter table public.artist_hidden_resources enable row level security;

revoke all on all tables in schema public from anon;

create policy admins_self on public.admins for select to authenticated
  using (email = public.jwt_email() and public.is_admin());

create policy artists_read on public.artists for select to authenticated
  using (public.can_view_artist(id));
create policy artists_insert on public.artists for insert to authenticated
  with check (public.is_admin());
create policy artists_update on public.artists for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy artists_delete on public.artists for delete to authenticated
  using (public.is_admin());

create policy emails_admin_all on public.artist_emails for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy resources_read on public.resources for select to authenticated using (
  public.is_admin()
  or (artist_id is not null and public.can_view_artist(artist_id))
  or (artist_id is null and public.can_view_main_resource(id))
);
create policy resources_insert on public.resources for insert to authenticated
  with check (public.is_admin());
create policy resources_update on public.resources for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy resources_delete on public.resources for delete to authenticated
  using (public.is_admin());

create policy hides_read on public.artist_hidden_resources for select to authenticated
  using (public.can_view_artist(artist_id));
create policy hides_admin_write on public.artist_hidden_resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create function public.get_artist_page(p_slug text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'artist', jsonb_build_object('id', a.id, 'name', a.name),
    'resources', coalesce((
      select jsonb_agg(to_jsonb(r) order by (r.artist_id is not null), r.sort_order, r.added_on, r.id)
        from public.resources r
       where r.artist_id = a.id
          or (r.artist_id is null and not exists (
                select 1 from public.artist_hidden_resources h
                 where h.artist_id = a.id and h.resource_id = r.id))
    ), '[]'::jsonb))
  from public.artists a
  where a.slug = lower(btrim(p_slug))
$$;
revoke execute on function public.get_artist_page(text) from public, anon;
grant execute on function public.get_artist_page(text) to authenticated;

create function public.email_can_access_slug(p_slug text, p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.artists a
             join public.artist_emails ae on ae.artist_id = a.id
            where a.slug = lower(btrim(p_slug)) and ae.email = lower(btrim(p_email)))
     and not exists (select 1 from public.admins ad where ad.email = lower(btrim(p_email)))
$$;
revoke execute on function public.email_can_access_slug(text, text) from public, anon, authenticated;
grant execute on function public.email_can_access_slug(text, text) to service_role;

create table private.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 1,
  primary key (key, window_start)
);
create table private.link_sends (
  email   text primary key,
  sent_at timestamptz not null
);

create function public.hit_rate_limit(p_key text, p_limit integer, p_window interval) returns boolean
language sql volatile security definer set search_path = '' as $$
  insert into private.rate_limits as r (key, window_start)
  values (p_key, date_bin(p_window, now(), timestamptz 'epoch'))
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits <= p_limit
$$;

create function public.claim_link_send(p_email text) returns boolean
language sql volatile security definer set search_path = '' as $$
  with claimed as (
    insert into private.link_sends as s (email, sent_at) values (lower(btrim(p_email)), now())
    on conflict (email) do update set sent_at = now()
      where s.sent_at < now() - interval '60 seconds'
    returning 1
  )
  select exists (select 1 from claimed)
$$;
revoke execute on function public.hit_rate_limit(text, integer, interval), public.claim_link_send(text)
  from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, interval), public.claim_link_send(text)
  to service_role;

create function public.claim_admin_profile() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  update public.admins
     set user_id = auth.uid(),
         display_name = coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', display_name),
         avatar_url = coalesce(auth.jwt() -> 'user_metadata' ->> 'avatar_url', avatar_url),
         last_sign_in_at = now()
   where email = public.jwt_email();
  return true;
end $$;
revoke execute on function public.claim_admin_profile() from public, anon;
grant execute on function public.claim_admin_profile() to authenticated;

create function public.reorder_main_resources(ids uuid[]) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.resources r set sort_order = o.ord::integer
    from unnest(ids) with ordinality as o(id, ord)
   where r.id = o.id and r.artist_id is null;
end $$;
revoke execute on function public.reorder_main_resources(uuid[]) from public, anon;
grant execute on function public.reorder_main_resources(uuid[]) to authenticated;

create function public.take_storage_garbage() returns table (bucket text, path text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query delete from private.storage_garbage g returning g.bucket, g.path;
end $$;
revoke execute on function public.take_storage_garbage() from public, anon;
grant execute on function public.take_storage_garbage() to authenticated;

create function public.save_artist(payload jsonb) returns uuid
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
    raise exception 'duplicate email' using errcode = '23505', constraint = 'artist_emails_artist_id_email_key';
  end if;

  if v_id is null then
    insert into public.artists (name, slug, created_by)
    values (btrim(payload ->> 'name'), payload ->> 'slug', auth.uid())
    returning id into v_id;
  else
    update public.artists
       set name = btrim(payload ->> 'name'), slug = payload ->> 'slug'
     where id = v_id;
    if not found then
      raise exception 'artist not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.artist_emails ae
   where ae.artist_id = v_id
     and not exists (select 1 from jsonb_array_elements(v_emails) e
                      where lower(btrim(e ->> 'email')) = ae.email);
  update public.artist_emails set is_primary = false where artist_id = v_id;
  insert into public.artist_emails (artist_id, email, label, is_primary)
  select v_id, lower(btrim(e ->> 'email')), nullif(btrim(e ->> 'label'), ''),
         coalesce((e ->> 'isPrimary')::boolean, false)
    from jsonb_array_elements(v_emails) e
  on conflict (artist_id, email) do update
    set label = excluded.label, is_primary = excluded.is_primary;

  delete from public.artist_hidden_resources where artist_id = v_id;
  insert into public.artist_hidden_resources (artist_id, resource_id)
  select v_id, h::uuid from jsonb_array_elements_text(v_hidden) h
  on conflict do nothing;

  delete from public.resources x
   where x.artist_id = v_id
     and not exists (select 1 from jsonb_array_elements(v_excl) r
                      where (r ->> 'id')::uuid = x.id);

  insert into public.resources as t
    (id, artist_id, title, type, file, url, cover_image, cover_image_alt, cover_image_lqip,
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
  where t.artist_id = v_id;

  return v_id;
end $$;
revoke execute on function public.save_artist(jsonb) from public, anon;
grant execute on function public.save_artist(jsonb) to authenticated;

create function public.hook_before_user_created(event jsonb) returns jsonb
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
     and exists (select 1 from public.artist_emails where email = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Not approved'));
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;

grant select on public.admins, public.artist_emails to supabase_auth_admin;
create policy admins_auth_hook on public.admins for select to supabase_auth_admin using (true);
create policy artist_emails_auth_hook on public.artist_emails for select to supabase_auth_admin using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resource-files', 'resource-files', false, 1073741824,
   array['application/pdf', 'video/mp4', 'video/quicktime', 'video/webm',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint', 'application/vnd.apple.keynote']),
  ('resource-images', 'resource-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admins manage resource objects" on storage.objects for all to authenticated
  using (bucket_id in ('resource-files', 'resource-images') and public.is_admin())
  with check (bucket_id in ('resource-files', 'resource-images') and public.is_admin());

create policy "viewers read visible files" on storage.objects for select to authenticated
  using (bucket_id = 'resource-files'
         and exists (select 1 from public.resources r where r.file = storage.objects.name));
