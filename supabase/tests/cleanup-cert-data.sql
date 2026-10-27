-- LOCAL sahaja: buang data ujian slice 8 (ct-*@test.local). admin_actions append-only: dimatikan sementara dalam transaksi berasingan.
begin;
set local session_replication_role = replica;
delete from admin_actions where actor_id in (select id from auth.users where email like 'ct-%@test.local') or enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'ct-%@test.local');
commit;
begin;
delete from certificates where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'ct-%@test.local');
delete from enrollments where user_id in (select id from auth.users where email like 'ct-%@test.local');
delete from staff_invites where email like 'ct-%@test.local';
delete from auth.users where email like 'ct-%@test.local';
update courses set config = jsonb_set(config, '{certificate,wording_approved}', 'false') where slug = 'kursus-elektrik';
commit;
