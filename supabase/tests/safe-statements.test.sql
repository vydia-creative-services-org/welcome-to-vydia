begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select is_empty(
  $$
    select p.proname::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace,
      lateral regexp_matches(p.prosrc, '((?:delete\s+from|update)\s+(?:public|private)\.[^;]*)', 'gi') as m
     where n.nspname in ('public', 'private')
       and m[1] !~* '\mwhere\M'
  $$,
  'every DELETE and UPDATE in our functions has a WHERE clause (pg_safeupdate rejects the rest when called through the API)'
);

select * from finish();
rollback;
