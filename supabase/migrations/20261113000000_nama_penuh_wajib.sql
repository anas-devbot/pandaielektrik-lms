-- Nama penuh wajib: nama ini dipaparkan pada sijil. Buang fallback emel dalam handle_new_user:
-- nama kosong kini ditolak, bukan diganti dengan bahagian emel. Susunan semakan kekal: privasi dahulu, kemudian nama.
-- Belum dijalankan di produksi (perlu kelulusan Bos, lihat runbook: produksi tiada supabase_migrations).

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invite public.staff_invites;
  accepted boolean := coalesce(new.raw_user_meta_data->>'privacy_accepted', '') = 'true';
  nama text := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
begin
  delete from public.staff_invites where email = lower(new.email) returning * into invite;
  if invite.email is null and not accepted then
    raise exception 'privacy_not_accepted' using errcode = 'P0001';
  end if;
  if nama is null then
    raise exception 'nama_penuh_wajib' using errcode = 'P0001';
  end if;
  insert into public.profiles (id, full_name, role, privacy_accepted_at, privacy_version)
  values (
    new.id,
    nama,
    coalesce(invite.role, 'student'),
    case when accepted then now() end,
    case when accepted then new.raw_user_meta_data->>'privacy_version' end
  );
  return new;
end $$;
