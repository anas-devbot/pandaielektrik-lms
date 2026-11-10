-- Ujian: urutan_global (turutan), pautan Meet tersembunyi, course_private, RPC set_course_links. ROLLBACK di hujung.
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
insert into staff_invites values ('ur-adm@t.local', 'admin');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ur-adm@t.local', '{"privacy_accepted":true,"full_name":"Admin Urutan"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ur-std@t.local', '{"privacy_accepted":true,"full_name":"Pelajar Urutan"}');
insert into courses (id, slug, title, price, config) values ('cccccccc-0000-0000-0000-0000000000d1', 'ur', 'Kursus Urutan', 14900, '{}');
insert into course_sessions (id, course_id, starts_at, status, venue_or_link)
  values ('dddddddd-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-0000000000d1', now() + interval '7 days', 'open', 'Google Meet');
insert into chapters (id, course_id, position, title) values ('eeeeeeee-0000-0000-0000-0000000000f1', 'cccccccc-0000-0000-0000-0000000000d1', 1, 'Bab Ujian');
insert into lessons (course_id, chapter_id, position, title, video_ref, duration_seconds, urutan_global)
  values ('cccccccc-0000-0000-0000-0000000000d1', 'eeeeeeee-0000-0000-0000-0000000000f1', 1, 'Video A', 'URUTAN-A', 60, 1);

-- 1. Profil admin wujud (syarat untuk RPC)
select pg_temp.eq('profil admin', (select role from profiles where id = 'bbbbbbbb-0000-0000-0000-00000000000a'), 'admin');

-- 2. urutan_global unik per kursus
do $$ begin
  insert into lessons (course_id, chapter_id, position, title, video_ref, duration_seconds, urutan_global)
    values ('cccccccc-0000-0000-0000-0000000000d1', 'eeeeeeee-0000-0000-0000-0000000000f1', 2, 'Video B', 'URUTAN-B', 60, 1);
  raise exception 'GAGAL: urutan_global pendua diterima';
exception when unique_violation then raise notice 'lulus: urutan_global pendua ditolak'; end $$;

-- 3. Lajur awam sesi: anon/authenticated boleh baca lajur awam, TIDAK boleh baca meet_link
select pg_temp.eq('anon baca venue_or_link', pg_temp.as_err('anon', 'select venue_or_link from course_sessions'), 'OK');
select pg_temp.eq('anon tak boleh baca meet_link', (pg_temp.as_err('anon', 'select meet_link from course_sessions') like 'permission denied%')::text, 'true');
select pg_temp.eq('authenticated tak boleh baca meet_link', (pg_temp.as_err('authenticated', 'select meet_link from course_sessions') like 'permission denied%')::text, 'true');

-- 4. course_private: hanya service_role
select pg_temp.eq('anon tak boleh baca course_private', (pg_temp.as_err('anon', 'select * from course_private') like 'permission denied%')::text, 'true');
select pg_temp.eq('authenticated tak boleh baca course_private', (pg_temp.as_err('authenticated', 'select * from course_private') like 'permission denied%')::text, 'true');
select pg_temp.eq('service_role boleh baca course_private', pg_temp.as_err('service_role', 'select telegram_chat_link from course_private'), 'OK');

-- 5. RPC set_course_links: tidak boleh dipanggil daripada klien
select pg_temp.eq('authenticated tak boleh panggil RPC', (pg_temp.as_err('authenticated', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', null, null, null, ''sebab'')') like 'permission denied%')::text, 'true');

-- 6. RPC: pelaku bukan admin ditolak; sebab wajib; pautan tidak sah ditolak
select pg_temp.eq('pelaku bukan admin ditolak', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000b'', ''cccccccc-0000-0000-0000-0000000000d1'', null, null, null, ''sebab'')'), 'actor_not_admin');
select pg_temp.eq('sebab wajib', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', null, null, null, '' '')'), 'reason_required');
select pg_temp.eq('pautan Meet tidak sah ditolak', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', ''dddddddd-0000-0000-0000-0000000000e1'', ''https://evil.example/x'', null, ''sebab'')'), 'bad_meet_link');
select pg_temp.eq('pautan Telegram tidak sah ditolak', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', null, null, ''https://wa.me/123'', ''sebab'')'), 'bad_telegram_link');

-- 7. RPC: admin sah -> tulis Meet dan Telegram, rekod admin_actions tanpa pautan
select pg_temp.eq('admin sah diterima', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', ''dddddddd-0000-0000-0000-0000000000e1'', ''https://meet.google.com/abc-defg-hij'', ''https://t.me/+ujianUrutan'', ''Pautan sesi pertama'')'), 'OK');
select pg_temp.eq('meet_link disimpan', (select meet_link from course_sessions where id = 'dddddddd-0000-0000-0000-0000000000e1'), 'https://meet.google.com/abc-defg-hij');
select pg_temp.eq('telegram disimpan dalam course_private', (select telegram_chat_link from course_private where course_id = 'cccccccc-0000-0000-0000-0000000000d1'), 'https://t.me/+ujianUrutan');
select pg_temp.eq('pautan tidak masuk courses.config', (select config::text from courses where id = 'cccccccc-0000-0000-0000-0000000000d1'), '{}');
select pg_temp.eq('rekod admin_actions tanpa pautan', (select (detail->>'telegram_set') || ':' || (detail->>'meet_set') || ':' || (reason) from admin_actions where action = 'config_changed' and detail->>'key' = 'course_links'), 'true:true:Pautan sesi pertama');
select pg_temp.eq('detail admin_actions tiada URL', (select (detail::text like '%t.me%' or detail::text like '%meet.google%')::text from admin_actions where action = 'config_changed' and detail->>'key' = 'course_links'), 'false');

-- 7b. Kosong = tidak diubah: kemas kini Meet sahaja tidak memadam pautan Telegram
select pg_temp.eq('tiada pautan ditolak', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', null, null, null, ''sebab'')'), 'nothing_to_set');
select pg_temp.eq('meet tanpa sesi ditolak', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', null, ''https://meet.google.com/xyz-abcd-efg'', null, ''sebab'')'), 'session_required');
select pg_temp.eq('kemas kini Meet sahaja', pg_temp.as_err('service_role', 'select set_course_links(''bbbbbbbb-0000-0000-0000-00000000000a'', ''cccccccc-0000-0000-0000-0000000000d1'', ''dddddddd-0000-0000-0000-0000000000e1'', ''https://meet.google.com/xyz-abcd-efg'', null, ''Tukar Meet'')'), 'OK');
select pg_temp.eq('telegram kekal selepas kemas kini Meet', (select telegram_chat_link from course_private where course_id = 'cccccccc-0000-0000-0000-0000000000d1'), 'https://t.me/+ujianUrutan');
select pg_temp.eq('meet dikemas kini', (select meet_link from course_sessions where id = 'dddddddd-0000-0000-0000-0000000000e1'), 'https://meet.google.com/xyz-abcd-efg');

-- 8. Sesi awam tidak mendedahkan pautan walaupun sudah diisi
select pg_temp.eq('anon nampak sesi tanpa meet', pg_temp.as_err('anon', 'select venue_or_link, meet_link from course_sessions'), 'permission denied for table course_sessions');

rollback;
