-- Ujian pendedahan lajur peribadi pada profiles. Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/lajur_peribadi.sql
begin;
create function pg_temp.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if; raise notice 'lulus: %', label; end $$;

-- Jalankan SQL sebagai peranan tertentu; pulangkan 'OK' atau mesej ralat.
create function pg_temp.as_err(who text, sql text) returns text language plpgsql as $$
declare msg text := 'OK';
begin
  execute format('set local role %I', who);
  begin execute sql; exception when others then msg := sqlerrm; end;
  execute 'reset role';
  return msg;
end $$;

-- Data uji (sebagai postgres, sebelum tukar peranan)
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values ('77777777-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lp-a@t.local','{"full_name":"Lajur A","privacy_accepted":true,"phone":"0123456789","state":"Johor","gender":"lelaki"}');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values ('77777777-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lp-b@t.local','{"full_name":"Lajur B","privacy_accepted":true,"phone":"0129999999","state":"Kedah"}');

-- 1. authenticated tak boleh baca telefon atau demografi (walaupun baris sendiri)
select pg_temp.eq('authenticated tak boleh baca telefon',
  pg_temp.as_err('authenticated', 'select phone from public.profiles'), 'permission denied for table profiles');
select pg_temp.eq('authenticated tak boleh baca jantina',
  pg_temp.as_err('authenticated', 'select gender from public.profiles'), 'permission denied for table profiles');
select pg_temp.eq('authenticated tak boleh baca negeri',
  pg_temp.as_err('authenticated', 'select state from public.profiles'), 'permission denied for table profiles');
select pg_temp.eq('authenticated tak boleh baca daerah dan julat umur',
  pg_temp.as_err('authenticated', 'select district, age_range from public.profiles'), 'permission denied for table profiles');
select pg_temp.eq('authenticated tak boleh baca utm',
  pg_temp.as_err('authenticated', 'select utm_source from public.profiles'), 'permission denied for table profiles');

-- 2. lajur yang diperlukan klien masih boleh dibaca
select pg_temp.eq('authenticated boleh baca nama dan peranan',
  pg_temp.as_err('authenticated', 'select full_name, role from public.profiles'), 'OK');

-- 3. anon langsung tiada akses kepada profiles
select pg_temp.eq('anon tak boleh baca profiles',
  pg_temp.as_err('anon', 'select full_name from public.profiles'), 'permission denied for table profiles');

-- 4. kemas kini telefon sendiri masih dibenarkan (grant update tidak diubah)
select pg_temp.eq('pelajar boleh kemas kini telefon sendiri',
  pg_temp.as_err('authenticated', $q$update public.profiles set phone='0198888888' where id='77777777-0000-0000-0000-000000000001'$q$), 'OK');

-- 5. admin (server, peranan postgres/service) masih boleh baca telefon dan demografi
select pg_temp.eq('server boleh baca telefon untuk admin',
  (select phone from public.profiles where id='77777777-0000-0000-0000-000000000002'), '0129999999');

-- 6. lokasi sesi tidak boleh berisi pautan (dipaparkan awam di landing)
insert into courses (id, slug, title, price, config) values ('77777777-0000-0000-0000-0000000000c1','lp-course','LP',14900,'{}');
insert into course_sessions (course_id, starts_at, status, venue_or_link) values ('77777777-0000-0000-0000-0000000000c1', now() + interval '3 days', 'open', 'Google Meet');
select pg_temp.eq('lokasi teks biasa diterima', (select count(*)::text from course_sessions where course_id='77777777-0000-0000-0000-0000000000c1' and venue_or_link='Google Meet'), '1');
do $$ begin
  insert into course_sessions (course_id, starts_at, status, venue_or_link) values ('77777777-0000-0000-0000-0000000000c1', now() + interval '4 days', 'open', 'https://meet.google.com/abc-defg-hij');
  raise exception 'GAGAL: pautan dalam lokasi diterima';
exception when check_violation then raise notice 'lulus: pautan dalam lokasi ditolak'; end $$;

rollback;
