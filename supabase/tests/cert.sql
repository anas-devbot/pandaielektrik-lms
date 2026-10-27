-- Ujian sijil (slice 8). ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/cert.sql
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

insert into staff_invites values ('c-adm@t.local','admin'),('c-apr@t.local','approver'),('c-rev@t.local','reviewer');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('aaaaaaaa-0000-0000-0000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', e, '{"privacy_accepted":true,"full_name":"Ali Bin Abu"}'
from (values ('a1','c-s1@t.local'),('a2','c-s2@t.local'),('a3','c-s3@t.local'),('a4','c-s4@t.local'),('b1','c-adm@t.local'),('b2','c-apr@t.local'),('b3','c-rev@t.local')) v(n,e);
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','ct','Kursus Ujian Sijil',14900,'{"identity_check_enabled":{"theory":false,"theory_practical":false}}'),
  ('cccccccc-0000-0000-0000-0000000000c2','ct-id','Kursus Identiti',14900,'{"identity_check_enabled":{"theory":true,"theory_practical":false}}');
insert into enrollments (id, user_id, course_id, stage, access_ends_at) values
  ('eeeeeeee-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000c1','theory_passed', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e2','aaaaaaaa-0000-0000-0000-0000000000a2','cccccccc-0000-0000-0000-0000000000c1','part2_review', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e3','aaaaaaaa-0000-0000-0000-0000000000a3','cccccccc-0000-0000-0000-0000000000c2','theory_passed', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e4','aaaaaaaa-0000-0000-0000-0000000000a4','cccccccc-0000-0000-0000-0000000000c1','theory_passed', now()+interval '90 days');
\set e1 '''eeeeeeee-0000-0000-0000-0000000000e1'''
\set e2 '''eeeeeeee-0000-0000-0000-0000000000e2'''
\set e3 '''eeeeeeee-0000-0000-0000-0000000000e3'''
\set e4 '''eeeeeeee-0000-0000-0000-0000000000e4'''
\set adm '''aaaaaaaa-0000-0000-0000-0000000000b1'''
\set apr '''aaaaaaaa-0000-0000-0000-0000000000b2'''
\set rev '''aaaaaaaa-0000-0000-0000-0000000000b3'''
create temp table cc (k text primary key, id uuid);

-- 1. gating: belum layak
select pg_temp.fails('belum pilih trek: tak layak', format($q$select issue_certificate(%L,'theory','Ali Bin Abu')$q$, :e1), 'not_eligible');
select pg_temp.fails('stage belum theory_passed: tak boleh pilih trek', format($q$select choose_track(%L,'theory')$q$, :e2), 'not_eligible');
select pg_temp.fails('trek tak sah', format($q$select choose_track(%L,'xyz')$q$, :e1), 'bad_track');
select pg_temp.eq('pilih trek teori', choose_track(:e1, 'theory'), 'theory');
select pg_temp.fails('trek terkunci', format($q$select choose_track(%L,'theory_practical')$q$, :e1), 'track_locked');
select pg_temp.fails('trek teori tak boleh dapat sijil teori & praktikal', format($q$select issue_certificate(%L,'theory_practical','Ali Bin Abu')$q$, :e1), 'not_eligible');

-- 2. nama pada sijil
select pg_temp.fails('nama terlalu pendek', format($q$select issue_certificate(%L,'theory','A')$q$, :e1), 'bad_name');
select pg_temp.fails('nama ada digit', format($q$select issue_certificate(%L,'theory','Ali 123')$q$, :e1), 'bad_name');
select pg_temp.fails('nama ada tag HTML', format($q$select issue_certificate(%L,'theory','<b>Ali</b>')$q$, :e1), 'bad_name');
select pg_temp.fails('nama kosong', format($q$select issue_certificate(%L,'theory','   ')$q$, :e1), 'bad_name');

-- 3. keluarkan: format cert_id, snapshot, stage, idempotent
insert into cc select 'c1', issue_certificate(:e1, 'theory', '  Ali Bin Abu  ');
select pg_temp.eq('cert_id format AHZ-TAHUN-5 digit', (select (cert_id ~ '^AHZ-[0-9]{4}-[0-9]{5}$')::text from certificates where id=(select id from cc where k='c1')), 'true');
select pg_temp.eq('nama di-trim dan snapshot', (select holder_name from certificates where id=(select id from cc where k='c1')), 'Ali Bin Abu');
select pg_temp.eq('tajuk kursus snapshot', (select course_title from certificates where id=(select id from cc where k='c1')), 'Kursus Ujian Sijil');
select pg_temp.eq('verify_token 32 hex', (select (verify_token ~ '^[0-9a-f]{32}$')::text from certificates where id=(select id from cc where k='c1')), 'true');
select pg_temp.eq('stage jadi completed', (select stage from enrollments where id=:e1), 'completed');
update courses set title = 'Tajuk Ditukar' where id='cccccccc-0000-0000-0000-0000000000c1';
update profiles set full_name = 'Nama Lain' where id='aaaaaaaa-0000-0000-0000-0000000000a1';
select pg_temp.eq('sijil tak berubah bila kursus/profil berubah', (select holder_name||'|'||course_title from certificates where id=(select id from cc where k='c1')), 'Ali Bin Abu|Kursus Ujian Sijil');
insert into cc select 'c1b', issue_certificate(:e1, 'theory', 'Nama Lain Sama Sekali');
select pg_temp.eq('keluarkan semula = idempotent (sijil sama, nama asal kekal)', ((select id from cc where k='c1') = (select id from cc where k='c1b'))::text, 'true');
select pg_temp.eq('hanya satu sijil sah', (select count(*)::text from certificates where enrollment_id=:e1), '1');

-- 4. semakan awam: hanya medan putih, status sah
create temp table pub as select certificate_public((select verify_token from certificates where id=(select id from cc where k='c1'))) j;
select pg_temp.eq('awam: medan dibenarkan sahaja', (select (select string_agg(k, ',' order by k) from jsonb_object_keys(j) k) from pub), 'cert_id,course_title,holder_name,issued_at,period_end,period_start,status,type');
select pg_temp.eq('awam: status sah', (select j->>'status' from pub), 'sah');
select pg_temp.eq('awam: tiada emel/telefon/enrollment', (select (j::text ~* '(@t\.local|enrollment|phone|user_id)')::text from pub), 'false');
select pg_temp.eq('token tak wujud = null', (certificate_public('0000')::text), null);

-- 5. batal
select pg_temp.fails('batal: bukan admin', format($q$select revoke_certificate(%L,%L,'x')$q$, :apr, (select id from cc where k='c1')), 'actor_not_admin');
select pg_temp.fails('batal: tanpa sebab', format($q$select revoke_certificate(%L,%L,' ')$q$, :adm, (select id from cc where k='c1')), 'reason_required');
select revoke_certificate(:adm, (select id from cc where k='c1'), 'Salah ejaan nama');
select pg_temp.eq('batal: status dibatalkan di halaman awam', (certificate_public((select verify_token from certificates where id=(select id from cc where k='c1')))->>'status'), 'dibatalkan');
select pg_temp.eq('batal: direkod admin_actions', (select count(*)::text from admin_actions where action='certificate_revoked' and reason='Salah ejaan nama'), '1');
select pg_temp.fails('batal dua kali ditolak', format($q$select revoke_certificate(%L,%L,'lagi')$q$, :adm, (select id from cc where k='c1')), 'already_revoked');
insert into cc select 'c2', issue_certificate(:e1, 'theory', 'Ali Bin Abu Yang Betul');
select pg_temp.eq('selepas batal: sijil baharu boleh dikeluarkan (cert_id berbeza)', ((select cert_id from certificates where id=(select id from cc where k='c2')) <> (select cert_id from certificates where id=(select id from cc where k='c1')))::text, 'true');

-- 6. identiti (flag config per jenis, default mati)
select choose_track(:e3, 'theory');
select pg_temp.fails('flag identiti hidup: sijil ditolak tanpa pengesahan', format($q$select issue_certificate(%L,'theory','Siti Binti Ahmad')$q$, :e3), 'identity_required');
select pg_temp.fails('pengesahan identiti: reviewer tak dibenarkan', format($q$select verify_identity(%L,%L,'semak kad pengenalan di sesi','x')$q$, :rev, :e3), 'actor_not_allowed');
select pg_temp.fails('pengesahan identiti: tanpa kaedah/sebab', format($q$select verify_identity(%L,%L,'','')$q$, :apr, :e3), 'method_reason_required');
select verify_identity(:apr, :e3, 'semak kad pengenalan di sesi', 'Pelajar hadir sesi bantuan');
select pg_temp.eq('identiti direkod (siapa/bila/kaedah)', (select (identity_verified_at is not null and identity_verified_by is not null and identity_method is not null)::text from enrollments where id=:e3), 'true');
select pg_temp.eq('pengesahan identiti masuk admin_actions', (select count(*)::text from admin_actions where action='identity_verified' and enrollment_id=:e3), '1');
select pg_temp.eq('selepas pengesahan: sijil dikeluarkan', (issue_certificate(:e3, 'theory', 'Siti Binti Ahmad') is not null)::text, 'true');

-- 7. refund menutup
select choose_track(:e4, 'theory');
update enrollments set refunded_at = now() where id=:e4;
select pg_temp.fails('refund: sijil ditolak', format($q$select issue_certificate(%L,'theory','Abu Bakar')$q$, :e4), 'refunded');

-- 8. klien tak boleh panggil
set local role authenticated;
select pg_temp.fails('authenticated tak boleh issue_certificate', $q$select issue_certificate(gen_random_uuid(),'theory','x y')$q$, 'permission denied for function issue_certificate');
select pg_temp.fails('authenticated tak boleh certificate_public', $q$select certificate_public('x')$q$, 'permission denied for function certificate_public');
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-0000-0000-0000-0000000000a2','role','authenticated')::text, true);
select pg_temp.eq('pelajar lain nampak 0 sijil (RLS)', (select count(*)::text from public.certificates), '0');
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-0000-0000-0000-0000000000a1','role','authenticated')::text, true);
select pg_temp.eq('pemilik nampak sijil sendiri sahaja', (select (count(*) > 0 and bool_and(enrollment_id = 'eeeeeeee-0000-0000-0000-0000000000e1'))::text from public.certificates), 'true');
rollback;
