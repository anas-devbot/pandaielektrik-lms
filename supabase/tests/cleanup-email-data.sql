-- LOCAL sahaja: buang data ujian slice 13 (em-*@test.local).
begin;
set local session_replication_role = replica;
delete from reminders where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'em-%@test.local');
delete from payment_events where order_id in (select o.id from orders o join auth.users u on u.id=o.user_id where u.email like 'em-%@test.local');
commit;
begin;
delete from enrollments where user_id in (select id from auth.users where email like 'em-%@test.local');
delete from orders where user_id in (select id from auth.users where email like 'em-%@test.local');
delete from auth.users where email like 'em-%@test.local';
commit;
