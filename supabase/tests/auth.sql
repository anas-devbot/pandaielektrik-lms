-- Ujian trigger auth (slice 3). Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/auth.sql
begin;
create function pg_temp.mk(id uuid, app jsonb, usr jsonb) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (id, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', id::text||'@t.local', app, usr) $$;
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

-- 1. tanpa persetujuan privasi: ditolak
select pg_temp.fails('daftar tanpa privasi ditolak',
  $q$select pg_temp.mk('11111111-0000-0000-0000-000000000001','{}','{"full_name":"X"}')$q$, 'privacy_not_accepted');
select pg_temp.fails('privacy_accepted=false ditolak',
  $q$select pg_temp.mk('11111111-0000-0000-0000-000000000002','{}','{"privacy_accepted":false}')$q$, 'privacy_not_accepted');

-- 2. daftar sah -> student, privasi direkod
select pg_temp.mk('22222222-0000-0000-0000-000000000001','{}','{"full_name":"Ali","privacy_accepted":true,"privacy_version":"v1","phone":"0123456789"}');
select pg_temp.eq('peranan lalai student', (select role from profiles where id='22222222-0000-0000-0000-000000000001'), 'student');
select pg_temp.eq('nama disimpan', (select full_name from profiles where id='22222222-0000-0000-0000-000000000001'), 'Ali');
select pg_temp.eq('masa persetujuan direkod', (select (privacy_accepted_at is not null)::text from profiles where id='22222222-0000-0000-0000-000000000001'), 'true');
select pg_temp.eq('versi notis direkod', (select privacy_version from profiles where id='22222222-0000-0000-0000-000000000001'), 'v1');

-- 3. eskalasi peranan melalui metadata tidak berkesan
select pg_temp.mk('33333333-0000-0000-0000-000000000001','{}','{"full_name":"Jahat","privacy_accepted":true,"role":"admin","phone":"0123456789"}');
select pg_temp.eq('role dalam user_metadata diabaikan', (select role from profiles where id='33333333-0000-0000-0000-000000000001'), 'student');
select pg_temp.mk('33333333-0000-0000-0000-000000000002','{"role":"admin","created_by_admin":"true"}','{"privacy_accepted":true,"full_name":"Jahat Dua","phone":"0123456789"}');
select pg_temp.eq('role dalam app_metadata diabaikan (guna staff_invites)', (select role from profiles where id='33333333-0000-0000-0000-000000000002'), 'student');

-- 4. staf: jemputan dalam staff_invites, tanpa borang privasi
insert into staff_invites (email, role) values
  ('44444444-0000-0000-0000-000000000001@t.local','reviewer'),
  ('44444444-0000-0000-0000-000000000002@t.local','approver'),
  ('44444444-0000-0000-0000-000000000003@t.local','admin');
select pg_temp.mk('44444444-0000-0000-0000-000000000001','{}','{"full_name":"Fasi"}');
select pg_temp.mk('44444444-0000-0000-0000-000000000002','{}','{"full_name":"Saiful"}');
select pg_temp.mk('44444444-0000-0000-0000-000000000003','{}','{"full_name":"Bos"}');
select pg_temp.eq('reviewer melalui jemputan', (select role from profiles where id='44444444-0000-0000-0000-000000000001'), 'reviewer');
select pg_temp.eq('approver melalui jemputan', (select role from profiles where id='44444444-0000-0000-0000-000000000002'), 'approver');
select pg_temp.eq('admin melalui jemputan', (select role from profiles where id='44444444-0000-0000-0000-000000000003'), 'admin');
select pg_temp.eq('jemputan dihabiskan', (select count(*)::text from staff_invites), '0');
select pg_temp.fails('emel tanpa jemputan masih perlu privasi',
  $q$select pg_temp.mk('44444444-0000-0000-0000-000000000004','{}','{"full_name":"Lain"}')$q$, 'privacy_not_accepted');

-- 5. klien tak boleh baca/ubah staff_invites atau profiles.role
insert into staff_invites (email, role) values ('x@t.local','admin');
set local role authenticated;
select pg_temp.fails('authenticated tak boleh baca staff_invites', $q$select * from public.staff_invites$q$, 'permission denied for table staff_invites');
select set_config('request.jwt.claims', json_build_object('sub','22222222-0000-0000-0000-000000000001','role','authenticated')::text, true);
select pg_temp.fails('student tak boleh update role sendiri',
  $q$update public.profiles set role='admin' where id='22222222-0000-0000-0000-000000000001'$q$, 'permission denied for table profiles');
select pg_temp.fails('student tak boleh tukar privacy_accepted_at',
  $q$update public.profiles set privacy_accepted_at=null where id='22222222-0000-0000-0000-000000000001'$q$, 'permission denied for table profiles');

rollback;
