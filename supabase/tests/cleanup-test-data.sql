-- LOCAL sahaja: buang data ujian callback. payment_events append-only (trigger): dimatikan sementara dalam transaksi berasingan
-- supaya cascade FK untuk auth.users (profil, identiti) tidak terjejas.
begin;
set local session_replication_role = replica;
delete from payment_events where order_number in (select order_number from orders where user_id in (select id from auth.users where email like 'cb-%@test.local'));
delete from payment_events where order_id is null and order_number like 'TAKADA%';
commit;
begin;
delete from reminders where enrollment_id in (select e.id from enrollments e join auth.users u on u.id = e.user_id where u.email like 'cb-%@test.local');
delete from enrollments where user_id in (select id from auth.users where email like 'cb-%@test.local');
delete from orders where user_id in (select id from auth.users where email like 'cb-%@test.local');
delete from auth.users where email like 'cb-%@test.local';
commit;
