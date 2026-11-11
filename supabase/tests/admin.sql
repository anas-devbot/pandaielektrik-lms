-- Ujian modul admin (slice 12): tindakan direkod, tetapan polisi, sesi live, pelajar tersangkut. ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/admin.sql
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

insert into staff_invites values ('ad-adm@t.local','admin'),('ad-rev@t.local','reviewer');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ad-' || n || '@t.local','{"privacy_accepted":true,"full_name":"Pelajar Admin","phone":"0123456789"}'
from generate_series(1, 12) n;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ad-adm@t.local','{"full_name":"Ujian Pengguna","phone":"0123456789"}'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ad-rev@t.local','{"full_name":"Ujian Pengguna","phone":"0123456789"}');
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','ad','Kursus Admin',14900,'{"max_mcq_attempts":2,"access_months":6,"claim_expiry_days":3,"pass_mark_mcq":70}'),
  ('cccccccc-0000-0000-0000-0000000000c2','ad5','Kursus 5 hari',14900,'{"max_mcq_attempts":2,"stuck_inactive_days":5}');
insert into chapters (id, course_id, position, title) values ('bbbbbbbb-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1',1,'B1');
insert into lessons (id, course_id, chapter_id, position, title, video_ref, duration_seconds) values ('11111111-0000-0000-0000-0000000000f1','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',1,'L1','v1',600);
\set adm '''aaaaaaaa-0000-0000-0000-0000000000f1'''
\set rev '''aaaaaaaa-0000-0000-0000-0000000000f2'''
\set c1 '''cccccccc-0000-0000-0000-0000000000c1'''
create function pg_temp.e(n int) returns uuid language sql as $$ select ('eeeeeeee-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.mk(n int, course uuid, created_ago interval, ends_in interval, stage text default 'enrolled', refunded boolean default false) returns void language plpgsql as $$
begin
  insert into enrollments (id, user_id, course_id, stage, access_ends_at, created_at, refunded_at)
  values (pg_temp.e(n), ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, course, stage, now() + ends_in, now() - created_ago, case when refunded then now() end);
end $$;
create function pg_temp.reasons(n int) returns text language sql as $$ select coalesce(string_agg(reason, ',' order by reason), '-') from stuck_students() where enrollment_id = pg_temp.e(n) $$;

-- 1. pelajar tersangkut
select pg_temp.mk(1, :c1, interval '13 days', interval '90 days');
select pg_temp.mk(2, :c1, interval '15 days', interval '90 days');
select pg_temp.mk(3, :c1, interval '30 days', interval '90 days');
insert into lesson_progress (enrollment_id, lesson_id, watched_seconds_unique, last_heartbeat_at) values (pg_temp.e(3), '11111111-0000-0000-0000-0000000000f1', 10, now() - interval '1 day');
select pg_temp.eq('13 hari tanpa aktiviti: belum tersangkut', pg_temp.reasons(1), '-');
select pg_temp.eq('15 hari tanpa aktiviti: tersangkut', pg_temp.reasons(2), 'tiada_aktiviti');
select pg_temp.eq('hari tanpa aktiviti dikira (15)', (select detail->>'days' from stuck_students() where enrollment_id = pg_temp.e(2) and reason='tiada_aktiviti'), '15');
select pg_temp.eq('heartbeat semalam: tidak tersangkut walau enrollment lama', pg_temp.reasons(3), '-');
-- config kursus mengatasi default 14 hari
select pg_temp.mk(11, 'cccccccc-0000-0000-0000-0000000000c2', interval '6 days', interval '90 days');
select pg_temp.eq('config stuck_inactive_days=5: 6 hari = tersangkut', pg_temp.reasons(11), 'tiada_aktiviti');
-- MCQ habis had
select pg_temp.mk(4, :c1, interval '1 day', interval '90 days');
insert into quiz_attempts (enrollment_id, type, attempt_no, question_ids, submitted_at, passed, score_pct) values
  (pg_temp.e(4),'final',1,'{}',now(),false,10),(pg_temp.e(4),'final',2,'{}',now(),false,20);
select pg_temp.eq('2 percubaan gagal (had 2): MCQ habis', pg_temp.reasons(4), 'mcq_had_habis');
update enrollments set mcq_extra_attempts = 1 where id = pg_temp.e(4);
select pg_temp.eq('selepas percubaan tambahan: tidak lagi tersangkut', pg_temp.reasons(4), '-');
select pg_temp.mk(5, :c1, interval '1 day', interval '90 days');
insert into quiz_attempts (enrollment_id, type, attempt_no, question_ids, submitted_at, passed, score_pct) values (pg_temp.e(5),'final',1,'{}',now(),false,10),(pg_temp.e(5),'final',2,'{}',now(),true,90);
select pg_temp.eq('sudah lulus: tidak tersangkut', pg_temp.reasons(5), '-');
-- baki akses
select pg_temp.mk(6, :c1, interval '1 day', interval '20 days');
select pg_temp.mk(7, :c1, interval '1 day', interval '5 days');
select pg_temp.mk(8, :c1, interval '1 day', interval '40 days');
select pg_temp.eq('baki 20 hari: amaran 30 hari sahaja', pg_temp.reasons(6), 'akses_30');
select pg_temp.eq('baki 5 hari: amaran 7 hari sahaja (bukan 30)', pg_temp.reasons(7), 'akses_7');
select pg_temp.eq('baki 40 hari: tiada amaran', pg_temp.reasons(8), '-');
select pg_temp.eq('hari baki dikira', (select detail->>'days_left' from stuck_students() where enrollment_id = pg_temp.e(7)), '5');
-- dikecualikan
select pg_temp.mk(9, :c1, interval '40 days', interval '5 days', 'enrolled', true);
select pg_temp.mk(10, :c1, interval '40 days', interval '5 days', 'completed');
select pg_temp.mk(12, :c1, interval '40 days', interval '-1 day');
select pg_temp.eq('refunded dikecualikan', pg_temp.reasons(9), '-');
select pg_temp.eq('completed dikecualikan', pg_temp.reasons(10), '-');
select pg_temp.eq('akses sudah tamat dikecualikan', pg_temp.reasons(12), '-');

-- 2. extend_access
create temp table n0 as select count(*) c from admin_actions;
select pg_temp.fails('extend: bukan admin', format($q$select extend_access(%L,%L,30,'x')$q$, :rev, pg_temp.e(7)), 'actor_not_admin');
select pg_temp.fails('extend: tanpa sebab', format($q$select extend_access(%L,%L,30,' ')$q$, :adm, pg_temp.e(7)), 'reason_required');
select pg_temp.fails('extend: 0 hari', format($q$select extend_access(%L,%L,0,'x')$q$, :adm, pg_temp.e(7)), 'bad_days');
select pg_temp.fails('extend: 366 hari', format($q$select extend_access(%L,%L,366,'x')$q$, :adm, pg_temp.e(7)), 'bad_days');
select pg_temp.fails('extend: refunded', format($q$select extend_access(%L,%L,30,'x')$q$, :adm, pg_temp.e(9)), 'refunded');
select extend_access(:adm, pg_temp.e(7), 30, 'Pelajar sakit');
select pg_temp.eq('extend: akses +30 hari dari tarikh akhir semasa', (select (access_ends_at > now() + interval '34 days' and access_ends_at < now() + interval '36 days')::text from enrollments where id = pg_temp.e(7)), 'true');
select pg_temp.eq('extend: tak lagi dalam amaran 7 hari', pg_temp.reasons(7), '-');
select extend_access(:adm, pg_temp.e(12), 10, 'Pelajar tamat akses');
select pg_temp.eq('extend dari akses tamat: dikira dari sekarang', (select (access_ends_at > now() + interval '9 days' and access_ends_at < now() + interval '11 days')::text from enrollments where id = pg_temp.e(12)), 'true');
select pg_temp.eq('extend: direkod admin_actions (detail lama/baharu)', (select count(*)::text from admin_actions where action='extend_access' and reason='Pelajar sakit' and detail ? 'old_end' and detail ? 'new_end'), '1');

-- 3. update_course_config
select pg_temp.fails('config: bukan admin', format($q$select update_course_config(%L,%L,'{pass_mark_mcq}','75','x')$q$, :rev, :c1), 'actor_not_admin');
select pg_temp.fails('config: tanpa sebab', format($q$select update_course_config(%L,%L,'{pass_mark_mcq}','75',' ')$q$, :adm, :c1), 'reason_required');
select pg_temp.fails('config: kunci luar senarai putih (price)', format($q$select update_course_config(%L,%L,'{price}','1','x')$q$, :adm, :c1), 'key_not_allowed');
select pg_temp.fails('config: kunci rawak', format($q$select update_course_config(%L,%L,'{foo}','1','x')$q$, :adm, :c1), 'key_not_allowed');
select pg_temp.fails('config: markah lulus 101', format($q$select update_course_config(%L,%L,'{pass_mark_mcq}','101','x')$q$, :adm, :c1), 'out_of_range');
select pg_temp.fails('config: markah lulus 0', format($q$select update_course_config(%L,%L,'{pass_mark_mcq}','0','x')$q$, :adm, :c1), 'out_of_range');
select pg_temp.fails('config: integer 70.5', format($q$select update_course_config(%L,%L,'{pass_mark_mcq}','70.5','x')$q$, :adm, :c1), 'out_of_range');
select pg_temp.fails('config: jenis salah (teks untuk nombor)', format($q$select update_course_config(%L,%L,'{pass_mark_mcq}','"tujuh puluh"','x')$q$, :adm, :c1), 'bad_value');
select pg_temp.fails('config: schematic_max_mb melebihi had badan permintaan (11)', format($q$select update_course_config(%L,%L,'{schematic_max_mb}','12','x')$q$, :adm, :c1), 'out_of_range');
select pg_temp.fails('config: bool bukan boolean', format($q$select update_course_config(%L,%L,'{certificate,wording_approved}','"ya"','x')$q$, :adm, :c1), 'bad_value');
select pg_temp.fails('config: teks > 4000', format($q$select update_course_config(%L,%L,'{energize_guidance_text}', to_jsonb(repeat('a', 4001)),'x')$q$, :adm, :c1), 'bad_value');
select pg_temp.eq('config: ubah markah lulus', (update_course_config(:adm, :c1, '{pass_mark_mcq}', '75', 'AHZ putuskan 75')->>'new'), '75');
select pg_temp.eq('config: nilai baharu dalam courses', (select config->>'pass_mark_mcq' from courses where id=:c1), '75');
select pg_temp.eq('config: log lama dan baharu', (select (detail->>'old' = '70' and detail->>'new' = '75' and detail->>'key' = 'pass_mark_mcq')::text from admin_actions where action='config_changed' and reason='AHZ putuskan 75'), 'true');
select update_course_config(:adm, :c1, '{certificate,wording_approved}', 'true', 'AHZ luluskan wording');
select pg_temp.eq('config: bool bersarang (certificate.wording_approved)', (select config#>>'{certificate,wording_approved}' from courses where id=:c1), 'true');
select update_course_config(:adm, :c1, '{energize_guidance_text}', '"Teks panduan keselamatan AHZ"', 'Teks daripada AHZ');
select pg_temp.eq('config: teks panduan keselamatan boleh ditetapkan dan direkod', (select detail->>'new' from admin_actions where action='config_changed' and detail->>'key'='energize_guidance_text'), 'Teks panduan keselamatan AHZ');
select pg_temp.eq('config: kunci lain tidak terjejas', (select config->>'access_months' from courses where id=:c1), '6');

-- 4. sesi live
select pg_temp.fails('sesi: bukan admin', format($q$select upsert_session(%L,null,%L,now(),null,'x',10,'open')$q$, :rev, :c1), 'actor_not_admin');
select pg_temp.fails('sesi: status tak sah', format($q$select upsert_session(%L,null,%L,now(),null,'x',10,'xyz')$q$, :adm, :c1), 'bad_status');
select pg_temp.fails('sesi: tamat sebelum mula', format($q$select upsert_session(%L,null,%L,now(),now()-interval '1 day','x',10,'open')$q$, :adm, :c1), 'bad_dates');
select pg_temp.fails('sesi: kapasiti negatif', format($q$select upsert_session(%L,null,%L,now(),null,'x',-1,'open')$q$, :adm, :c1), 'bad_capacity');
create temp table ss (k text primary key, id uuid);
insert into ss select 'a', upsert_session(:adm, null, :c1, now() + interval '30 days', now() + interval '31 days', '  Dewan AHZ  ', 30, 'draft');
select pg_temp.eq('sesi dicipta (venue trim)', (select venue_or_link||'|'||capacity||'|'||status from course_sessions where id=(select id from ss where k='a')), 'Dewan AHZ|30|draft');
select upsert_session(:adm, (select id from ss where k='a'), :c1, now() + interval '30 days', null, 'Dewan AHZ', 30, 'open');
select pg_temp.eq('sesi dikemas kini', (select status from course_sessions where id=(select id from ss where k='a')), 'open');
select pg_temp.fails('sesi: kursus salah = tidak dijumpai', format($q$select upsert_session(%L,%L,'cccccccc-0000-0000-0000-0000000000c2',now(),null,'x',1,'open')$q$, :adm, (select id from ss where k='a')), 'not_found');
select pg_temp.eq('sesi: dua tindakan direkod', (select count(*)::text from admin_actions where action='session_saved'), '2');
select id as sid from ss where k='a' \gset
set local role anon;
select count(*)::text as c_open from course_sessions where id = :'sid' \gset
reset role;
select pg_temp.eq('anon nampak sesi open', :'c_open', '1');
update course_sessions set status='draft' where id=(select id from ss where k='a');
set local role anon;
select count(*)::text as c_draft from course_sessions where id = :'sid' \gset
reset role;
select pg_temp.eq('anon tak nampak sesi draft', :'c_draft', '0');

-- 5. setiap tindakan baharu direkod
select pg_temp.eq('admin_actions bertambah untuk setiap tindakan admin (extend 2 + config 3 + sesi 2 = 7), gagal tidak direkod', ((select count(*) from admin_actions) - (select c from n0))::text, '7');

-- 6. klien tak boleh panggil
set local role authenticated;
select pg_temp.fails('authenticated tak boleh stuck_students', $q$select * from stuck_students()$q$, 'permission denied for function stuck_students');
select pg_temp.fails('authenticated tak boleh update_course_config', $q$select update_course_config(gen_random_uuid(),gen_random_uuid(),'{pass_mark_mcq}','1','x')$q$, 'permission denied for function update_course_config');
select pg_temp.fails('authenticated tak boleh extend_access', $q$select extend_access(gen_random_uuid(),gen_random_uuid(),1,'x')$q$, 'permission denied for function extend_access');
select pg_temp.fails('authenticated tak boleh ubah courses.config terus', $q$update public.courses set config = '{}'$q$, 'permission denied for table courses');
rollback;
