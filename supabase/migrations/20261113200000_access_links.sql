-- Permanent sign-in links. Every client–email pair gets one reusable link. Removing the email from the client deletes
-- the link, so that is how access is taken away. Page access is still checked against the live client_emails rows
-- on every load.

create table private.access_links (
  client_id    uuid not null,
  email        public.email_address not null,
  token        text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at   timestamptz not null default now(),
  -- Null until the welcome email for this pair has gone out.
  sent_at      timestamptz,
  last_used_at timestamptz,
  primary key (client_id, email),
  foreign key (client_id, email) references public.client_emails (client_id, email) on delete cascade
);

-- Emails that are already on a client count as sent, so shipping this doesn't email everyone on their next save.
insert into private.access_links (client_id, email, sent_at)
select client_id, email, now() from public.client_emails;

-- A new client–email row gets a fresh link. save_client upserts emails it keeps, which fires no INSERT trigger, so
-- only emails that are actually new (including one removed and added again) get a new link and a welcome email.
create function private.create_access_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.access_links (client_id, email) values (new.client_id, new.email)
  on conflict (client_id, email) do nothing;
  return new;
end $$;
revoke execute on function private.create_access_link() from public, anon, authenticated;

create trigger client_emails_access_link
  after insert on public.client_emails
  for each row execute function private.create_access_link();

-- Admins sign in with Google only, so they never get an email link even when listed on a client.

create function public.unsent_access_links(p_client_id uuid)
returns table (email text, token text, client_name text, slug text)
language sql stable security definer set search_path = '' as $$
  select l.email::text, l.token, c.name, c.slug
    from private.access_links l
    join public.clients c on c.id = l.client_id
   where l.client_id = p_client_id
     and l.sent_at is null
     and not exists (select 1 from public.admins a where a.email = l.email)
   order by l.created_at, l.email
$$;

-- The link for an email on the client at this slug, or no row when that email isn't on that client.
create function public.access_link_for(p_slug text, p_email text)
returns table (email text, token text, client_name text, slug text)
language sql stable security definer set search_path = '' as $$
  select l.email::text, l.token, c.name, c.slug
    from public.clients c
    join private.access_links l on l.client_id = c.id
   where c.slug = lower(btrim(p_slug))
     and l.email = lower(btrim(p_email))
     and not exists (select 1 from public.admins a where a.email = l.email)
$$;

create function public.mark_access_links_sent(p_tokens text[]) returns void
language sql volatile security definer set search_path = '' as $$
  update private.access_links set sent_at = now() where token = any (p_tokens)
$$;

-- Opening a link: the email to sign in as and the page to land on, or no row when the link is gone.
create function public.open_access_link(p_token text)
returns table (email text, slug text)
language sql volatile security definer set search_path = '' as $$
  update private.access_links l
     set last_used_at = now()
    from public.clients c
   where l.token = p_token
     and c.id = l.client_id
     and not exists (select 1 from public.admins a where a.email = l.email)
  returning l.email::text, c.slug
$$;

revoke execute on function public.unsent_access_links(uuid), public.access_link_for(text, text),
  public.mark_access_links_sent(text[]), public.open_access_link(text)
  from public, anon, authenticated;
grant execute on function public.unsent_access_links(uuid), public.access_link_for(text, text),
  public.mark_access_links_sent(text[]), public.open_access_link(text)
  to service_role;

notify pgrst, 'reload schema';
