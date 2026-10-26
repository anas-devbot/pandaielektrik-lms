-- LOCAL sahaja: buang data ujian slice 7 (p2-*@test.local). admin_actions append-only: trigger dimatikan sementara
-- HANYA untuk jadual itu (transaksi berasingan), supaya cascade FK untuk auth.users (identiti, sesi) tetap berjalan.
begin;
set local session_replication_role = replica;
delete from admin_actions where actor_id in (select id from auth.users where email like 'p2-%@test.local')
   or enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'p2-%@test.local');
commit;
begin;
delete from quiz_attempts where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'p2-%@test.local');
delete from submissions where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'p2-%@test.local');
delete from enrollments where user_id in (select id from auth.users where email like 'p2-%@test.local');
delete from staff_invites where email like 'p2-%@test.local';
delete from auth.users where email like 'p2-%@test.local';   -- profil + identiti mengikut cascade
update courses set config = jsonb_set(config, '{schematic_max_mb}', '10') where slug = 'kursus-elektrik';
commit;
