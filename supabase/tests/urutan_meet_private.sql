-- Ujian: urutan_global (turutan), dan lajur sesi awam selepas pembersihan. ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/urutan_meet_private.sql
begin;
create function pg_temp.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if; raise notice 'lulus: %', label; end $$;

-- Jalankan SQL sebagai peranan tertentu; pulangkan 'OK' atau mesej ralat (tanpa mengangkat ralat).
create function pg_temp.as_err(who text, sql text) returns text language plpgsql as $$
declare msg text := 'OK';
begin
  execute format('set local role %I', who);
  begin execute sql; exception when others then msg := sqlerrm; end;
  execute 'reset role';
  return msg;
end $$;

-- Data uji
insert into courses (id, slug, title, price, config) values ('cccccccc-0000-0000-0000-0000000000d1', 'ur', 'Kursus Urutan', 14900, '{}');
insert into course_sessions (id, course_id, starts_at, status, venue_or_link)
  values ('dddddddd-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-0000000000d1', now() + interval '7 days', 'open', 'Google Meet');
insert into chapters (id, course_id, position, title) values ('eeeeeeee-0000-0000-0000-0000000000f1', 'cccccccc-0000-0000-0000-0000000000d1', 1, 'Bab Ujian');
insert into lessons (course_id, chapter_id, position, title, video_ref, duration_seconds, urutan_global)
  values ('cccccccc-0000-0000-0000-0000000000d1', 'eeeeeeee-0000-0000-0000-0000000000f1', 1, 'Video A', 'URUTAN-A', 60, 1);

-- 1. urutan_global unik per kursus
do $$ begin
  insert into lessons (course_id, chapter_id, position, title, video_ref, duration_seconds, urutan_global)
    values ('cccccccc-0000-0000-0000-0000000000d1', 'eeeeeeee-0000-0000-0000-0000000000f1', 2, 'Video B', 'URUTAN-B', 60, 1);
  raise exception 'GAGAL: urutan_global pendua diterima';
exception when unique_violation then raise notice 'lulus: urutan_global pendua ditolak'; end $$;

-- 2. Lajur sesi awam: anon dan authenticated boleh baca sesi
select pg_temp.eq('anon baca sesi', pg_temp.as_err('anon', 'select id, starts_at, venue_or_link, status from course_sessions'), 'OK');
select pg_temp.eq('authenticated baca sesi', pg_temp.as_err('authenticated', 'select id, starts_at, venue_or_link, status from course_sessions'), 'OK');

-- 3. Jadual dan RPC pautan dah tiada
select pg_temp.eq('course_private dibuang', (select count(*)::text from information_schema.tables where table_schema = 'public' and table_name = 'course_private'), '0');
select pg_temp.eq('set_course_links dibuang', (select count(*)::text from pg_proc where proname = 'set_course_links'), '0');
select pg_temp.eq('meet_link dibuang', (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'course_sessions' and column_name = 'meet_link'), '0');

-- 4. Pautan tidak masuk courses.config
select pg_temp.eq('config kursus tidak berubah', (select config::text from courses where id = 'cccccccc-0000-0000-0000-0000000000d1'), '{}');

rollback;
