-- Slice 7: carian pengguna mengikut emel untuk tindakan admin (service_role sahaja; auth.users tak didedahkan kepada klien).
create function public.find_user_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke all on function public.find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_by_email(text) to service_role;
