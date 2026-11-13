begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into public.admins (email, role) values ('links-admin@vydia.com', 'super')
  on conflict (email) do update set role = 'super';
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'links-admin@vydia.com');

-- As an admin, through save_client, the way the app does it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"links-admin@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';

create temp table ids (name text primary key, id uuid) on commit drop;
insert into ids values ('first', public.save_client('{
  "name": "Links One", "slug": "links-one",
  "emails": [{"email": "Same@Example.com", "isPrimary": true}, {"email": "links-admin@vydia.com", "isPrimary": false}]
}'::jsonb));
insert into ids values ('second', public.save_client('{
  "name": "Links Two", "slug": "links-two",
  "emails": [{"email": "same@example.com", "isPrimary": true}]
}'::jsonb));

select throws_ok(
  $$ select * from private.access_links $$,
  '42501', null,
  'admins can’t read link tokens directly'
);

reset role;
create temp table first_token on commit drop as
  select token from private.access_links where client_id = (select id from ids where name = 'first') and email = 'same@example.com';

select is(
  (select count(*)::int from private.access_links where email = 'same@example.com'),
  2,
  'the same email on two clients gets a link for each'
);
select isnt(
  (select token from private.access_links where client_id = (select id from ids where name = 'first') and email = 'same@example.com'),
  (select token from private.access_links where client_id = (select id from ids where name = 'second') and email = 'same@example.com'),
  'each client’s link is different'
);
select ok(
  (select bool_and(char_length(token) = 64) from private.access_links where email = 'same@example.com'),
  'tokens are 32 random bytes'
);
select is(
  array(select email from public.unsent_access_links((select id from ids where name = 'first'))),
  array['same@example.com'],
  'a new client’s emails are waiting to be sent, except an admin’s'
);

select public.mark_access_links_sent(array(select token from public.unsent_access_links((select id from ids where name = 'first'))));
select is_empty(
  $$ select * from public.unsent_access_links((select id from ids where name = 'first')) $$,
  'marking a link sent clears it'
);

-- Saving again with one kept email and one new email.
set local role authenticated;
select public.save_client(jsonb_build_object(
  'id', (select id from ids where name = 'first'), 'name', 'Links One', 'slug', 'links-one',
  'emails', '[{"email": "same@example.com", "isPrimary": true}, {"email": "new@example.com", "isPrimary": false}]'::jsonb
));
reset role;

select is(
  array(select email from public.unsent_access_links((select id from ids where name = 'first'))),
  array['new@example.com'],
  'only the newly added email is waiting after a resave'
);
select is(
  (select token from private.access_links where client_id = (select id from ids where name = 'first') and email = 'same@example.com'),
  (select token from first_token),
  'a kept email keeps its link'
);

select is(
  (select row(email, slug)::text from public.open_access_link((select token from first_token))),
  row('same@example.com', 'links-one')::text,
  'opening a link gives the email and the page'
);
select is(
  (select row(email, slug)::text from public.open_access_link((select token from first_token))),
  row('same@example.com', 'links-one')::text,
  'the link works again: it never gets used up'
);
select isnt(
  (select last_used_at from private.access_links where token = (select token from first_token)),
  null,
  'opening a link records when'
);
select is_empty($$ select * from public.open_access_link('not-a-token') $$, 'a made-up token opens nothing');

-- Links never expire: nothing about age or past use stops one working.
update private.access_links
   set created_at = now() - interval '10 years', sent_at = now() - interval '10 years',
       last_used_at = now() - interval '9 years'
 where token = (select token from first_token);
select is(
  (select email from public.open_access_link((select token from first_token))),
  'same@example.com',
  'a link created and last used years ago still opens'
);
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('open_access_link', 'access_link_for')
       and p.prosrc ~* '(now\(\)|interval|created_at|sent_at|expire)'
       and p.proname <> 'open_access_link'
  ) and (select prosrc from pg_proc where proname = 'open_access_link') !~* '(interval|created_at|sent_at|expire|<|>)',
  'the link lookups have no time or expiry condition at all'
);

-- Changing the client's URL keeps the link working and sends people to the new URL.
set local role authenticated;
select public.save_client(jsonb_build_object(
  'id', (select id from ids where name = 'first'), 'name', 'Links One', 'slug', 'links-one-renamed',
  'emails', '[{"email": "same@example.com", "isPrimary": true}, {"email": "new@example.com", "isPrimary": false}]'::jsonb
));
reset role;
select is(
  (select slug from public.open_access_link((select token from first_token))),
  'links-one-renamed',
  'a link survives a change of the client’s URL and lands on the new one'
);
select is(
  (select token from public.access_link_for('links-one-renamed', 'same@example.com')),
  (select token from first_token),
  'the email form on the new URL sends the same link'
);

select is(
  (select token from public.access_link_for(' Links-One-Renamed ', 'SAME@example.com')),
  (select token from first_token),
  'the email form finds the link for that email on that slug'
);
select is_empty(
  $$ select * from public.access_link_for('links-one-renamed', 'links-admin@vydia.com') $$,
  'an admin listed on a client never gets an email link'
);

-- Removing the email kills the link, even one already in an inbox.
set local role authenticated;
select public.save_client(jsonb_build_object(
  'id', (select id from ids where name = 'first'), 'name', 'Links One', 'slug', 'links-one-renamed',
  'emails', '[{"email": "new@example.com", "isPrimary": true}]'::jsonb
));
reset role;
select is_empty(
  $$ select * from public.open_access_link((select token from first_token)) $$,
  'removing the email from the client deactivates its link'
);

set local role anon;
select throws_ok(
  $$ select * from public.open_access_link('anything') $$,
  '42501', null,
  'the public API can’t open links itself'
);
reset role;

select * from finish();
rollback;
