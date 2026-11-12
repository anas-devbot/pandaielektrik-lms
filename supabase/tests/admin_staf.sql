-- Ujian modul Staf admin (add_staff, confirm_staff_added, set_staff_role, deactivate_staff). ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/admin_staf.sql
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

insert into staff_invites values ('st-adm1@t.local','admin'),('st-adm2@t.local','admin'),('st-apr@t.local','approver'),('st-rev@t.local','reviewer');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-adm1@t.local','{"full_name":"Admin Satu"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-adm2@t.local','{"full_name":"Admin Dua"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-apr@t.local','{"full_name":"Approver"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-rev@t.local','{"full_name":"Reviewer"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-pel@t.local','{"privacy_accepted":true,"full_name":"Pelajar","phone":"0123456789"}');
\set a1 '''bbbbbbbb-0000-0000-0000-0000000000a1'''
\set a2 '''bbbbbbbb-0000-0000-0000-0000000000a2'''
\set apr '''bbbbbbbb-0000-0000-0000-0000000000b1'''
\set rev '''bbbbbbbb-0000-0000-0000-0000000000c1'''
\set pel '''bbbbbbbb-0000-0000-0000-0000000000d1'''
create function pg_temp.role_of(u uuid) returns text language sql as $$ select role from profiles where id = u $$;
create function pg_temp.n_act(a text) returns text language sql as $$ select count(*)::text from admin_actions where action = a $$;

-- add_staff
select pg_temp.fails('add_staff: bukan admin (approver)', format($q$select add_staff(%L,'baru@t.local','reviewer')$q$, :apr), 'actor_not_admin');
select pg_temp.fails('add_staff: peranan tidak sah (student)', format($q$select add_staff(%L,'baru@t.local','student')$q$, :a1), 'bad_role');
select pg_temp.fails('add_staff: emel tidak sah', format($q$select add_staff(%L,'bukan-emel','reviewer')$q$, :a1), 'bad_email');
select pg_temp.fails('add_staff: emel pelajar sedia ada ditolak (tidak diubah senyap)', format($q$select add_staff(%L,'st-pel@t.local','reviewer')$q$, :a1), 'user_exists_student');
select pg_temp.fails('add_staff: emel staf sedia ada ditolak (huruf besar)', format($q$select add_staff(%L,'ST-APR@t.local','reviewer')$q$, :a1), 'user_exists_staff');
select add_staff(:a1, '  Baru@T.Local ', 'reviewer');
select pg_temp.eq('add_staff: jemputan dicipta (huruf kecil, trim)', (select role from staff_invites where email = 'baru@t.local'), 'reviewer');

-- confirm_staff_added: akaun dicipta melalui trigger handle_new_user menggunakan jemputan
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values ('bbbbbbbb-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','baru@t.local','{"full_name":"Staf Baru"}');
select pg_temp.eq('trigger: jemputan menjadi peranan staf', pg_temp.role_of('bbbbbbbb-0000-0000-0000-0000000000e1'), 'reviewer');
select pg_temp.fails('confirm_staff_added: bukan admin', format($q$select confirm_staff_added(%L,'bbbbbbbb-0000-0000-0000-0000000000e1','reviewer')$q$, :rev), 'actor_not_admin');
select pg_temp.fails('confirm_staff_added: peranan tidak sepadan', format($q$select confirm_staff_added(%L,'bbbbbbbb-0000-0000-0000-0000000000e1','admin')$q$, :a1), 'not_found');
select pg_temp.fails('confirm_staff_added: pelajar bukan staf', format($q$select confirm_staff_added(%L,%L,'reviewer')$q$, :a1, :pel), 'not_found');
select confirm_staff_added(:a1, 'bbbbbbbb-0000-0000-0000-0000000000e1', 'reviewer');
select pg_temp.eq('confirm_staff_added: direkod', pg_temp.n_act('staff_added'), '1');

-- set_staff_role
select pg_temp.fails('set_staff_role: bukan admin', format($q$select set_staff_role(%L,%L,'admin',false,'x')$q$, :apr, :rev), 'actor_not_admin');
select pg_temp.fails('set_staff_role: ubah diri sendiri', format($q$select set_staff_role(%L,%L,'reviewer',false,'x')$q$, :a1, :a1), 'self_change');
select pg_temp.fails('set_staff_role: tanpa sebab', format($q$select set_staff_role(%L,%L,'approver',false,' ')$q$, :a1, :rev), 'reason_required');
select pg_temp.fails('set_staff_role: peranan tidak sah (student)', format($q$select set_staff_role(%L,%L,'student',false,'x')$q$, :a1, :rev), 'bad_role');
select pg_temp.fails('set_staff_role: pelajar tanpa pengesahan', format($q$select set_staff_role(%L,%L,'reviewer',false,'x')$q$, :a1, :pel), 'student_needs_confirm');
select pg_temp.eq('set_staff_role: pelajar kekal pelajar selepas ditolak', pg_temp.role_of(:pel), 'student');
select pg_temp.fails('set_staff_role: tiada perubahan', format($q$select set_staff_role(%L,%L,'reviewer',false,'x')$q$, :a1, :rev), 'no_change');
select pg_temp.fails('set_staff_role: pengguna tiada', format($q$select set_staff_role(%L,gen_random_uuid(),'reviewer',false,'x')$q$, :a1), 'not_found');
select set_staff_role(:a1, :rev, 'approver', false, 'Naik taraf');
select pg_temp.eq('set_staff_role: reviewer -> approver', pg_temp.role_of(:rev), 'approver');
select set_staff_role(:a1, :pel, 'reviewer', true, 'Pelajar dilantik fasilitator');
select pg_temp.eq('set_staff_role: pelajar dengan pengesahan menjadi staf', pg_temp.role_of(:pel), 'reviewer');
select pg_temp.eq('set_staff_role: direkod (2)', pg_temp.n_act('staff_role_changed'), '2');
select set_staff_role(:a1, :a2, 'approver', false, 'Turun taraf admin kedua');
select pg_temp.eq('set_staff_role: admin diturunkan oleh admin lain', pg_temp.role_of(:a2), 'approver');

-- a1 kini satu-satunya admin: tidak boleh menurunkan atau menyahaktifkan dirinya (admin terakhir tidak boleh hilang)
select pg_temp.fails('admin terakhir: tidak boleh turunkan diri', format($q$select set_staff_role(%L,%L,'approver',false,'x')$q$, :a1, :a1), 'self_change');
select pg_temp.fails('admin terakhir: tidak boleh nyahaktif diri', format($q$select deactivate_staff(%L,%L,'x')$q$, :a1, :a1), 'self_change');
select pg_temp.fails('approver tidak boleh menyahaktif admin terakhir', format($q$select deactivate_staff(%L,%L,'x')$q$, :a2, :a1), 'actor_not_admin');
select pg_temp.eq('admin terakhir kekal admin', pg_temp.role_of(:a1), 'admin');

-- deactivate_staff
select pg_temp.fails('deactivate_staff: bukan admin', format($q$select deactivate_staff(%L,%L,'x')$q$, :apr, :rev), 'actor_not_admin');
select pg_temp.fails('deactivate_staff: tanpa sebab', format($q$select deactivate_staff(%L,%L,'')$q$, :a1, :rev), 'reason_required');
select pg_temp.fails('deactivate_staff: pengguna tiada', format($q$select deactivate_staff(%L,gen_random_uuid(),'x')$q$, :a1), 'not_found');
select deactivate_staff(:a1, :rev, 'Berhenti');
select pg_temp.eq('deactivate_staff: peranan dibuang (jadi student)', pg_temp.role_of(:rev), 'student');
select pg_temp.fails('deactivate_staff: bukan staf (sudah dinyahaktif)', format($q$select deactivate_staff(%L,%L,'x')$q$, :a1, :rev), 'not_staff');
select pg_temp.eq('deactivate_staff: akaun TIDAK dipadam (rekod kekal)', (select count(*)::text from auth.users where id = :rev), '1');
select pg_temp.eq('deactivate_staff: direkod', pg_temp.n_act('staff_deactivated'), '1');

-- tiada rahsia dalam admin_actions; tindakan staf tidak boleh diubah (append-only)
select pg_temp.eq('admin_actions staf: tiada kata laluan/rahsia dalam detail', (select count(*)::text from admin_actions where action like 'staff_%' and (detail::text ~* '(pass|secret|token)')), '0');
select pg_temp.eq('admin_actions staf: 5 baris direkod', (select count(*)::text from admin_actions where action like 'staff_%'), '5');
select pg_temp.fails('admin_actions staf: tidak boleh dipadam', $q$delete from admin_actions where action like 'staff_%'$q$, 'admin_actions is append-only');

-- pelanggan biasa (authenticated) tidak boleh memanggil fungsi
set local role authenticated;
select pg_temp.fails('authenticated tak boleh add_staff', $q$select add_staff(gen_random_uuid(),'x@t.local','admin')$q$, 'permission denied for function add_staff');
select pg_temp.fails('authenticated tak boleh set_staff_role', $q$select set_staff_role(gen_random_uuid(),gen_random_uuid(),'admin',true,'x')$q$, 'permission denied for function set_staff_role');
select pg_temp.fails('authenticated tak boleh deactivate_staff', $q$select deactivate_staff(gen_random_uuid(),gen_random_uuid(),'x')$q$, 'permission denied for function deactivate_staff');
select pg_temp.fails('authenticated tak boleh confirm_staff_added', $q$select confirm_staff_added(gen_random_uuid(),gen_random_uuid(),'admin')$q$, 'permission denied for function confirm_staff_added');
reset role;
rollback;
