-- Ujian admin_set_phone (tukar telefon oleh admin). LOCAL sahaja. ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/admin_telefon.sql
begin;
create function pg_temp.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if; raise notice 'lulus: %', label; end $$;
create function pg_temp.fails(label text, sql text, want text) returns void language plpgsql as $$
begin
  begin execute sql; raise exception 'GAGAL %: tidak ditolak', label;
  exception when others then
    if sqlerrm like 'GAGAL%' then raise; end if;
    if sqlerrm <> want then raise exception 'GAGAL %: ralat % (mahu %)', label, sqlerrm, want; end if;
    raise notice 'lulus: %', label;
  end;
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tel-adm@t.local','{"full_name":"Admin Telefon","phone":"0123456789","privacy_accepted":true}'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tel-stu@t.local','{"full_name":"Pelajar Telefon","phone":"0123456789","privacy_accepted":true}');
update profiles set role = 'admin' where id = 'bbbbbbbb-0000-0000-0000-0000000000a1';
insert into courses (id, slug, title, price, config) values ('cccccccc-0000-0000-0000-0000000000d1','tel','Kursus Telefon',14900,'{}');
insert into enrollments (id, user_id, course_id, access_ends_at) values
  ('dddddddd-0000-0000-0000-0000000000e1','bbbbbbbb-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000d1', now() + interval '6 months');

-- 1. Tukar berjaya
select admin_set_phone('bbbbbbbb-0000-0000-0000-0000000000a1','bbbbbbbb-0000-0000-0000-0000000000b1','0198765432','Pelajar tukar nombor');
select pg_temp.eq('telefon dikemas kini', (select phone from profiles where id='bbbbbbbb-0000-0000-0000-0000000000b1'), '0198765432');

-- 2. Rekod admin_actions wujud, dikaitkan dengan pendaftaran, dan TIADA nombor telefon dalam detail
select pg_temp.eq('rekod phone_changed', (select count(*)::text from admin_actions where action='phone_changed' and enrollment_id='dddddddd-0000-0000-0000-0000000000e1' and actor_id='bbbbbbbb-0000-0000-0000-0000000000a1'), '1');
select pg_temp.eq('nombor tak masuk log', (select (detail::text like '%0198765432%')::text from admin_actions where action='phone_changed' order by id desc limit 1), 'false');

-- 3. Semakan ditolak
select pg_temp.fails('sebab wajib', $q$select admin_set_phone('bbbbbbbb-0000-0000-0000-0000000000a1','bbbbbbbb-0000-0000-0000-0000000000b1','0111111111',' ')$q$, 'reason_required');
select pg_temp.fails('format salah (bukan 01)', $q$select admin_set_phone('bbbbbbbb-0000-0000-0000-0000000000a1','bbbbbbbb-0000-0000-0000-0000000000b1','0812345678','uji')$q$, 'bad_phone');
select pg_temp.fails('terlalu pendek', $q$select admin_set_phone('bbbbbbbb-0000-0000-0000-0000000000a1','bbbbbbbb-0000-0000-0000-0000000000b1','012345','uji')$q$, 'bad_phone');
select pg_temp.fails('pelaku bukan admin', $q$select admin_set_phone('bbbbbbbb-0000-0000-0000-0000000000b1','bbbbbbbb-0000-0000-0000-0000000000b1','0111111111','uji')$q$, 'actor_not_admin');
select pg_temp.fails('pelajar tak wujud', $q$select admin_set_phone('bbbbbbbb-0000-0000-0000-0000000000a1','bbbbbbbb-0000-0000-0000-00000000ffff','0111111111','uji')$q$, 'not_found');
select pg_temp.eq('telefon tak berubah selepas semakan gagal', (select phone from profiles where id='bbbbbbbb-0000-0000-0000-0000000000b1'), '0198765432');

rollback;
