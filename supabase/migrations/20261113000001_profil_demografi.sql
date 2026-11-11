-- Maklumat pilihan pada profil: jantina, julat umur, negeri, daerah. Telefon sedia ada (profiles.phone).
-- Semua medan pilihan (boleh null). Nilai disahkan di DB supaya tidak bergantung pada app sahaja.
-- Belum dijalankan di produksi (perlu kelulusan Bos; produksi tiada supabase_migrations).

alter table public.profiles
  add column if not exists gender text check (gender in ('lelaki', 'perempuan')),
  add column if not exists age_range text check (age_range in ('bawah-18', '18-24', '25-34', '35-44', '45-54', '55+')),
  add column if not exists state text check (state in (
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Pulau Pinang', 'Perak',
    'Perlis', 'Selangor', 'Terengganu', 'Sabah', 'Sarawak',
    'Wilayah Persekutuan Kuala Lumpur', 'Wilayah Persekutuan Labuan', 'Wilayah Persekutuan Putrajaya')),
  add column if not exists district text check (char_length(district) between 2 and 60);

-- Format telefon Malaysia (mudah alih): 01 + 8 atau 9 digit. NOT VALID supaya rekod lama yang tak standard tak menyekat migration;
-- VALIDATE selepas semak data produksi.
alter table public.profiles
  add constraint profiles_phone_format check (phone is null or phone ~ '^01[0-9]{8,9}$') not valid;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invite public.staff_invites;
  accepted boolean := coalesce(new.raw_user_meta_data->>'privacy_accepted', '') = 'true';
  nama text := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  tel text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
begin
  delete from public.staff_invites where email = lower(new.email) returning * into invite;
  if invite.email is null and not accepted then
    raise exception 'privacy_not_accepted' using errcode = 'P0001';
  end if;
  if nama is null then
    raise exception 'nama_penuh_wajib' using errcode = 'P0001';
  end if;
  -- Telefon wajib untuk pelajar. Staf (jemputan) tidak diminta telefon semasa daftar.
  if invite.email is null and tel is null then
    raise exception 'telefon_wajib' using errcode = 'P0001';
  end if;
  insert into public.profiles (id, full_name, phone, gender, age_range, state, district, role, privacy_accepted_at, privacy_version)
  values (
    new.id,
    nama,
    tel,
    nullif(new.raw_user_meta_data->>'gender', ''),
    nullif(new.raw_user_meta_data->>'age_range', ''),
    nullif(new.raw_user_meta_data->>'state', ''),
    nullif(trim(new.raw_user_meta_data->>'district'), ''),
    coalesce(invite.role, 'student'),
    case when accepted then now() end,
    case when accepted then new.raw_user_meta_data->>'privacy_version' end
  );
  return new;
end $$;
