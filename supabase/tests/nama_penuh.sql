-- Ujian nama penuh wajib (trigger handle_new_user). Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/nama_penuh.sql
begin;
create function pg_temp.mk(id uuid, usr jsonb) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (id, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', id::text||'@t.local', '{}', usr) $$;
create function pg_temp.fails(label text, sql text, want text) returns void language plpgsql as $$
begin
  begin execute sql; raise exception 'GAGAL %: tidak ditolak', label;
  exception when others then
    if sqlerrm like 'GAGAL%' then raise; end if;
    if sqlerrm <> want then raise exception 'GAGAL %: ralat % (mahu %)', label, sqlerrm, want; end if;
    raise notice 'lulus: %', label;
  end;
end $$;
create function pg_temp.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if; raise notice 'lulus: %', label; end $$;

-- 1. nama kosong ditolak (walaupun privasi diterima)
select pg_temp.fails('nama kosong ditolak',
  $q$select pg_temp.mk('55555555-0000-0000-0000-000000000001','{"privacy_accepted":true,"full_name":"   "}')$q$, 'nama_penuh_wajib');
select pg_temp.fails('nama tiada medan ditolak',
  $q$select pg_temp.mk('55555555-0000-0000-0000-000000000002','{"privacy_accepted":true}')$q$, 'nama_penuh_wajib');

-- 2. privasi tetap diutamakan (susunan semakan tidak berubah)
select pg_temp.fails('tanpa privasi dan tanpa nama: privasi dahulu',
  $q$select pg_temp.mk('55555555-0000-0000-0000-000000000003','{}')$q$, 'privacy_not_accepted');

-- 3. tiada fallback emel: tiada profil dicipta untuk nama kosong
select pg_temp.eq('tiada profil untuk nama kosong',
  (select count(*)::text from profiles where id in ('55555555-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000002')), '0');

-- 4. nama sah disimpan seperti dihantar
select pg_temp.mk('55555555-0000-0000-0000-000000000004','{"privacy_accepted":true,"privacy_version":"draf-1","full_name":"Ali bin Abu","phone":"0123456789"}');
select pg_temp.eq('nama sah disimpan', (select full_name from profiles where id='55555555-0000-0000-0000-000000000004'), 'Ali bin Abu');

-- 5. staf jemputan tetap boleh dicipta dengan nama
insert into staff_invites (email, role) values ('55555555-0000-0000-0000-000000000005@t.local','reviewer');
select pg_temp.mk('55555555-0000-0000-0000-000000000005','{"full_name":"Fasi Satu"}');
select pg_temp.eq('staf jemputan dengan nama', (select role from profiles where id='55555555-0000-0000-0000-000000000005'), 'reviewer');

-- 6. telefon wajib untuk pelajar: tanpa telefon ditolak, tiada profil dicipta
select pg_temp.fails('pelajar tanpa telefon ditolak',
  $q$select pg_temp.mk('55555555-0000-0000-0000-000000000006','{"privacy_accepted":true,"privacy_version":"draf-2","full_name":"Siti Aminah"}')$q$, 'telefon_wajib');
select pg_temp.eq('tiada profil tanpa telefon', (select count(*)::text from profiles where id='55555555-0000-0000-0000-000000000006'), '0');

-- 6b. maklumat pilihan lain boleh kosong (telefon sahaja wajib)
select pg_temp.mk('55555555-0000-0000-0000-00000000000c','{"privacy_accepted":true,"privacy_version":"draf-2","full_name":"Siti Aminah","phone":"0123456789","gender":null,"age_range":null,"state":null,"district":null}');
select pg_temp.eq('pilihan lain kosong diterima', (select count(*)::text from profiles where id='55555555-0000-0000-0000-00000000000c' and state is null and gender is null), '1');

-- 7. maklumat pilihan disimpan seperti dihantar
select pg_temp.mk('55555555-0000-0000-0000-000000000007','{"privacy_accepted":true,"privacy_version":"draf-2","full_name":"Ahmad Rahman","phone":"0123456789","gender":"lelaki","age_range":"25-34","state":"Selangor","district":"Petaling"}');
select pg_temp.eq('maklumat pilihan disimpan', (select concat_ws('|', phone, gender, age_range, state, district) from profiles where id='55555555-0000-0000-0000-000000000007'), '0123456789|lelaki|25-34|Selangor|Petaling');

-- 8. nilai di luar senarai ditolak oleh DB
select pg_temp.fails('negeri tidak sah ditolak',
  $q$select pg_temp.mk('55555555-0000-0000-0000-000000000008','{"privacy_accepted":true,"full_name":"Ali Abu","phone":"0123456789","state":"Atlantis"}')$q$,
  'new row for relation "profiles" violates check constraint "profiles_state_check"');
select pg_temp.fails('jantina tidak sah ditolak',
  $q$select pg_temp.mk('55555555-0000-0000-0000-000000000009','{"privacy_accepted":true,"full_name":"Ali Abu","phone":"0123456789","gender":"lain"}')$q$,
  'new row for relation "profiles" violates check constraint "profiles_gender_check"');
select pg_temp.fails('julat umur tidak sah ditolak',
  $q$select pg_temp.mk('55555555-0000-0000-0000-00000000000a','{"privacy_accepted":true,"full_name":"Ali Abu","phone":"0123456789","age_range":"99"}')$q$,
  'new row for relation "profiles" violates check constraint "profiles_age_range_check"');
select pg_temp.fails('telefon tidak sah ditolak',
  $q$select pg_temp.mk('55555555-0000-0000-0000-00000000000b','{"privacy_accepted":true,"full_name":"Ali Abu","phone":"12345"}')$q$,
  'new row for relation "profiles" violates check constraint "profiles_phone_format"');

rollback;
