-- The 60-second resend cooldown on a client page was per email, so asking for a link on client A's page and then on
-- client B's page within a minute silently sent nothing for B. Key it on email + slug instead.

alter table private.link_sends add column slug text not null default '';
alter table private.link_sends drop constraint link_sends_pkey;
alter table private.link_sends add primary key (email, slug);

create function public.claim_link_send(p_email text, p_slug text) returns boolean
language sql volatile security definer set search_path = '' as $$
  with claimed as (
    insert into private.link_sends as s (email, slug, sent_at)
    values (lower(btrim(p_email)), lower(btrim(p_slug)), now())
    on conflict (email, slug) do update set sent_at = now()
      where s.sent_at < now() - interval '60 seconds'
    returning 1
  )
  select exists (select 1 from claimed)
$$;
revoke execute on function public.claim_link_send(text, text) from public, anon, authenticated;
grant execute on function public.claim_link_send(text, text) to service_role;

-- The one-argument version is what the currently deployed code calls. It keeps working (one cooldown per email, as
-- before) until that deploy is replaced. Drop it in a later migration.
create or replace function public.claim_link_send(p_email text) returns boolean
language sql volatile security definer set search_path = '' as $$
  select public.claim_link_send(p_email, '')
$$;

notify pgrst, 'reload schema';
