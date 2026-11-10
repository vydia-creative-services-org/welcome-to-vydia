begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.admins (email, role) values ('ops@vydia.com', 'super')
  on conflict (email) do update set role = 'super';

insert into public.clients (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Client A', 'client-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Client B', 'client-b');
insert into public.client_emails (client_id, email, label, is_primary) values
  ('00000000-0000-0000-0000-00000000000a', 'lil@example.com', 'Client', true),
  ('00000000-0000-0000-0000-00000000000a', 'manager@mgmt.com', 'Manager', false),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'Client', true);
insert into public.resources (id, client_id, title, type, url, category) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Main 1', 'link', 'https://a.test', 'Getting Started'),
  ('00000000-0000-0000-0000-0000000000c2', null, 'Main 2', 'link', 'https://b.test', 'getting started'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'A only', 'link', 'https://c.test', 'Your Releases');
insert into public.client_hidden_resources values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2');

select is(
  (select category from public.resources where title = 'Main 2'),
  'Getting Started',
  'categories normalize case-insensitively'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"manager@mgmt.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';

select ok(public.get_client_page('client-a') is not null, 'a linked email sees its client');
select ok(public.get_client_page('client-b') is null, 'another client is invisible, same as an unknown slug');
select ok(public.get_client_page('does-not-exist') is null, 'an unknown slug returns null');
select is(
  jsonb_array_length(public.get_client_page('client-a') -> 'resources'),
  2,
  'the page has the visible main resource plus the exclusive, not the hidden one'
);
select is((select count(*)::int from public.resources where client_id is null), 1, 'client users can read the main resources their client does not hide');
select is((select count(*)::int from public.client_emails), 0, 'client users cannot read email lists');
select ok(not public.is_admin(), 'a magic-link session is never admin');
select throws_ok($$ select public.save_client('{}'::jsonb) $$, '42501', null, 'client users cannot write');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"b@example.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';

select is((select count(*)::int from public.resources where title = 'A only'), 0, 'exclusive resources never reach other clients');
select is((select count(*)::int from public.resources where title = 'Main 2'), 1, 'a hide on one client does not affect another');

reset role;
delete from public.client_emails where email = 'manager@mgmt.com';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"manager@mgmt.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';
select ok(public.get_client_page('client-a') is null, 'a removed email loses access on the next query');

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"ops@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';
select ok(public.is_admin(), 'a listed @vydia.com Google session is admin');
select ok(public.get_client_page('client-b') is not null, 'super admins see every client page directly');

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"ops@vydia.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';
select ok(not public.is_admin(), 'a magic-link session for an admin address is not admin');

select * from finish();
rollback;
