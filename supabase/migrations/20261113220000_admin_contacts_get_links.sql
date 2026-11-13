-- A Vydia admin can also be listed on a client (as a manager, say). They now get that client's link like any other
-- email on it. This is safe because is_admin() requires a Google (oauth) session, so a session from an emailed link is
-- never an admin session, even for an admin's address. It only reaches the pages of clients the address is listed on.

create or replace function public.unsent_access_links(p_client_id uuid)
returns table (email text, token text, client_name text, slug text)
language sql stable security definer set search_path = '' as $$
  select l.email::text, l.token, c.name, c.slug
    from private.access_links l
    join public.clients c on c.id = l.client_id
   where l.client_id = p_client_id
     and l.sent_at is null
   order by l.created_at, l.email
$$;

create or replace function public.access_link_for(p_slug text, p_email text)
returns table (email text, token text, client_name text, slug text)
language sql stable security definer set search_path = '' as $$
  select l.email::text, l.token, c.name, c.slug
    from public.clients c
    join private.access_links l on l.client_id = c.id
   where c.slug = lower(btrim(p_slug))
     and l.email = lower(btrim(p_email))
$$;

create or replace function public.open_access_link(p_token text)
returns table (email text, slug text)
language sql volatile security definer set search_path = '' as $$
  update private.access_links l
     set last_used_at = now()
    from public.clients c
   where l.token = p_token
     and c.id = l.client_id
  returning l.email::text, c.slug
$$;

-- An admin who has never signed in with Google has no user yet, so opening their link creates one through the email
-- provider. Allow that for any address listed on a client. They still only get admin rights from a Google sign-in.
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
  if v_provider = 'email' and exists (select 1 from public.client_emails where email = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Not approved'));
end $$;

notify pgrst, 'reload schema';
