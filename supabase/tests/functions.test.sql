begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into public.admins (email, role) values ('ops@vydia.com', 'super')
  on conflict (email) do update set role = 'super';
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ops@vydia.com');

insert into public.clients (id, name, slug) values
  ('00000000-0000-0000-0000-0000000000a1', 'Hook Client', 'hook-client');
insert into public.client_emails (client_id, email, is_primary) values
  ('00000000-0000-0000-0000-0000000000a1', 'client@example.com', true),
  ('00000000-0000-0000-0000-0000000000a1', 'ops@vydia.com', false);

select is(
  public.hook_before_user_created('{"user":{"email":"Client@Example.com","app_metadata":{"provider":"email"}}}'::jsonb),
  '{}'::jsonb,
  'hook allows an email on a client'
);
select is(
  (public.hook_before_user_created('{"user":{"email":"stranger@example.com","app_metadata":{"provider":"email"}}}'::jsonb) -> 'error' ->> 'http_code')::int,
  403,
  'hook rejects an unknown email'
);
select is(
  (public.hook_before_user_created('{"user":{"email":"ops@vydia.com","app_metadata":{"provider":"email"}}}'::jsonb) -> 'error' ->> 'http_code')::int,
  403,
  'hook rejects an admin through the email provider'
);
select is(
  public.hook_before_user_created('{"user":{"email":"ops@vydia.com","app_metadata":{"provider":"google"}}}'::jsonb),
  '{}'::jsonb,
  'hook allows a listed admin through Google'
);
select is(
  (public.hook_before_user_created('{"user":{"email":"client@example.com","app_metadata":{"provider":"google"}}}'::jsonb) -> 'error' ->> 'http_code')::int,
  403,
  'hook rejects a non-admin through Google'
);

select ok(public.email_can_access_slug('hook-client', ' Client@Example.com '), 'a linked pair can sign in, case-insensitively');
select ok(not public.email_can_access_slug('hook-client', 'wrong@example.com'), 'a wrong email cannot');
select ok(not public.email_can_access_slug('nope', 'client@example.com'), 'an unknown slug cannot');
select ok(not public.email_can_access_slug('hook-client', 'ops@vydia.com'), 'an admin address cannot use the client flow');

select ok(public.claim_link_send('Cooldown@Example.com'), 'the first send is allowed');
select ok(not public.claim_link_send('cooldown@example.com'), 'a second send inside 60 seconds is refused');
update private.link_sends set sent_at = now() - interval '61 seconds' where email = 'cooldown@example.com';
select ok(public.claim_link_send('cooldown@example.com'), 'a send after 60 seconds is allowed');

select ok(public.claim_link_send('Both@Example.com', 'client-a'), 'a send for client A is allowed');
select ok(public.claim_link_send('both@example.com', 'Client-B'), 'the same email on client B isn’t held up by client A’s cooldown');
select ok(not public.claim_link_send('both@example.com', 'client-a'), 'a second send for client A inside 60 seconds is refused');

select ok(public.hit_rate_limit('test:key', 2, interval '10 minutes'), 'hit 1 is under the limit');
select ok(public.hit_rate_limit('test:key', 2, interval '10 minutes'), 'hit 2 is under the limit');
select ok(not public.hit_rate_limit('test:key', 2, interval '10 minutes'), 'hit 3 is over the limit');

insert into public.resources (id, client_id, title, type, url, category, sort_order) values
  ('00000000-0000-0000-0000-0000000000d1', null, 'Main A', 'link', 'https://a.test', 'Docs', 1),
  ('00000000-0000-0000-0000-0000000000d2', null, 'Main B', 'link', 'https://b.test', 'Docs', 2),
  ('00000000-0000-0000-0000-0000000000d3', null, 'Main C', 'link', 'https://c.test', 'Docs', 3);

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"ops@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';

create temp table saved as
select public.save_client('{
  "name": "Saved Client",
  "slug": "saved-client",
  "emails": [
    {"email": "One@Example.com", "label": "Client", "isPrimary": true},
    {"email": "two@example.com", "label": "Manager", "isPrimary": false}
  ],
  "hiddenResourceIds": ["00000000-0000-0000-0000-0000000000d1"],
  "exclusiveResources": [
    {"id": "00000000-0000-0000-0000-0000000000f1", "title": "Plan", "type": "pdf",
     "file": "f1/file-1.pdf", "category": "Your Releases"}
  ]
}'::jsonb) as id;

select is((select count(*)::int from public.clients where slug = 'saved-client'), 1, 'save_client creates the client');
select is((select count(*)::int from public.client_emails where client_id = (select id from saved)), 2, 'save_client creates the emails');
select is((select count(*)::int from public.client_hidden_resources where client_id = (select id from saved)), 1, 'save_client creates the hides');
select is((select count(*)::int from public.resources where client_id = (select id from saved)), 1, 'save_client creates the exclusive resources');

select public.save_client(jsonb_build_object(
  'id', (select id from saved),
  'name', 'Renamed Client',
  'slug', 'saved-client',
  'emails', '[{"email": "two@example.com", "label": "Manager", "isPrimary": true}]'::jsonb,
  'hiddenResourceIds', '[]'::jsonb,
  'exclusiveResources', '[
    {"id": "00000000-0000-0000-0000-0000000000f1", "title": "Plan", "type": "pdf",
     "file": "f1/file-1.pdf", "category": "Your Releases"},
    {"id": "00000000-0000-0000-0000-0000000000d1", "title": "Hacked", "type": "link",
     "url": "https://evil.test", "category": "Docs"}
  ]'::jsonb
));

select is((select name from public.clients where id = (select id from saved)), 'Renamed Client', 'editing updates the name');
select is((select count(*)::int from public.client_emails where client_id = (select id from saved)), 1, 'editing removes dropped emails');
select is((select email::text from public.client_emails where client_id = (select id from saved) and is_primary), 'two@example.com', 'editing moves the primary');
select is((select count(*)::int from public.client_hidden_resources where client_id = (select id from saved)), 0, 'editing clears the hides');
select is((select title from public.resources where id = '00000000-0000-0000-0000-0000000000d1'), 'Main A', 'a payload id can never overwrite a main resource');

select throws_ok(
  $$ select public.save_client('{
    "name": "Dup", "slug": "dup-client",
    "emails": [
      {"email": "x@example.com", "isPrimary": true},
      {"email": "X@example.com", "isPrimary": false}
    ]
  }'::jsonb) $$,
  '23505', null, 'a duplicate email is rejected'
);
select is((select count(*)::int from public.clients where slug = 'dup-client'), 0, 'a rejected save leaves nothing behind');
select throws_ok(
  $$ select public.save_client('{
    "name": "No Primary", "slug": "no-primary",
    "emails": [{"email": "y@example.com", "isPrimary": false}]
  }'::jsonb) $$,
  '23514', null, 'a save without a primary email is rejected'
);
select throws_ok(
  $$ insert into public.client_hidden_resources (client_id, resource_id)
     values ((select id from saved), '00000000-0000-0000-0000-0000000000f1') $$,
  '23514', null, 'an exclusive resource cannot be hidden'
);

select public.reorder_main_resources(array[
  '00000000-0000-0000-0000-0000000000d3'::uuid,
  '00000000-0000-0000-0000-0000000000f1'::uuid,
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  '00000000-0000-0000-0000-0000000000d2'::uuid
]);

select is(
  (select array_agg(title order by sort_order) from public.resources where client_id is null and title like 'Main %'),
  array['Main C', 'Main A', 'Main B'],
  'reordering applies to main resources'
);
select is((select sort_order from public.resources where id = '00000000-0000-0000-0000-0000000000f1'), 1, 'reordering never touches exclusive resources');

update public.resources set file = 'f1/file-2.pdf' where id = '00000000-0000-0000-0000-0000000000f1';
delete from public.clients where id = (select id from saved);

reset role;
select ok(
  exists (select 1 from private.storage_garbage where bucket = 'resource-files' and path = 'f1/file-1.pdf'),
  'a replaced file is queued for cleanup'
);
select ok(
  exists (select 1 from private.storage_garbage where bucket = 'resource-files' and path = 'f1/file-2.pdf'),
  'deleting a client queues its exclusive files'
);

select * from finish();
rollback;
