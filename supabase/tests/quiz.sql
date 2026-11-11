-- Ujian kuiz (slice 6). ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/quiz.sql
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

-- data: 2 pengguna, kursus (9 soalan per percubaan), 3 bab x 10 soalan akhir, 3 soalan latihan bab 1
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('aaaaaaaa-0000-0000-0000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','q-'||n||'@t.local','{"privacy_accepted":true,"full_name":"Ujian Pelajar","phone":"0123456789"}'
from (values ('a1'),('a2'),('a3')) v(n);
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','qt','QT',14900,'{"video_complete_pct":0.9,"mcq_count":9,"pass_mark_mcq":70,"max_mcq_attempts":3}'),
  ('cccccccc-0000-0000-0000-0000000000c2','qt-small','QT2',14900,'{"video_complete_pct":0.9,"mcq_count":9,"pass_mark_mcq":70,"max_mcq_attempts":3}'),
  ('cccccccc-0000-0000-0000-0000000000c3','qt-cfg','QT3',14900,'{}');
insert into chapters (id, course_id, position, title) values
  ('bbbbbbbb-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1',1,'B1'),
  ('bbbbbbbb-0000-0000-0000-0000000000b2','cccccccc-0000-0000-0000-0000000000c1',2,'B2'),
  ('bbbbbbbb-0000-0000-0000-0000000000b3','cccccccc-0000-0000-0000-0000000000c1',3,'B3'),
  ('bbbbbbbb-0000-0000-0000-0000000000b4','cccccccc-0000-0000-0000-0000000000c2',1,'S1'),
  ('bbbbbbbb-0000-0000-0000-0000000000b5','cccccccc-0000-0000-0000-0000000000c2',2,'S2'),
  ('bbbbbbbb-0000-0000-0000-0000000000b6','cccccccc-0000-0000-0000-0000000000c2',3,'S3'),
  ('bbbbbbbb-0000-0000-0000-0000000000b7','cccccccc-0000-0000-0000-0000000000c3',1,'C1');
-- bank: setiap soalan 4 pilihan A-D, A betul
create function pg_temp.mkq(course uuid, chap uuid, typ text, n int) returns void language plpgsql as $$
declare qid uuid; l text;
begin
  for i in 1..n loop
    insert into quiz_questions (course_id, chapter_id, type, body, explanation) values (course, chap, typ, 'Soalan '||typ||' '||i||' '||chap, 'Sebab '||i) returning id into qid;
    foreach l in array array['A','B','C','D'] loop insert into quiz_options (question_id, label, body, is_correct) values (qid, l, 'Pilihan '||l, l = 'A'); end loop;
  end loop;
end $$;
select pg_temp.mkq('cccccccc-0000-0000-0000-0000000000c1', ('bbbbbbbb-0000-0000-0000-0000000000b'||n)::uuid, 'final', 10) from generate_series(1,3) n;
select pg_temp.mkq('cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1','practice',3);
select pg_temp.mkq('cccccccc-0000-0000-0000-0000000000c2','bbbbbbbb-0000-0000-0000-0000000000b4','final',1);
select pg_temp.mkq('cccccccc-0000-0000-0000-0000000000c2','bbbbbbbb-0000-0000-0000-0000000000b5','final',10);
select pg_temp.mkq('cccccccc-0000-0000-0000-0000000000c2','bbbbbbbb-0000-0000-0000-0000000000b6','final',10);
select pg_temp.mkq('cccccccc-0000-0000-0000-0000000000c3','bbbbbbbb-0000-0000-0000-0000000000b7','final',50);

insert into lessons (id, course_id, chapter_id, position, title, video_ref, duration_seconds) values
  ('11111111-0000-0000-0000-0000000000f1','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',1,'L1','v1',100),
  ('11111111-0000-0000-0000-0000000000f2','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b2',1,'L2','v2',100),
  ('11111111-0000-0000-0000-0000000000f3','cccccccc-0000-0000-0000-0000000000c2','bbbbbbbb-0000-0000-0000-0000000000b4',1,'L3','v3',100);
insert into enrollments (id, user_id, course_id, access_ends_at) values
  ('eeeeeeee-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000c1', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e2','aaaaaaaa-0000-0000-0000-0000000000a2','cccccccc-0000-0000-0000-0000000000c1', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e3','aaaaaaaa-0000-0000-0000-0000000000a3','cccccccc-0000-0000-0000-0000000000c2', now()+interval '90 days');

-- pembantu
create function pg_temp.answers(att uuid, nright int) returns jsonb language sql as $$
  -- jawab setiap soalan: nright soalan pertama dengan pilihan A (betul), selebihnya B (salah)
  select jsonb_object_agg(qid, oid) from (
    select q.id qid, (select o.id from quiz_options o where o.question_id = q.id and o.label = case when rn <= nright then 'A' else 'B' end) oid
    from (select id, row_number() over (order by id) rn from quiz_questions where id in (select unnest(question_ids) from quiz_attempts where id = att)) q) z $$;
create function pg_temp.seen(att1 uuid, att2 uuid) returns int language sql as $$
  select count(*)::int from (select unnest(question_ids) x from quiz_attempts where id=att1) a where x in (select unnest(question_ids) from quiz_attempts where id=att2) $$;
create function pg_temp.perchap(att uuid, chap text) returns text language sql as $$
  select count(*)::text from quiz_questions where id in (select unnest(question_ids) from quiz_attempts where id=att) and chapter_id = chap::uuid $$;

-- 1. gate
select pg_temp.eq('gate tertutup (0/2 video)', (final_gate('eeeeeeee-0000-0000-0000-0000000000e1')->>'open'), 'false');
select pg_temp.fails('MCQ akhir ditolak sebelum video selesai', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e1','final')$q$, 'gate_closed');
insert into lesson_progress (enrollment_id, lesson_id, watched_seconds_unique) values ('eeeeeeee-0000-0000-0000-0000000000e1','11111111-0000-0000-0000-0000000000f1',50);
insert into lesson_progress (enrollment_id, lesson_id, watched_seconds_unique, completed_at) values ('eeeeeeee-0000-0000-0000-0000000000e1','11111111-0000-0000-0000-0000000000f2',95, now());
select pg_temp.fails('gate tertutup bila satu video belum 90%', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e1','final')$q$, 'gate_closed');
update lesson_progress set completed_at = now(), watched_seconds_unique = 90 where lesson_id='11111111-0000-0000-0000-0000000000f1';
select pg_temp.eq('gate terbuka bila semua video selesai', (final_gate('eeeeeeee-0000-0000-0000-0000000000e1')->>'open'), 'true');

-- 2. mula, agihan seimbang, sambung percubaan terbuka
create temp table att (n int primary key, id uuid);
insert into att select 1, start_quiz('eeeeeeee-0000-0000-0000-0000000000e1','final');
select pg_temp.eq('9 soalan setiap percubaan (mcq_count)', (select cardinality(question_ids)::text from quiz_attempts where id=(select id from att where n=1)), '9');
select pg_temp.eq('agihan seimbang bab 1 = 3', pg_temp.perchap((select id from att where n=1),'bbbbbbbb-0000-0000-0000-0000000000b1'), '3');
select pg_temp.eq('agihan seimbang bab 2 = 3', pg_temp.perchap((select id from att where n=1),'bbbbbbbb-0000-0000-0000-0000000000b2'), '3');
select pg_temp.eq('agihan seimbang bab 3 = 3', pg_temp.perchap((select id from att where n=1),'bbbbbbbb-0000-0000-0000-0000000000b3'), '3');
select pg_temp.eq('soalan latihan tak masuk MCQ akhir', (select count(*)::text from quiz_questions where type='practice' and id in (select unnest(question_ids) from quiz_attempts where id=(select id from att where n=1))), '0');
select pg_temp.eq('percubaan terbuka disambung (id sama)', (start_quiz('eeeeeeee-0000-0000-0000-0000000000e1','final') = (select id from att where n=1))::text, 'true');
select pg_temp.eq('stage jadi final_mcq', (select stage from enrollments where id='eeeeeeee-0000-0000-0000-0000000000e1'), 'final_mcq');

-- 3. kunci tidak bocor dalam muatan klien; susunan pilihan tetap
create temp table p1 as select get_attempt((select id from att where n=1),'eeeeeeee-0000-0000-0000-0000000000e1') j;
select pg_temp.eq('muatan ada 9 soalan', (select jsonb_array_length(j->'questions')::text from p1), '9');
select pg_temp.eq('muatan TIADA is_correct / correct_option_id / explanation', (select (j::text like '%is_correct%' or j::text like '%correct_option_id%' or j::text like '%explanation%' or j::text like '%Sebab%')::text from p1), 'false');
select pg_temp.eq('setiap soalan 4 pilihan', (select count(*)::text from p1, jsonb_array_elements(j->'questions') q where jsonb_array_length(q->'options') = 4), '9');
select pg_temp.eq('susunan soalan dan pilihan stabil antara panggilan', (select (get_attempt((select id from att where n=1),'eeeeeeee-0000-0000-0000-0000000000e1') = j)::text from p1), 'true');
select pg_temp.fails('pelajar lain tak boleh baca percubaan ini', $q$select get_attempt((select id from att where n=1),'eeeeeeee-0000-0000-0000-0000000000e2')$q$, 'not_found');
select pg_temp.fails('pelajar lain tak boleh hantar percubaan ini', $q$select submit_quiz((select id from att where n=1),'eeeeeeee-0000-0000-0000-0000000000e2','{}')$q$, 'not_found');

-- 4. markah dikira server; jawapan tak sah = salah
-- percubaan 1: semua salah (0%)
select pg_temp.eq('semua salah = 0%', (submit_quiz((select id from att where n=1),'eeeeeeee-0000-0000-0000-0000000000e1', pg_temp.answers((select id from att where n=1), 0))->>'score_pct'), '0.00');
select pg_temp.eq('gagal: passed = false', (select passed::text from quiz_attempts where id=(select id from att where n=1)), 'false');
select pg_temp.fails('hantar dua kali ditolak', $q$select submit_quiz((select id from att where n=1),'eeeeeeee-0000-0000-0000-0000000000e1','{}')$q$, 'already_submitted');
select pg_temp.eq('selepas hantar MCQ akhir tiada soalan/kunci dalam muatan', (select (get_attempt((select id from att where n=1),'eeeeeeee-0000-0000-0000-0000000000e1')->'questions' = '[]'::jsonb)::text), 'true');
-- percubaan 2: 6/9 = 66.67 (gagal, sempadan), elak soalan percubaan 1
insert into att select 2, start_quiz('eeeeeeee-0000-0000-0000-0000000000e1','final');
select pg_temp.eq('percubaan 2 tiada soalan yang sama dengan percubaan 1 (bank cukup)', pg_temp.seen((select id from att where n=1),(select id from att where n=2))::text, '0');
select pg_temp.eq('6/9 = 66.67', (submit_quiz((select id from att where n=2),'eeeeeeee-0000-0000-0000-0000000000e1', pg_temp.answers((select id from att where n=2), 6))->>'score_pct'), '66.67');
select pg_temp.eq('66.67 < 70 = gagal', (select passed::text from quiz_attempts where id=(select id from att where n=2)), 'false');
select pg_temp.eq('stage kekal final_mcq selepas gagal', (select stage from enrollments where id='eeeeeeee-0000-0000-0000-0000000000e1'), 'final_mcq');
-- percubaan 3: 7/9 = 77.78 lulus
insert into att select 3, start_quiz('eeeeeeee-0000-0000-0000-0000000000e1','final');
select pg_temp.eq('percubaan 3 tiada pertindihan dengan 1 dan 2', (pg_temp.seen((select id from att where n=1),(select id from att where n=3)) + pg_temp.seen((select id from att where n=2),(select id from att where n=3)))::text, '0');
select pg_temp.eq('7/9 = 77.78 lulus', (submit_quiz((select id from att where n=3),'eeeeeeee-0000-0000-0000-0000000000e1', pg_temp.answers((select id from att where n=3), 7))->>'passed'), 'true');
select pg_temp.eq('lulus membuka bahagian 2 (stage part2_review)', (select stage from enrollments where id='eeeeeeee-0000-0000-0000-0000000000e1'), 'part2_review');
select pg_temp.fails('sudah lulus: percubaan baharu ditolak', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e1','final')$q$, 'already_passed');

-- 5. pilihan milik soalan lain / id sampah dikira salah
insert into enrollments (id, user_id, course_id, access_ends_at) values ('eeeeeeee-0000-0000-0000-0000000000e4','aaaaaaaa-0000-0000-0000-0000000000a2','cccccccc-0000-0000-0000-0000000000c3', now()+interval '90 days');
insert into lessons (id, course_id, chapter_id, position, title, video_ref, duration_seconds) values ('11111111-0000-0000-0000-0000000000f4','cccccccc-0000-0000-0000-0000000000c3','bbbbbbbb-0000-0000-0000-0000000000b7',1,'L4','v4',100);
insert into lesson_progress (enrollment_id, lesson_id, completed_at, watched_seconds_unique) values ('eeeeeeee-0000-0000-0000-0000000000e4','11111111-0000-0000-0000-0000000000f4', now(), 100);
update courses set config = '{"video_complete_pct":0.9,"mcq_count":4,"pass_mark_mcq":70,"max_mcq_attempts":3}' where id='cccccccc-0000-0000-0000-0000000000c3';
insert into att select 4, start_quiz('eeeeeeee-0000-0000-0000-0000000000e4','final');
-- peta setiap soalan kepada pilihan A soalan LAIN (putaran) + id sampah
create temp table sw as select question_ids qs from quiz_attempts where id=(select id from att where n=4);
select pg_temp.eq('pilihan silang soalan = 0%', (submit_quiz((select id from att where n=4),'eeeeeeee-0000-0000-0000-0000000000e4',
  (select jsonb_object_agg(qs[i], (select o.id from quiz_options o where o.question_id = qs[case when i = 4 then 1 else i + 1 end] and o.label='A'))
   from sw, generate_series(1,4) i))->>'score_pct'), '0.00');
insert into att select 5, start_quiz('eeeeeeee-0000-0000-0000-0000000000e4','final');
select pg_temp.eq('id sampah / soalan luar percubaan = 0%', (submit_quiz((select id from att where n=5),'eeeeeeee-0000-0000-0000-0000000000e4', '{"x":"y","00000000-0000-0000-0000-000000000000":"00000000-0000-0000-0000-000000000001"}')->>'score_pct'), '0.00');
select pg_temp.fails('jawapan bukan objek ditolak', $q$select submit_quiz(start_quiz('eeeeeeee-0000-0000-0000-0000000000e4','final'),'eeeeeeee-0000-0000-0000-0000000000e4','[]')$q$, 'bad_answers');
-- had percubaan (3)
select submit_quiz((select id from att where n=(select 5)),'eeeeeeee-0000-0000-0000-0000000000e4','{}') where false;
select submit_quiz(start_quiz('eeeeeeee-0000-0000-0000-0000000000e4','final'),'eeeeeeee-0000-0000-0000-0000000000e4','{}') ;
select pg_temp.eq('3 percubaan telah dihantar', (select count(*)::text from quiz_attempts where enrollment_id='eeeeeeee-0000-0000-0000-0000000000e4' and type='final' and submitted_at is not null), '3');
select pg_temp.fails('percubaan ke-4 ditolak (had config)', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e4','final')$q$, 'attempts_exhausted');

-- 6. bank kecil / agihan apabila satu bab kekurangan soalan
insert into lesson_progress (enrollment_id, lesson_id, completed_at, watched_seconds_unique) values ('eeeeeeee-0000-0000-0000-0000000000e3','11111111-0000-0000-0000-0000000000f3', now(), 100);
insert into att select 6, start_quiz('eeeeeeee-0000-0000-0000-0000000000e3','final');
select pg_temp.eq('bab dengan 1 soalan beri baki: S1 = 1', pg_temp.perchap((select id from att where n=6),'bbbbbbbb-0000-0000-0000-0000000000b4'), '1');
select pg_temp.eq('baki dibahagi: S2 + S3 = 8', (pg_temp.perchap((select id from att where n=6),'bbbbbbbb-0000-0000-0000-0000000000b5')::int + pg_temp.perchap((select id from att where n=6),'bbbbbbbb-0000-0000-0000-0000000000b6')::int)::text, '8');
update courses set config = jsonb_set(config, '{mcq_count}', '100') where id='cccccccc-0000-0000-0000-0000000000c2';
update quiz_attempts set submitted_at = now(), passed = false where id=(select id from att where n=6);
select pg_temp.fails('bank lebih kecil dari mcq_count ditolak', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e3','final')$q$, 'bank_too_small');
update courses set config = config - 'pass_mark_mcq' where id='cccccccc-0000-0000-0000-0000000000c2';
select pg_temp.fails('config pass_mark_mcq tiada = ralat', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e3','final')$q$, 'config_mcq_tiada');

-- 7. kuiz latihan: tak menghalang, jawapan didedahkan hanya selepas hantar
insert into att select 7, start_quiz('eeeeeeee-0000-0000-0000-0000000000e2','practice','bbbbbbbb-0000-0000-0000-0000000000b1');
select pg_temp.eq('latihan bab 1 = 3 soalan', (select cardinality(question_ids)::text from quiz_attempts where id=(select id from att where n=7)), '3');
select pg_temp.eq('latihan sebelum hantar: tiada kunci / penjelasan', (select (get_attempt((select id from att where n=7),'eeeeeeee-0000-0000-0000-0000000000e2')::text like '%correct_option_id%' or get_attempt((select id from att where n=7),'eeeeeeee-0000-0000-0000-0000000000e2')::text like '%Sebab%')::text), 'false');
select pg_temp.eq('latihan: markah dikira', (submit_quiz((select id from att where n=7),'eeeeeeee-0000-0000-0000-0000000000e2', pg_temp.answers((select id from att where n=7), 2))->>'score_pct'), '66.67');
select pg_temp.eq('latihan selepas hantar: ada correct_option_id dan penjelasan', (select (j::text like '%correct_option_id%' and j::text like '%Sebab%')::text from (select get_attempt((select id from att where n=7),'eeeeeeee-0000-0000-0000-0000000000e2') j) x), 'true');
select pg_temp.eq('latihan tak ubah stage', (select stage from enrollments where id='eeeeeeee-0000-0000-0000-0000000000e2'), 'enrolled');
insert into att select 8, start_quiz('eeeeeeee-0000-0000-0000-0000000000e2','practice','bbbbbbbb-0000-0000-0000-0000000000b1');
select pg_temp.eq('latihan boleh diulang tanpa had (percubaan ke-2)', (select attempt_no::text from quiz_attempts where id = (select id from att where n=8)), '2');
select pg_temp.fails('bab tanpa soalan latihan', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e2','practice','bbbbbbbb-0000-0000-0000-0000000000b2')$q$, 'no_questions');
select pg_temp.fails('latihan tanpa bab ditolak', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e2','practice')$q$, 'chapter_required');

-- 8. akses tamat tutup kuiz
update enrollments set access_ends_at = now() - interval '1 day' where id='eeeeeeee-0000-0000-0000-0000000000e2';
select pg_temp.fails('akses tamat: latihan ditolak', $q$select start_quiz('eeeeeeee-0000-0000-0000-0000000000e2','practice','bbbbbbbb-0000-0000-0000-0000000000b1')$q$, 'access_closed');

-- 9. klien tak boleh panggil fungsi atau baca kunci
set local role authenticated;
select pg_temp.fails('authenticated tak boleh start_quiz', $q$select start_quiz(gen_random_uuid(),'final')$q$, 'permission denied for function start_quiz');
select pg_temp.fails('authenticated tak boleh get_attempt', $q$select get_attempt(gen_random_uuid(),gen_random_uuid())$q$, 'permission denied for function get_attempt');
select pg_temp.fails('authenticated tak boleh baca quiz_options', $q$select * from public.quiz_options$q$, 'permission denied for table quiz_options');
select pg_temp.fails('authenticated tak boleh baca quiz_questions', $q$select * from public.quiz_questions$q$, 'permission denied for table quiz_questions');
rollback;
