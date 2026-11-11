-- Ujian bahagian 2 (subjektif + skematik), tuntut tugasan, laluan manual, tambah percubaan MCQ. ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/part2.sql
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

-- staf melalui jemputan; pelajar melalui borang (privasi)
insert into staff_invites values ('p2-r1@t.local','reviewer'),('p2-r2@t.local','reviewer'),('p2-adm@t.local','admin');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('aaaaaaaa-0000-0000-0000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', e, '{"privacy_accepted":true,"full_name":"Ujian Pelajar","phone":"0123456789"}'
from (values ('a1','p2-s1@t.local'),('a2','p2-s2@t.local'),('b1','p2-r1@t.local'),('b2','p2-r2@t.local'),('b3','p2-adm@t.local'),('a3','p2-s3@t.local')) v(n,e);
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','p2','P2',14900,'{"claim_expiry_days":3,"access_months":6,"mcq_count":2,"pass_mark_mcq":70,"max_mcq_attempts":1,"video_complete_pct":0.9}');
insert into enrollments (id, user_id, course_id, stage, access_ends_at) values
  ('eeeeeeee-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000c1','enrolled', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e2','aaaaaaaa-0000-0000-0000-0000000000a2','cccccccc-0000-0000-0000-0000000000c1','part2_review', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e3','aaaaaaaa-0000-0000-0000-0000000000a3','cccccccc-0000-0000-0000-0000000000c1','part2_review', now()+interval '90 days');
\set e1 '''eeeeeeee-0000-0000-0000-0000000000e1'''
\set e2 '''eeeeeeee-0000-0000-0000-0000000000e2'''
\set e3 '''eeeeeeee-0000-0000-0000-0000000000e3'''
\set r1 '''aaaaaaaa-0000-0000-0000-0000000000b1'''
\set r2 '''aaaaaaaa-0000-0000-0000-0000000000b2'''
\set adm '''aaaaaaaa-0000-0000-0000-0000000000b3'''
\set stu '''aaaaaaaa-0000-0000-0000-0000000000a1'''

-- 1. bahagian 2 tertutup sebelum MCQ lulus
select pg_temp.fails('bahagian 2 tertutup sebelum MCQ lulus', format($q$select submit_part2(%L,'subjective','jawapan',null)$q$, :e1), 'part2_closed');

-- 2. hantar
create temp table s (k text primary key, id uuid);
insert into s select 'subj1', submit_part2(:e2, 'subjective', '  Jawapan subjektif  ', null);
select pg_temp.eq('subjektif disimpan (trim) dan pending', (select status||'|'||text_answer||'|'||attempt_no from submissions where id=(select id from s where k='subj1')), 'pending|Jawapan subjektif|1');
select pg_temp.fails('hantar semula semasa pending ditolak', format($q$select submit_part2(%L,'subjective','lagi',null)$q$, :e2), 'not_resubmittable');
select pg_temp.fails('teks kosong ditolak', format($q$select submit_part2(%L,'subjective','   ',null)$q$, :e3), 'bad_text');
select pg_temp.fails('kunci fail enrollment lain ditolak', format($q$select submit_part2(%L,'schematic',null,'submissions/%s/x.jpg')$q$, :e2, '11111111-1111-1111-1111-111111111111'), 'bad_file_key');
select pg_temp.fails('kunci fail tiada ditolak', format($q$select submit_part2(%L,'schematic',null,null)$q$, :e2), 'bad_file_key');
insert into s select 'sch1', submit_part2(:e2, 'schematic', null, 'submissions/eeeeeeee-0000-0000-0000-0000000000e2/schematic-1.jpg');
select pg_temp.fails('jenis lain ditolak', format($q$select submit_part2(%L,'video','x',null)$q$, :e2), 'bad_type');

-- 3. tuntut tugasan
select pg_temp.eq('R1 tuntut 2 item', claim_review(:e2, :r1)::text, '2');
select pg_temp.fails('R2 tak boleh tuntut item yang dipegang R1', format($q$select claim_review(%L,%L)$q$, :e2, :r2), 'claimed_by_other');
select pg_temp.eq('R1 tuntut semula (idempotent)', claim_review(:e2, :r1)::text, '2');
select pg_temp.fails('pelajar bukan penilai', format($q$select claim_review(%L,%L)$q$, :e2, :stu), 'not_reviewer');
select pg_temp.fails('R2 tak boleh semak item yang dituntut R1', format($q$select review_submission(%L,%L,'approved','')$q$, (select id from s where k='subj1'), :r2), 'not_claimed_by_you');
update submissions set claimed_at = now() - interval '4 days' where enrollment_id = :e2;   -- tuntutan R1 luput (3 hari)
select pg_temp.eq('selepas luput, R2 boleh tuntut', claim_review(:e2, :r2)::text, '2');
select pg_temp.fails('tuntutan luput R1 tak boleh semak', format($q$select review_submission(%L,%L,'approved','')$q$, (select id from s where k='subj1'), :r1), 'not_claimed_by_you');
select pg_temp.fails('tiada apa menunggu pada enrollment lain', format($q$select claim_review(%L,%L)$q$, :e3, :r1), 'nothing_pending');

-- 4. semakan: tolak wajib komen, hantar semula = attempt_no baharu, lulus kedua-dua = theory_passed
select pg_temp.fails('tolak tanpa komen ditolak', format($q$select review_submission(%L,%L,'rejected','  ')$q$, (select id from s where k='subj1'), :r2), 'comment_required');
select pg_temp.fails('keputusan tak sah', format($q$select review_submission(%L,%L,'maybe','x')$q$, (select id from s where k='subj1'), :r2), 'bad_decision');
select pg_temp.eq('R2 tolak subjektif dengan komen', (review_submission((select id from s where k='subj1'), :r2, 'rejected', 'Kurang jelas'))->>'status', 'rejected');
select pg_temp.eq('penilai direkod', (select reviewer_id::text from submissions where id=(select id from s where k='subj1')), 'aaaaaaaa-0000-0000-0000-0000000000b2');
select pg_temp.fails('semak dua kali ditolak', format($q$select review_submission(%L,%L,'approved','')$q$, (select id from s where k='subj1'), :r2), 'already_reviewed');
select pg_temp.eq('R2 lulus skematik', (review_submission((select id from s where k='sch1'), :r2, 'approved', null))->>'theory_passed', 'false');
select pg_temp.eq('satu lulus sahaja: stage kekal part2_review', (select stage from enrollments where id=:e2), 'part2_review');
select pg_temp.fails('skematik lulus tak boleh dihantar semula', format($q$select submit_part2(%L,'schematic',null,'submissions/eeeeeeee-0000-0000-0000-0000000000e2/x.jpg')$q$, :e2), 'not_resubmittable');
insert into s select 'subj2', submit_part2(:e2, 'subjective', 'Jawapan diperbaiki', null);
select pg_temp.eq('hantar semula selepas ditolak: attempt_no 2', (select attempt_no::text from submissions where id=(select id from s where k='subj2')), '2');
select pg_temp.eq('rekod lama kekal (ditolak, attempt 1)', (select status from submissions where id=(select id from s where k='subj1')), 'rejected');
select claim_review(:e2, :r1);
select pg_temp.eq('lulus kedua-dua = theory_passed', (review_submission((select id from s where k='subj2'), :r1, 'approved', 'Baik'))->>'theory_passed', 'true');
select pg_temp.eq('stage = theory_passed', (select stage from enrollments where id=:e2), 'theory_passed');
select pg_temp.fails('selepas lulus bahagian 2 tertutup', format($q$select submit_part2(%L,'subjective','x',null)$q$, :e2), 'part2_closed');

-- 5. laluan manual
select pg_temp.fails('manual: bukan admin', format($q$select record_manual_submission(%L,%L,'subjective',current_date,%L,'approved','ok','teks',null,'sesi bantuan')$q$, :r1, :e3, :r1), 'actor_not_admin');
select pg_temp.fails('manual: tanpa sebab', format($q$select record_manual_submission(%L,%L,'subjective',current_date,%L,'approved','ok','teks',null,' ')$q$, :adm, :e3, :r1), 'reason_required');
select pg_temp.fails('manual: tanpa tarikh terima', format($q$select record_manual_submission(%L,%L,'subjective',null,%L,'approved','ok','teks',null,'sesi')$q$, :adm, :e3, :r1), 'received_at_required');
select pg_temp.fails('manual: tarikh masa depan', format($q$select record_manual_submission(%L,%L,'subjective',current_date+1,%L,'approved','ok','teks',null,'sesi')$q$, :adm, :e3, :r1), 'received_at_future');
select pg_temp.fails('manual: tanpa penilai', format($q$select record_manual_submission(%L,%L,'subjective',current_date,null,'approved','ok','teks',null,'sesi')$q$, :adm, :e3), 'reviewer_required');
select pg_temp.fails('manual: penilai bukan staf', format($q$select record_manual_submission(%L,%L,'subjective',current_date,%L,'approved','ok','teks',null,'sesi')$q$, :adm, :e3, :stu), 'reviewer_required');
select pg_temp.fails('manual: tanpa keputusan sah', format($q$select record_manual_submission(%L,%L,'subjective',current_date,%L,null,'ok','teks',null,'sesi')$q$, :adm, :e3, :r1), 'bad_decision');
insert into s select 'm1', record_manual_submission(:adm, :e3, 'subjective', current_date - 1, :r1, 'approved', 'Disemak semasa sesi', 'jawapan di kertas', null, 'Pelajar hantar di sesi bantuan');
select pg_temp.eq('manual: source/ tarikh / penilai / storan luar', (select source||'|'||(received_at = current_date - 1)::text||'|'||(reviewer_id is not null)::text||'|'||storage||'|'||status from submissions where id=(select id from s where k='m1')), 'manual_fasi|true|true|external|approved');
select pg_temp.eq('manual: ada baris admin_actions', (select count(*)::text from admin_actions where action='manual_submission' and detail->>'submission_id' = (select id::text from s where k='m1') and detail->>'file_outside_system'='true'), '1');
select pg_temp.eq('manual: satu lulus, stage kekal', (select stage from enrollments where id=:e3), 'part2_review');
insert into s select 'm2', record_manual_submission(:adm, :e3, 'schematic', current_date, :r1, 'approved', null, null, 'submissions/eeeeeeee-0000-0000-0000-0000000000e3/m.jpg', 'Skematik dihantar di sesi');
select pg_temp.eq('manual: kedua-dua lulus = theory_passed', (select stage from enrollments where id=:e3), 'theory_passed');
-- kekangan DB: rekod manual_fasi tanpa tarikh/penilai tidak boleh wujud walau terus INSERT
select pg_temp.fails('DB tolak manual_fasi tanpa received_at/penilai', format($q$insert into submissions (course_id, enrollment_id, type, source, status) values ('cccccccc-0000-0000-0000-0000000000c1',%L,'subjective','manual_fasi','approved')$q$, :e1), 'new row for relation "submissions" violates check constraint "submissions_check"');

-- 6. tambah percubaan MCQ oleh admin
insert into chapters (id, course_id, position, title) values ('bbbbbbbb-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1',1,'B1');
insert into quiz_questions (id, course_id, chapter_id, type, body) values
  ('99999999-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1','final','S1'),
  ('99999999-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1','final','S2');
insert into quiz_options (question_id, label, body, is_correct) select q, l, l, l='A' from unnest(array['99999999-0000-0000-0000-000000000001'::uuid,'99999999-0000-0000-0000-000000000002'::uuid]) q, unnest(array['A','B']) l;
insert into lessons (id, course_id, chapter_id, position, title, video_ref, duration_seconds) values ('11111111-0000-0000-0000-0000000000f1','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',1,'L','v',100);
insert into lesson_progress (enrollment_id, lesson_id, completed_at, watched_seconds_unique) values (:e1,'11111111-0000-0000-0000-0000000000f1', now(), 100);
create temp table qa as select start_quiz(:e1, 'final') id;
select submit_quiz((select id from qa), :e1, '{}');
select pg_temp.fails('had percubaan habis (1)', format($q$select start_quiz(%L,'final')$q$, :e1), 'attempts_exhausted');
select pg_temp.fails('tambah: tanpa sebab', format($q$select grant_extra_attempts(%L,%L,1,'')$q$, :adm, :e1), 'reason_required');
select pg_temp.fails('tambah: bukan admin', format($q$select grant_extra_attempts(%L,%L,1,'x')$q$, :r1, :e1), 'actor_not_admin');
select pg_temp.fails('tambah: bilangan tak sah', format($q$select grant_extra_attempts(%L,%L,0,'x')$q$, :adm, :e1), 'bad_count');
select pg_temp.eq('tambah 1 percubaan', grant_extra_attempts(:adm, :e1, 1, 'Pelajar sakit semasa percubaan')::text, '1');
select pg_temp.eq('admin_actions rekod tambah percubaan', (select count(*)::text from admin_actions where action='extra_attempts' and enrollment_id=:e1 and reason like 'Pelajar sakit%'), '1');
create temp table qb as select start_quiz(:e1, 'final') id;
select pg_temp.eq('percubaan baharu dibenarkan selepas ditambah', (select attempt_no::text from quiz_attempts where id=(select id from qb)), '2');
select submit_quiz((select id from qb), :e1, '{}');
select pg_temp.fails('habis semula selepas digunakan', format($q$select start_quiz(%L,'final')$q$, :e1), 'attempts_exhausted');

-- 7. klien tak boleh panggil
set local role authenticated;
select pg_temp.fails('authenticated tak boleh submit_part2', $q$select submit_part2(gen_random_uuid(),'subjective','x',null)$q$, 'permission denied for function submit_part2');
select pg_temp.fails('authenticated tak boleh review_submission', $q$select review_submission(gen_random_uuid(),gen_random_uuid(),'approved','x')$q$, 'permission denied for function review_submission');
select pg_temp.fails('authenticated tak boleh record_manual_submission', $q$select record_manual_submission(gen_random_uuid(),gen_random_uuid(),'subjective',current_date,gen_random_uuid(),'approved',null,null,null,'x')$q$, 'permission denied for function record_manual_submission');
select pg_temp.fails('authenticated tak boleh grant_extra_attempts', $q$select grant_extra_attempts(gen_random_uuid(),gen_random_uuid(),1,'x')$q$, 'permission denied for function grant_extra_attempts');
rollback;
