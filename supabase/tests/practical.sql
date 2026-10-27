-- Ujian trek praktikal + KEBENARAN BEKALAN (slice 9). ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/practical.sql
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

insert into staff_invites values ('p9-rev1@t.local','reviewer'),('p9-rev2@t.local','reviewer'),('p9-apr@t.local','approver'),('p9-adm@t.local','admin');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('aaaaaaaa-0000-0000-0000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', e, '{"privacy_accepted":true,"full_name":"Pelajar Uji"}'
from (values ('a1','p9-s1@t.local'),('a2','p9-s2@t.local'),('a3','p9-s3@t.local'),('b1','p9-rev1@t.local'),('b2','p9-rev2@t.local'),('b3','p9-apr@t.local'),('b4','p9-adm@t.local')) v(n,e);
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','p9','P9',14900,'{"claim_expiry_days":3,"energize_guidance_text":"PANDUAN KESELAMATAN AHZ (ujian)"}'),
  ('cccccccc-0000-0000-0000-0000000000c2','p9-nog','P9 tanpa panduan',14900,'{"claim_expiry_days":3}');
insert into enrollments (id, user_id, course_id, stage, access_ends_at) values
  ('eeeeeeee-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000c1','theory_passed', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e2','aaaaaaaa-0000-0000-0000-0000000000a2','cccccccc-0000-0000-0000-0000000000c1','theory_passed', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e3','aaaaaaaa-0000-0000-0000-0000000000a3','cccccccc-0000-0000-0000-0000000000c2','theory_passed', now()+interval '90 days');
\set e1 '''eeeeeeee-0000-0000-0000-0000000000e1'''
\set e2 '''eeeeeeee-0000-0000-0000-0000000000e2'''
\set e3 '''eeeeeeee-0000-0000-0000-0000000000e3'''
\set r1 '''aaaaaaaa-0000-0000-0000-0000000000b1'''
\set r2 '''aaaaaaaa-0000-0000-0000-0000000000b2'''
\set apr '''aaaaaaaa-0000-0000-0000-0000000000b3'''
\set adm '''aaaaaaaa-0000-0000-0000-0000000000b4'''
\set key1 '''submissions/eeeeeeee-0000-0000-0000-0000000000e1/form-1.jpg'''
create temp table s (k text primary key, id uuid);
-- pembantu: R1 tuntut dan semak SEMUA item menunggu
create function pg_temp.review_all(enr uuid, decision text) returns void language plpgsql as $$
declare x uuid;
begin
  perform claim_practical(enr, 'aaaaaaaa-0000-0000-0000-0000000000b1');
  for x in select id from submissions where enrollment_id = enr and status = 'pending' and type in ('form','video') loop
    perform review_practical_item(x, 'aaaaaaaa-0000-0000-0000-0000000000b1', decision, case when decision = 'rejected' then 'komen' else null end);
  end loop;
end $$;
create function pg_temp.approved(enr uuid) returns text language sql as $$ select (energize_approved_at is not null)::text from enrollments where id = enr $$;

-- 1. pilih trek praktikal
select pg_temp.fails('submit sebelum trek praktikal dipilih', format($q$select submit_practical(%L,'form',%L,null,null)$q$, :e1, :key1), 'practical_closed');
select pg_temp.eq('pilih trek praktikal', choose_track(:e1, 'theory_practical'), 'theory_practical');
select pg_temp.eq('stage jadi practical', (select stage from enrollments where id=:e1), 'practical');
select pg_temp.fails('trek tak boleh ditukar selepas dipilih', format($q$select choose_track(%L,'theory')$q$, :e1), 'not_eligible');

-- 2. borang dan deklarasi video
select pg_temp.fails('video tanpa persetujuan privasi Telegram', format($q$select submit_practical(%L,'video',null,'mesej 27/10 10:30',false)$q$, :e1), 'consent_required');
select pg_temp.fails('video tanpa persetujuan (null)', format($q$select submit_practical(%L,'video',null,'mesej 27/10 10:30',null)$q$, :e1), 'consent_required');
select pg_temp.fails('video tanpa borang dahulu', format($q$select submit_practical(%L,'video',null,'mesej 27/10 10:30',true)$q$, :e1), 'form_required');
select pg_temp.fails('borang kunci fail enrollment lain', format($q$select submit_practical(%L,'form','submissions/%s/x.jpg',null,null)$q$, :e1, '11111111-1111-1111-1111-111111111111'), 'bad_file_key');
insert into s select 'form1', submit_practical(:e1, 'form', 'submissions/eeeeeeee-0000-0000-0000-0000000000e1/form-1.jpg', null, null);
select pg_temp.fails('borang kedua semasa pending ditolak', format($q$select submit_practical(%L,'form',%L,null,null)$q$, :e1, :key1), 'not_resubmittable');
select pg_temp.fails('rujukan video terlalu pendek', format($q$select submit_practical(%L,'video',null,'a',true)$q$, :e1), 'bad_ref');
insert into s select 'vid1', submit_practical(:e1, 'video', null, '  Telegram group, mesej 27/10 10:30  ', true);
select pg_temp.eq('video: storan external, rujukan trim, deklarasi direkod', (select storage||'|'||external_ref||'|'||(declared_at is not null)::text||'|'||status from submissions where id=(select id from s where k='vid1')), 'external|Telegram group, mesej 27/10 10:30|true|pending');
select pg_temp.eq('persetujuan privasi Telegram direkod', (select (telegram_consent_at is not null)::text from enrollments where id=:e1), 'true');

-- 3. KEBENARAN BEKALAN tidak wujud secara automatik
select pg_temp.eq('selepas hantar: TIADA kebenaran bekalan', pg_temp.approved(:e1), 'false');
select pg_temp.fails('approve sebelum disemak (video belum disemak)', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e1, (select id from s where k='vid1')), 'video_not_reviewed');
select pg_temp.fails('reviewer tak boleh luluskan bekalan', format($q$select approve_energize(%L,%L,%L)$q$, :r1, :e1, (select id from s where k='vid1')), 'actor_not_approver');
select pg_temp.fails('admin tak boleh luluskan bekalan', format($q$select approve_energize(%L,%L,%L)$q$, :adm, :e1, (select id from s where k='vid1')), 'actor_not_approver');
select pg_temp.fails('pelajar tak boleh luluskan bekalan sendiri', format($q$select approve_energize('aaaaaaaa-0000-0000-0000-0000000000a1',%L,%L)$q$, :e1, (select id from s where k='vid1')), 'actor_not_approver');

-- 4. tuntut dan semak
select pg_temp.eq('R1 tuntut 2 item', claim_practical(:e1, :r1)::text, '2');
select pg_temp.fails('R2 tak boleh tuntut', format($q$select claim_practical(%L,%L)$q$, :e1, :r2), 'claimed_by_other');
select pg_temp.fails('R2 tak boleh semak item R1', format($q$select review_practical_item(%L,%L,'approved',null)$q$, (select id from s where k='form1'), :r2), 'not_claimed_by_you');
select pg_temp.fails('tolak tanpa komen', format($q$select review_practical_item(%L,%L,'rejected',' ')$q$, (select id from s where k='form1'), :r1), 'comment_required');
select review_practical_item((select id from s where k='form1'), :r1, 'approved', null);
select pg_temp.fails('approve: video belum disemak walaupun borang lulus', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e1, (select id from s where k='vid1')), 'video_not_reviewed');
select review_practical_item((select id from s where k='vid1'), :r1, 'approved', 'video OK');
select pg_temp.eq('semakan reviewer SAHAJA tidak memberi kebenaran bekalan', pg_temp.approved(:e1), 'false');

-- 5. teks panduan keselamatan wajib
select pg_temp.fails('kursus tanpa teks panduan AHZ: kelulusan ditolak', format($q$select approve_energize(%L,%L,gen_random_uuid())$q$, :apr, :e3), 'practical_closed');
update enrollments set cert_track='theory_practical', stage='practical' where id=:e3;
insert into s select 'f3', submit_practical(:e3, 'form', 'submissions/eeeeeeee-0000-0000-0000-0000000000e3/f.jpg', null, null);
insert into s select 'v3', submit_practical(:e3, 'video', null, 'mesej Telegram', true);
select pg_temp.review_all(:e3, 'approved');
select pg_temp.fails('tiada teks panduan: tiada kebenaran', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e3, (select id from s where k='v3')), 'guidance_text_tiada');
select pg_temp.eq('tiada kebenaran terbit', pg_temp.approved(:e3), 'false');

-- 6. kelulusan manual, terikat pada deklarasi semasa
select pg_temp.fails('video bukan semasa ditolak', format($q$select approve_energize(%L,%L,gen_random_uuid())$q$, :apr, :e1), 'video_not_current');
select pg_temp.eq('approver luluskan', (approve_energize(:apr, :e1, (select id from s where k='vid1')) = (select id from s where k='vid1'))::text, 'true');
select pg_temp.eq('kebenaran direkod: siapa, bila, terikat video', (select (energize_approved_at is not null and energize_approved_by=:apr::uuid and approved_submission_id=(select id from s where k='vid1'))::text from enrollments where id=:e1), 'true');
select pg_temp.eq('admin_actions: teks panduan AHZ disimpan', (select detail->>'guidance_text' from admin_actions where action='energize_approval' and enrollment_id=:e1), 'PANDUAN KESELAMATAN AHZ (ujian)');
select pg_temp.eq('admin_actions: ikat video + borang', (select (detail->>'video_submission_id' = (select id::text from s where k='vid1') and detail->>'form_submission_id' = (select id::text from s where k='form1'))::text from admin_actions where action='energize_approval' and enrollment_id=:e1), 'true');
select pg_temp.fails('lulus dua kali ditolak', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e1, (select id from s where k='vid1')), 'already_approved');

-- 7. hantar semula video => kelulusan dibatalkan AUTOMATIK
insert into s select 'vid2', submit_practical(:e1, 'video', null, 'rakaman baharu Telegram', true);
select pg_temp.eq('video semula: kebenaran DIBATALKAN', pg_temp.approved(:e1), 'false');
select pg_temp.eq('pembatalan: medan kebenaran dikosongkan', (select (energize_approved_by is null and approved_submission_id is null)::text from enrollments where id=:e1), 'true');
select pg_temp.eq('pembatalan direkod dalam admin_actions', (select count(*)::text from admin_actions where action='energize_cancelled' and enrollment_id=:e1), '1');
select pg_temp.fails('kelulusan asal tak boleh dipakai semula', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e1, (select id from s where k='vid1')), 'video_not_current');
select pg_temp.fails('video baharu belum disemak: tiada kelulusan', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e1, (select id from s where k='vid2')), 'video_not_reviewed');
select pg_temp.review_all(:e1, 'approved');
select approve_energize(:apr, :e1, (select id from s where k='vid2'));
select pg_temp.eq('kelulusan baharu untuk video baharu', pg_temp.approved(:e1), 'true');

-- 8. hantar semula BORANG juga membatalkan
insert into s select 'form2', submit_practical(:e1, 'form', 'submissions/eeeeeeee-0000-0000-0000-0000000000e1/form-2.jpg', null, null);
select pg_temp.eq('borang semula: kebenaran DIBATALKAN', pg_temp.approved(:e1), 'false');
select pg_temp.eq('dua pembatalan direkod', (select count(*)::text from admin_actions where action='energize_cancelled' and enrollment_id=:e1), '2');
select pg_temp.fails('borang baharu belum disemak: approve ditolak', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e1, (select id from s where k='vid2')), 'form_not_reviewed');
select pg_temp.review_all(:e1, 'approved');
select approve_energize(:apr, :e1, (select id from s where k='vid2'));

-- 9. keputusan praktikal (selepas bekalan, di luar sistem)
select pg_temp.fails('keputusan tanpa kebenaran bekalan ditolak', format($q$select record_practical_result(%L,%L,'lulus',null)$q$, :r1, :e3), 'no_energize_approval');
select pg_temp.fails('keputusan oleh admin ditolak (reviewer/approver sahaja)', format($q$select record_practical_result(%L,%L,'lulus',null)$q$, :adm, :e1), 'not_reviewer');
select pg_temp.fails('belum tanpa komen', format($q$select record_practical_result(%L,%L,'belum',' ')$q$, :r1, :e1), 'comment_required');
select pg_temp.eq('belum + komen', record_practical_result(:r1, :e1, 'belum', 'Sambungan bumi perlu dibaiki'), 'belum');
select pg_temp.eq('belum menamatkan kebenaran bekalan', pg_temp.approved(:e1), 'false');
select pg_temp.eq('keputusan direkod admin_actions', (select count(*)::text from admin_actions where action='practical_result' and enrollment_id=:e1 and detail->>'result'='belum'), '1');
insert into s select 'form3', submit_practical(:e1, 'form', 'submissions/eeeeeeee-0000-0000-0000-0000000000e1/form-3.jpg', null, null);
insert into s select 'vid3', submit_practical(:e1, 'video', null, 'ujian semula Telegram', true);
select pg_temp.review_all(:e1, 'approved');
select approve_energize(:apr, :e1, (select id from s where k='vid3'));
select pg_temp.eq('lulus', record_practical_result(:apr, :e1, 'lulus', null), 'lulus');
select pg_temp.eq('keputusan lulus disimpan (siapa dan bila)', (select (practical_result='lulus' and practical_result_by is not null and practical_result_at is not null)::text from enrollments where id=:e1), 'true');
select pg_temp.fails('selepas lulus: penghantaran ditutup', format($q$select submit_practical(%L,'video',null,'lagi',true)$q$, :e1), 'practical_closed');
select pg_temp.fails('selepas lulus: kebenaran baharu ditutup', format($q$select approve_energize(%L,%L,%L)$q$, :apr, :e1, (select id from s where k='vid3')), 'practical_closed');

-- 10. refund menutup
update enrollments set refunded_at = now() where id = :e2;
select pg_temp.fails('refund: tak boleh hantar', format($q$select submit_practical(%L,'form',%L,null,null)$q$, :e2, 'submissions/eeeeeeee-0000-0000-0000-0000000000e2/f.jpg'), 'access_closed');

-- 11. pautan Telegram
select pg_temp.fails('pautan bukan t.me ditolak', format($q$select set_telegram_link(%L,%L,'https://evil.example/abc')$q$, :adm, :e1), 'bad_link');
select pg_temp.fails('pautan http ditolak', format($q$select set_telegram_link(%L,%L,'http://t.me/+abcdef')$q$, :adm, :e1), 'bad_link');
select pg_temp.fails('reviewer tak boleh tetapkan pautan', format($q$select set_telegram_link(%L,%L,'https://t.me/+abcdef123')$q$, :r1, :e1), 'actor_not_allowed');
select set_telegram_link(:adm, :e1, 'https://t.me/+abcdef123');
select pg_temp.eq('pautan Telegram disimpan', (select telegram_invite_link from enrollments where id=:e1), 'https://t.me/+abcdef123');

-- 12. klien tak boleh panggil sebarang fungsi kebenaran
set local role authenticated;
select pg_temp.fails('authenticated tak boleh approve_energize', $q$select approve_energize(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())$q$, 'permission denied for function approve_energize');
select pg_temp.fails('authenticated tak boleh submit_practical', $q$select submit_practical(gen_random_uuid(),'form','x',null,null)$q$, 'permission denied for function submit_practical');
select pg_temp.fails('authenticated tak boleh cancel_energize', $q$select cancel_energize(gen_random_uuid(),gen_random_uuid(),'x')$q$, 'permission denied for function cancel_energize');
select pg_temp.fails('authenticated tak boleh ubah energize_approved_at terus', $q$update public.enrollments set energize_approved_at = now()$q$, 'permission denied for table enrollments');
rollback;
