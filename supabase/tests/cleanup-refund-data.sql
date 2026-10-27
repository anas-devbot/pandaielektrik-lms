-- LOCAL sahaja: buang data ujian slice 11 (rf-*@test.local).
begin;
set local session_replication_role = replica;
delete from admin_actions where actor_id in (select id from auth.users where email like 'rf-%@test.local') or enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'rf-%@test.local');
delete from payment_events where order_id in (select o.id from orders o join auth.users u on u.id=o.user_id where u.email like 'rf-%@test.local');
commit;
begin;
delete from refund_requests where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'rf-%@test.local');
delete from certificates where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'rf-%@test.local');
delete from submissions where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'rf-%@test.local');
delete from enrollments where user_id in (select id from auth.users where email like 'rf-%@test.local');
delete from orders where user_id in (select id from auth.users where email like 'rf-%@test.local');
delete from staff_invites where email like 'rf-%@test.local';
delete from auth.users where email like 'rf-%@test.local';
commit;
