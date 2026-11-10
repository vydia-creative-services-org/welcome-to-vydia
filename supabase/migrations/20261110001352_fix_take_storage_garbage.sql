create or replace function public.take_storage_garbage() returns table (bucket text, path text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query delete from private.storage_garbage g where true returning g.bucket, g.path;
end $$;
