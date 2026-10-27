-- Ujian Sijil Teori & Praktikal (slice 10). ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/cert_practical.sql
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
insert into staff_invites values ('cp-adm@t.local','admin'),('cp-apr@t.local','approver');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('aaaaaaaa-0000-0000-0000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', e, '{"privacy_accepted":true,"full_name":"Pelajar Uji"}'
from (values ('a1','cp-s1@t.local'),('a2','cp-s2@t.local'),('a3','cp-s3@t.local'),('a4','cp-s4@t.local'),('a5','cp-s5@t.local'),('b1','cp-adm@t.local'),('b2','cp-apr@t.local')) v(n,e);
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','cp','Kursus Praktikal Sijil',14900,'{"identity_check_enabled":{"theory":false,"theory_practical":false}}'),
  ('cccccccc-0000-0000-0000-0000000000c2','cp-id','Kursus Praktikal Identiti',14900,'{"identity_check_enabled":{"theory":false,"theory_practical":true}}');
insert into enrollments (id, user_id, course_id, stage, cert_track, practical_result, access_ends_at) values
  ('eeeeeeee-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000c1','practical','theory_practical',null, now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e2','aaaaaaaa-0000-0000-0000-0000000000a2','cccccccc-0000-0000-0000-0000000000c1','practical','theory_practical','belum', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e3','aaaaaaaa-0000-0000-0000-0000000000a3','cccccccc-0000-0000-0000-0000000000c2','practical','theory_practical','lulus', now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e4','aaaaaaaa-0000-0000-0000-0000000000a4','cccccccc-0000-0000-0000-0000000000c1','theory_passed','theory',null, now()+interval '90 days'),
  ('eeeeeeee-0000-0000-0000-0000000000e5','aaaaaaaa-0000-0000-0000-0000000000a5','cccccccc-0000-0000-0000-0000000000c1','practical','theory_practical','lulus', now()+interval '90 days');
\set e1 '''eeeeeeee-0000-0000-0000-0000000000e1'''
\set e2 '''eeeeeeee-0000-0000-0000-0000000000e2'''
\set e3 '''eeeeeeee-0000-0000-0000-0000000000e3'''
\set e4 '''eeeeeeee-0000-0000-0000-0000000000e4'''
\set e5 '''eeeeeeee-0000-0000-0000-0000000000e5'''
\set adm '''aaaaaaaa-0000-0000-0000-0000000000b1'''
\set apr '''aaaaaaaa-0000-0000-0000-0000000000b2'''
create temp table cc (k text primary key, id uuid);

-- 1. gating: keputusan praktikal wajib 'lulus'
select pg_temp.fails('praktikal belum ada keputusan: sijil ditolak', format($q$select issue_certificate(%L,'theory_practical','Ali Bin Abu')$q$, :e1), 'not_eligible');
select pg_temp.fails('praktikal "belum": sijil ditolak', format($q$select issue_certificate(%L,'theory_practical','Ali Bin Abu')$q$, :e2), 'not_eligible');
select pg_temp.fails('trek praktikal tak boleh dapat sijil teori sahaja', format($q$select issue_certificate(%L,'theory','Ali Bin Abu')$q$, :e5), 'not_eligible');
select pg_temp.fails('trek teori tak boleh dapat sijil teori & praktikal', format($q$select issue_certificate(%L,'theory_practical','Ali Bin Abu')$q$, :e4), 'not_eligible');

-- 2. keluarkan selepas lulus
insert into cc select 'c1', issue_certificate(:e5, 'theory_practical', '  Siti Binti Ahmad ');
select pg_temp.eq('jenis theory_practical, nama trim', (select type||'|'||holder_name from certificates where id=(select id from cc where k='c1')), 'theory_practical|Siti Binti Ahmad');
select pg_temp.eq('cert_id format sama dengan sijil teori (jujukan kongsi)', (select (cert_id ~ '^AHZ-[0-9]{4}-[0-9]{5}$')::text from certificates where id=(select id from cc where k='c1')), 'true');
select pg_temp.eq('stage jadi completed', (select stage from enrollments where id=:e5), 'completed');
select pg_temp.eq('tajuk kursus snapshot', (select course_title from certificates where id=(select id from cc where k='c1')), 'Kursus Praktikal Sijil');
insert into cc select 'c1b', issue_certificate(:e5, 'theory_practical', 'Nama Lain');
select pg_temp.eq('idempotent (sijil sama, nama asal)', ((select id from cc where k='c1') = (select id from cc where k='c1b'))::text, 'true');
select pg_temp.eq('halaman awam: jenis theory_practical, status sah', (select certificate_public(verify_token)->>'type' || '|' || (certificate_public(verify_token)->>'status') from certificates where id=(select id from cc where k='c1')), 'theory_practical|sah');
select pg_temp.fails('selepas dapat sijil teori & praktikal, sijil teori sahaja tetap tak boleh', format($q$select issue_certificate(%L,'theory','Siti Binti Ahmad')$q$, :e5), 'not_eligible');

-- 3. batal dan keluarkan semula
select revoke_certificate(:adm, (select id from cc where k='c1'), 'Salah ejaan nama');
insert into cc select 'c2', issue_certificate(:e5, 'theory_practical', 'Siti Binti Ahmad Yang Betul');
select pg_temp.eq('selepas batal: sijil baharu (cert_id berbeza)', ((select cert_id from certificates where id=(select id from cc where k='c2')) <> (select cert_id from certificates where id=(select id from cc where k='c1')))::text, 'true');

-- 4. flag identiti untuk jenis theory_practical
select pg_temp.fails('flag identiti hidup: ditolak tanpa pengesahan', format($q$select issue_certificate(%L,'theory_practical','Abu Bakar')$q$, :e3), 'identity_required');
select verify_identity(:apr, :e3, 'semak kad pengenalan di sesi', 'Pelajar hadir');
select pg_temp.eq('selepas pengesahan: dikeluarkan', (issue_certificate(:e3, 'theory_practical', 'Abu Bakar') is not null)::text, 'true');

-- 5. refund
update enrollments set refunded_at = now() where id = :e1;
update enrollments set practical_result = 'lulus' where id = :e1;
select pg_temp.fails('refund: ditolak', format($q$select issue_certificate(%L,'theory_practical','Ali Bin Abu')$q$, :e1), 'refunded');

-- 6. klien tak boleh panggil
set local role authenticated;
select pg_temp.fails('authenticated tak boleh issue_certificate', $q$select issue_certificate(gen_random_uuid(),'theory_practical','x y')$q$, 'permission denied for function issue_certificate');
rollback;
