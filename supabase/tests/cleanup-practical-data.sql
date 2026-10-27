-- LOCAL sahaja: buang data ujian slice 9 (pk-*@test.local) dan teks panduan ujian daripada config.
begin;
set local session_replication_role = replica;
delete from admin_actions where actor_id in (select id from auth.users where email like 'pk-%@test.local') or enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'pk-%@test.local');
commit;
begin;
delete from submissions where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'pk-%@test.local');
delete from enrollments where user_id in (select id from auth.users where email like 'pk-%@test.local');
delete from staff_invites where email like 'pk-%@test.local';
delete from auth.users where email like 'pk-%@test.local';
update courses set config = config - 'energize_guidance_text' where slug = 'kursus-elektrik';
commit;
