-- LOCAL sahaja: buang data ujian callback. payment_events append-only (trigger), jadi trigger dimatikan sementara dalam transaksi ini.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/cleanup-test-data.sql
begin;
set local session_replication_role = replica;
delete from payment_events where order_number in (select order_number from orders where user_id in (select id from auth.users where email like 'cb-%@test.local'));
delete from enrollments where user_id in (select id from auth.users where email like 'cb-%@test.local');
delete from orders where user_id in (select id from auth.users where email like 'cb-%@test.local');
delete from payment_events where order_id is null and order_number like 'TAKADA%';
delete from profiles where id in (select id from auth.users where email like 'cb-%@test.local');  -- cascade mati bila trigger FK dimatikan
delete from auth.users where email like 'cb-%@test.local';
commit;
