begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.admins (email) values ('ops@vydia.com') on conflict do nothing;

insert into public.artists (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Artist A', 'artist-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Artist B', 'artist-b');
insert into public.artist_emails (artist_id, email, label, is_primary) values
  ('00000000-0000-0000-0000-00000000000a', 'lil@example.com', 'Artist', true),
  ('00000000-0000-0000-0000-00000000000a', 'manager@mgmt.com', 'Manager', false),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'Artist', true);
insert into public.resources (id, artist_id, title, type, url, category) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Main 1', 'link', 'https://a.test', 'Getting Started'),
  ('00000000-0000-0000-0000-0000000000c2', null, 'Main 2', 'link', 'https://b.test', 'getting started'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'A only', 'link', 'https://c.test', 'Your Releases');
insert into public.artist_hidden_resources values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2');

select is(
  (select category from public.resources where title = 'Main 2'),
  'Getting Started',
  'categories normalize case-insensitively'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"manager@mgmt.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';

select ok(public.get_artist_page('artist-a') is not null, 'a linked email sees its artist');
select ok(public.get_artist_page('artist-b') is null, 'another artist is invisible, same as an unknown slug');
select ok(public.get_artist_page('does-not-exist') is null, 'an unknown slug returns null');
select is(
  jsonb_array_length(public.get_artist_page('artist-a') -> 'resources'),
  2,
  'the page has the visible main resource plus the exclusive, not the hidden one'
);
select is((select count(*)::int from public.resources where artist_id is null), 1, 'artist users can read the main resources their artist does not hide');
select is((select count(*)::int from public.artist_emails), 0, 'artist users cannot read email lists');
select ok(not public.is_admin(), 'a magic-link session is never admin');
select throws_ok($$ select public.save_artist('{}'::jsonb) $$, '42501', null, 'artist users cannot write');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"b@example.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';

select is((select count(*)::int from public.resources where title = 'A only'), 0, 'exclusive resources never reach other artists');
select is((select count(*)::int from public.resources where title = 'Main 2'), 1, 'a hide on one artist does not affect another');

reset role;
delete from public.artist_emails where email = 'manager@mgmt.com';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"manager@mgmt.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';
select ok(public.get_artist_page('artist-a') is null, 'a removed email loses access on the next query');

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"ops@vydia.com","role":"authenticated","amr":[{"method":"oauth","timestamp":0}]}';
select ok(public.is_admin(), 'a listed @vydia.com Google session is admin');
select ok(public.get_artist_page('artist-b') is not null, 'admins see every artist page directly');

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"ops@vydia.com","role":"authenticated","amr":[{"method":"otp","timestamp":0}]}';
select ok(not public.is_admin(), 'a magic-link session for an admin address is not admin');

select * from finish();
rollback;
