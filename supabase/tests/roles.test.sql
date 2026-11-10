begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into public.admins (email, role) values
  ('boss@vydia.com', 'super'),
  ('rep1@vydia.com', 'regular'),
  ('rep2@vydia.com', 'regular')
on conflict (email) do update set role = excluded.role;

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'rep1@vydia.com'),
  ('55555555-5555-5555-5555-555555555555', 'boss@vydia.com');

insert into public.clients (id, name, slug, assigned_admin) values
  ('00000000-0000-0000-0000-0000000000a1', 'Rep1 Client', 'rep1-client', 'rep1@vydia.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'Rep2 Client', 'rep2-client', 'rep2@vydia.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'Orphan', 'orphan', null);
insert into public.client_emails (client_id, email, is_primary) values
  ('00000000-0000-0000-0000-0000000000a1', 'one@example.com', true),
  ('00000000-0000-0000-0000-0000000000a2', 'two@example.com', true);
insert into public.resources (id, client_id, title, type, url, category) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Core', 'link', 'https://core.test', 'Getting Started'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Rep1 only', 'link', 'https://e1.test', 'Yours'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', 'Rep2 only', 'link', 'https://e2.test', 'Yours');

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"rep1@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';

select ok(public.is_admin() and not public.is_super_admin(), 'a listed regular admin is not a super admin');
select is((select count(*)::int from public.admins), 1, 'regular admins read only their own admin row');
select is((select count(*)::int from public.clients), 1, 'regular admins list only their clients');
select ok(public.get_client_page('rep1-client') is not null, 'regular admins open their client page');
select ok(public.get_client_page('rep2-client') is null, 'another admin''s client page is invisible');
select ok(public.get_client_page('orphan') is null, 'unassigned clients are invisible to regular admins');
select is((select count(*)::int from public.client_emails), 1, 'regular admins read only their clients'' emails');
select is((select count(*)::int from public.resources where client_id is null), 1, 'regular admins read core resources');
select is((select count(*)::int from public.resources where title = 'Rep1 only'), 1, 'regular admins read their clients'' resources');
select is((select count(*)::int from public.resources where title = 'Rep2 only'), 0, 'regular admins never see other clients'' resources');

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

select lives_ok(
  $$ select public.save_client(jsonb_build_object('name', 'Fresh', 'slug', 'fresh-client',
       'emails', jsonb_build_array(jsonb_build_object('email', 'fresh@example.com', 'isPrimary', true)))) $$,
  'regular admins can create clients'
);
select is((select assigned_admin::text from public.clients where slug = 'fresh-client'), 'rep1@vydia.com',
  'a new client is assigned to its creator');
select lives_ok(
  $$ select public.save_client(jsonb_build_object('id', (select id from public.clients where slug = 'fresh-client'),
       'name', 'Fresh renamed', 'slug', 'fresh-client',
       'emails', jsonb_build_array(jsonb_build_object('email', 'fresh@example.com', 'isPrimary', true)))) $$,
  'regular admins can edit their own clients'
);

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

delete from public.clients where slug = 'fresh-client';
delete from public.clients where id = '00000000-0000-0000-0000-0000000000a2';
reset role;
select is((select count(*)::int from public.clients where slug = 'fresh-client'), 0,
  'regular admins can delete their own clients');
select is((select count(*)::int from public.clients where id = '00000000-0000-0000-0000-0000000000a2'), 1,
  'regular admins cannot delete another admin''s client');

set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('resource-files', 'rep1-upload/file-1.pdf') $$,
  'regular admins can upload to the resource buckets'
);

set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","email":"stranger@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';
select is((select count(*)::int from public.clients), 0, 'an unlisted Google account sees no clients');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('resource-files', 'stranger/file-1.pdf') $$,
  '42501', null, 'unlisted accounts cannot upload to the resource buckets'
);

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"rep1@vydia.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';
select is((select count(*)::int from public.clients where id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'a magic-link session for an admin address manages nothing');

set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","email":"boss@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';

select ok(public.is_super_admin(), 'a listed super admin is a super admin');
select ok((select count(*)::int from public.admins) >= 3, 'super admins read the full admin list');
select is((select count(*)::int from public.clients), 3, 'super admins see every client, including unassigned');
select ok(public.get_client_page('orphan') is not null, 'super admins open any client page');
select lives_ok(
  $$ update public.resources set title = 'Core v2' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'super admins update core resources'
);
reset role;
select is((select title from public.resources where id = '00000000-0000-0000-0000-0000000000c1'), 'Core v2',
  'super admins edit core resources');

select * from finish();
rollback;
