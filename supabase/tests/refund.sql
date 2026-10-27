-- Ujian refund (slice 11). ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/refund.sql
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

insert into staff_invites values ('rf-adm@t.local','admin'),('rf-rev@t.local','reviewer');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', 'rf-' || n || '@t.local', '{"privacy_accepted":true,"full_name":"Pelajar Refund"}'
from generate_series(1, 14) n;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rf-adm@t.local','{}'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rf-rev@t.local','{}');
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','rf','Kursus Refund',14900,'{"refund_window_days":3,"refund_progress_max_pct":10,"access_months":6,"video_complete_pct":0.9}'),
  ('cccccccc-0000-0000-0000-0000000000c2','rf-nocfg','Tanpa config',14900,'{}'),
  ('cccccccc-0000-0000-0000-0000000000c3','rf-pdf','Had PDF',14900,'{"refund_window_days":3,"refund_progress_max_pct":10,"refund_pdf_downloads_max":2}');
insert into chapters (id, course_id, position, title) values ('bbbbbbbb-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1',1,'B1'),('bbbbbbbb-0000-0000-0000-0000000000b3','cccccccc-0000-0000-0000-0000000000c3',1,'B3');
insert into lessons (id, course_id, chapter_id, position, title, video_ref, duration_seconds) values
  ('11111111-0000-0000-0000-0000000000f1','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',1,'L1','v1',1000),
  ('11111111-0000-0000-0000-0000000000f2','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',2,'L2','v2',1000);
insert into materials (id, course_id, chapter_id, title, r2_key) values ('99999999-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-0000000000c3','bbbbbbbb-0000-0000-0000-0000000000b3','M','k');

-- pembantu: order berbayar + enrollment, paid_at dikawal
create function pg_temp.mk(n int, course uuid, paid timestamptz) returns void language plpgsql as $$
declare uid uuid := ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid; oid uuid := gen_random_uuid(); eid uuid := ('eeeeeeee-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid;
begin
  if paid is not null then insert into orders (id, user_id, course_id, order_number, amount, status, paid_at, terms_accepted_at) values (oid, uid, course, 'RF-' || n, 14900, 'paid', paid, paid); end if;
  insert into enrollments (id, user_id, course_id, order_id, access_ends_at) values (eid, uid, course, case when paid is not null then oid end, now() + interval '90 days');
end $$;
create function pg_temp.e(n int) returns uuid language sql as $$ select ('eeeeeeee-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
select pg_temp.mk(1,  'cccccccc-0000-0000-0000-0000000000c1', now());
select pg_temp.mk(2,  'cccccccc-0000-0000-0000-0000000000c1', now());
select pg_temp.mk(3,  'cccccccc-0000-0000-0000-0000000000c1', now());
select pg_temp.mk(4,  'cccccccc-0000-0000-0000-0000000000c1', now());
select pg_temp.mk(5,  'cccccccc-0000-0000-0000-0000000000c1', now());
select pg_temp.mk(6,  'cccccccc-0000-0000-0000-0000000000c1', now() - interval '3 days' + interval '1 minute');
select pg_temp.mk(7,  'cccccccc-0000-0000-0000-0000000000c1', now() - interval '3 days' - interval '1 minute');
select pg_temp.mk(8,  'cccccccc-0000-0000-0000-0000000000c1', null);
select pg_temp.mk(9,  'cccccccc-0000-0000-0000-0000000000c3', now());
select pg_temp.mk(10, 'cccccccc-0000-0000-0000-0000000000c3', now());
select pg_temp.mk(11, 'cccccccc-0000-0000-0000-0000000000c2', now());
select pg_temp.mk(12, 'cccccccc-0000-0000-0000-0000000000c1', now());
\set adm '''aaaaaaaa-0000-0000-0000-0000000000f1'''
\set rev '''aaaaaaaa-0000-0000-0000-0000000000f2'''
create temp table rq (k text primary key, id uuid);

-- 1. semakan automatik: sempadan
insert into lesson_progress (enrollment_id, lesson_id, watched_seconds_unique) values (pg_temp.e(2), '11111111-0000-0000-0000-0000000000f1', 200), (pg_temp.e(3), '11111111-0000-0000-0000-0000000000f1', 199);
select pg_temp.eq('progres 10.00% (= had X) gagal', (refund_eligibility(pg_temp.e(2))->>'progress_ok'), 'false');
select pg_temp.eq('progres 9.95% (< X) lulus', (refund_eligibility(pg_temp.e(3))->>'progress_ok'), 'true');
select pg_temp.eq('progres dikira betul 200/2000', (refund_eligibility(pg_temp.e(2))->>'progress_pct'), '10.00');
insert into submissions (course_id, enrollment_id, type, text_answer, source, status) values ('cccccccc-0000-0000-0000-0000000000c1', pg_temp.e(4), 'subjective', 'x', 'lms', 'pending');
select pg_temp.eq('ada penghantaran: gagal', (refund_eligibility(pg_temp.e(4))->>'no_submissions'), 'false');
insert into submissions (course_id, enrollment_id, type, source, status, received_at, reviewer_id) values ('cccccccc-0000-0000-0000-0000000000c1', pg_temp.e(12), 'video', 'manual_fasi', 'approved', current_date, :adm);
select pg_temp.eq('penghantaran manual juga dikira: gagal', (refund_eligibility(pg_temp.e(12))->>'no_submissions'), 'false');
insert into quiz_attempts (enrollment_id, type, attempt_no, question_ids) values (pg_temp.e(5), 'final', 1, '{}');
select pg_temp.eq('ada percubaan MCQ akhir: gagal', (refund_eligibility(pg_temp.e(5))->>'no_final_attempt'), 'false');
select pg_temp.eq('bersih: layak', (refund_eligibility(pg_temp.e(1))->>'eligible'), 'true');
select pg_temp.eq('tetingkap: 3 hari kurang seminit masih dalam', (refund_eligibility(pg_temp.e(6))->>'window_ok'), 'true');
select pg_temp.eq('tetingkap: 3 hari lebih seminit tamat', (refund_eligibility(pg_temp.e(7))->>'window_ok'), 'false');
select pg_temp.fails('tanpa order berbayar (grant manual)', format($q$select refund_eligibility(%L)$q$, pg_temp.e(8)), 'no_paid_order');
select pg_temp.fails('config refund tiada = ralat (tiada hardcode)', format($q$select refund_eligibility(%L)$q$, pg_temp.e(11)), 'config_refund_tiada');
insert into material_access_log (enrollment_id, material_id) select pg_temp.e(9), '99999999-0000-0000-0000-000000000001' from generate_series(1,3);
insert into material_access_log (enrollment_id, material_id) select pg_temp.e(10), '99999999-0000-0000-0000-000000000001' from generate_series(1,2);
select pg_temp.eq('PDF 3 > had 2: gagal', (refund_eligibility(pg_temp.e(9))->>'pdf_ok'), 'false');
select pg_temp.eq('PDF 2 = had 2: lulus', (refund_eligibility(pg_temp.e(10))->>'pdf_ok'), 'true');
select pg_temp.eq('tanpa had PDF dalam config: tidak dikuatkuasakan', (refund_eligibility(pg_temp.e(1))->>'pdf_ok'), 'true');

-- 2. permohonan
select pg_temp.fails('luar tetingkap: tiada rekod dicipta', format($q$select request_refund(%L,'x')$q$, pg_temp.e(7)), 'window_closed');
select pg_temp.eq('luar tetingkap: tiada baris refund_requests', (select count(*)::text from refund_requests where enrollment_id = pg_temp.e(7)), '0');
insert into rq select 'r1', (request_refund(pg_temp.e(1), '  Tidak sesuai  ')->>'id')::uuid;
select pg_temp.eq('layak: surat dikeluarkan (letter_issued), sebab trim', (select status||'|'||reason from refund_requests where id=(select id from rq where k='r1')), 'letter_issued|Tidak sesuai');
select pg_temp.eq('snapshot semakan automatik disimpan', (select (auto_check_snapshot->>'eligible')::text from refund_requests where id=(select id from rq where k='r1')), 'true');
select pg_temp.fails('permohonan kedua semasa aktif ditolak', format($q$select request_refund(%L,null)$q$, pg_temp.e(1)), 'already_requested');
insert into rq select 'r2', (request_refund(pg_temp.e(2), null)->>'id')::uuid;
select pg_temp.eq('gagal semakan: auto_failed (tiada surat)', (select status from refund_requests where id=(select id from rq where k='r2')), 'auto_failed');
select pg_temp.fails('auto_failed tak boleh muat naik surat', format($q$select attach_signed_letter(%L,%L,%L)$q$, (select id from rq where k='r2'), pg_temp.e(2), 'refunds/' || pg_temp.e(2) || '/s.jpg'), 'bad_status');
select pg_temp.fails('auto_failed tak boleh diluluskan', format($q$select decide_refund(%L,%L,'approved','ok')$q$, :adm, (select id from rq where k='r2')), 'bad_status');
select pg_temp.fails('auto_failed: tutup tanpa nota ditolak', format($q$select decide_refund(%L,%L,'rejected',' ')$q$, :adm, (select id from rq where k='r2')), 'note_required');

-- 3. override admin
insert into rq select 'r12', (request_refund(pg_temp.e(12), null)->>'id')::uuid;
select pg_temp.eq('auto_failed boleh ditutup (ditolak) dengan nota', decide_refund(:adm, (select id from rq where k='r12'), 'rejected', 'Pelajar sudah hantar video'), 'rejected');
select pg_temp.eq('selepas ditutup: permohonan baharu dibenarkan', (request_refund(pg_temp.e(12), null)->>'status'), 'auto_failed');
select pg_temp.fails('override: bukan admin', format($q$select admin_override_refund(%L,%L,'nota')$q$, :rev, (select id from rq where k='r2')), 'actor_not_admin');
select pg_temp.fails('override: tanpa nota', format($q$select admin_override_refund(%L,%L,' ')$q$, :adm, (select id from rq where k='r2')), 'note_required');
select admin_override_refund(:adm, (select id from rq where k='r2'), 'Pelajar hanya tonton 1 video, kebenaran Saiful');
select pg_temp.eq('override: jadi letter_issued + nota direkod', (select status||'|'||override_note from refund_requests where id=(select id from rq where k='r2')), 'letter_issued|Pelajar hanya tonton 1 video, kebenaran Saiful');
select pg_temp.eq('override: admin_actions bawa snapshot', (select (detail->'snapshot'->>'progress_ok') from admin_actions where action='refund_override' and enrollment_id=pg_temp.e(2)), 'false');
select pg_temp.fails('override pada permohonan layak ditolak', format($q$select admin_override_refund(%L,%L,'x')$q$, :adm, (select id from rq where k='r1')), 'bad_status');

-- 4. surat bertandatangan, keputusan, refund sebenar
select pg_temp.fails('kunci fail enrollment lain', format($q$select attach_signed_letter(%L,%L,'refunds/11111111-1111-1111-1111-111111111111/s.jpg')$q$, (select id from rq where k='r1'), pg_temp.e(1)), 'bad_file_key');
select pg_temp.fails('pelajar lain tak boleh muat naik untuk permohonan ini', format($q$select attach_signed_letter(%L,%L,%L)$q$, (select id from rq where k='r1'), pg_temp.e(3), 'refunds/' || pg_temp.e(3) || '/s.jpg'), 'not_found');
select pg_temp.fails('keputusan sebelum surat dimuat naik', format($q$select decide_refund(%L,%L,'approved','ok')$q$, :adm, (select id from rq where k='r1')), 'bad_status');
select attach_signed_letter((select id from rq where k='r1'), pg_temp.e(1), 'refunds/' || pg_temp.e(1) || '/surat.jpg');
select pg_temp.eq('surat dimuat naik: letter_uploaded', (select status from refund_requests where id=(select id from rq where k='r1')), 'letter_uploaded');
select pg_temp.fails('muat naik dua kali ditolak', format($q$select attach_signed_letter(%L,%L,%L)$q$, (select id from rq where k='r1'), pg_temp.e(1), 'refunds/' || pg_temp.e(1) || '/lagi.jpg'), 'bad_status');
select pg_temp.fails('keputusan: bukan admin', format($q$select decide_refund(%L,%L,'approved','ok')$q$, :rev, (select id from rq where k='r1')), 'actor_not_admin');
select pg_temp.fails('mark_refunded sebelum diluluskan', format($q$select mark_refunded(%L,%L,'BC-1')$q$, :adm, (select id from rq where k='r1')), 'bad_status');
-- sijil + kebenaran bekalan wujud sebelum refund
insert into certificates (course_id, enrollment_id, type, cert_id, holder_name, course_title, period_start, period_end)
values ('cccccccc-0000-0000-0000-0000000000c1', pg_temp.e(1), 'theory', 'AHZ-9999-00001', 'Pelajar Refund', 'Kursus Refund', current_date, current_date);
select pg_temp.eq('luluskan', decide_refund(:adm, (select id from rq where k='r1'), 'approved', null), 'approved');
select pg_temp.eq('akses MASIH terbuka selepas diluluskan (belum dipulangkan)', (select (refunded_at is null)::text from enrollments where id=pg_temp.e(1)), 'true');
select pg_temp.fails('mark_refunded tanpa rujukan Bayarcash', format($q$select mark_refunded(%L,%L,' ')$q$, :adm, (select id from rq where k='r1')), 'note_required');
select pg_temp.eq('mark_refunded: 1 sijil dibatalkan', (mark_refunded(:adm, (select id from rq where k='r1'), 'Bayarcash refund ref BC-123')->>'revoked_certificates'), '1');
select pg_temp.eq('akses ditutup (refunded_at)', (select (refunded_at is not null)::text from enrollments where id=pg_temp.e(1)), 'true');
select pg_temp.eq('order jadi refunded', (select o.status from orders o join enrollments e on e.order_id=o.id where e.id=pg_temp.e(1)), 'refunded');
select pg_temp.eq('sijil dibatalkan', (select (revoked_at is not null)::text from certificates where cert_id='AHZ-9999-00001'), 'true');
select pg_temp.eq('status permohonan refunded + rujukan', (select status||'|'||refund_note from refund_requests where id=(select id from rq where k='r1')), 'refunded|Bayarcash refund ref BC-123');
select pg_temp.eq('admin_actions: keputusan + pelaksanaan + batal', (select count(*)::text from admin_actions where action='refund' and enrollment_id=pg_temp.e(1)), '2');
select pg_temp.fails('selepas refund: heartbeat video ditolak', format($q$select record_heartbeat(%L,'11111111-0000-0000-0000-0000000000f1',5)$q$, pg_temp.e(1)), 'access_closed');
select pg_temp.fails('selepas refund: kuiz ditolak', format($q$select start_quiz(%L,'practice','bbbbbbbb-0000-0000-0000-0000000000b1')$q$, pg_temp.e(1)), 'access_closed');
select pg_temp.fails('selepas refund: bahagian 2 ditolak', format($q$select submit_part2(%L,'subjective','x',null)$q$, pg_temp.e(1)), 'access_closed');
select pg_temp.fails('selepas refund: sijil baharu ditolak', format($q$select issue_certificate(%L,'theory','Pelajar Refund')$q$, pg_temp.e(1)), 'refunded');
select pg_temp.fails('selepas refund: tak boleh mohon lagi', format($q$select request_refund(%L,null)$q$, pg_temp.e(1)), 'refunded');
select pg_temp.eq('callback Bayarcash tidak membuka semula order refunded', apply_payment_event('TX-RF-1', 3, 'RF-1', 14900, 'MYR', '{}'), 'ignored_refunded');

-- 5. tolak
insert into rq select 'r4', (request_refund(pg_temp.e(4), null)->>'id')::uuid;
select admin_override_refund(:adm, (select id from rq where k='r4'), 'Boleh dipertimbang');
select attach_signed_letter((select id from rq where k='r4'), pg_temp.e(4), 'refunds/' || pg_temp.e(4) || '/surat.jpg');
select pg_temp.fails('tolak tanpa nota', format($q$select decide_refund(%L,%L,'rejected',' ')$q$, :adm, (select id from rq where k='r4')), 'note_required');
select pg_temp.eq('tolak dengan nota', decide_refund(:adm, (select id from rq where k='r4'), 'rejected', 'Melebihi had penggunaan'), 'rejected');
select pg_temp.eq('selepas ditolak akses kekal', (select (refunded_at is null)::text from enrollments where id=pg_temp.e(4)), 'true');
select pg_temp.eq('selepas ditolak: boleh mohon semula (rekod baharu)', (request_refund(pg_temp.e(4), null)->>'status'), 'auto_failed');

-- 6. klien tak boleh panggil, tetapi baca permohonan sendiri sahaja
set local role authenticated;
select pg_temp.fails('authenticated tak boleh request_refund', $q$select request_refund(gen_random_uuid(),'x')$q$, 'permission denied for function request_refund');
select pg_temp.fails('authenticated tak boleh mark_refunded', $q$select mark_refunded(gen_random_uuid(),gen_random_uuid(),'x')$q$, 'permission denied for function mark_refunded');
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-0000-0000-0000-000000000002','role','authenticated')::text, true);
select pg_temp.eq('pelajar baca permohonan sendiri sahaja (RLS)', (select count(*)::text from public.refund_requests), '1');
rollback;
