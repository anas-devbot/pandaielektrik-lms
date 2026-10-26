-- Ujian pemprosesan bayaran + grant manual. ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/payments.sql
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

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p-a@t.local','{"privacy_accepted":true}'),
  ('aaaaaaaa-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p-b@t.local','{"privacy_accepted":true}');
insert into staff_invites values ('p-admin@t.local','admin');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p-admin@t.local','{}');
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-000000000001','pt','PT',14900,'{"access_months":6}'),
  ('cccccccc-0000-0000-0000-000000000002','pt-nocfg','PT2',14900,'{}');
insert into orders (id,user_id,course_id,order_number,amount,terms_accepted_at) values
  ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-000000000001','ORD-1',14900,now()),
  ('dddddddd-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-000000000001','ORD-2',14900,now()),
  ('dddddddd-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-000000000002','ORD-3',14900,now());

-- 1. callback 3 kali (status 3) = satu enrollment, satu paid_at
select pg_temp.eq('callback #1 = paid', apply_payment_event('T1',3,'ORD-1',14900,'MYR','{}'), 'paid');
select pg_temp.eq('callback #2 = duplicate', apply_payment_event('T1',3,'ORD-1',14900,'MYR','{}'), 'duplicate');
select pg_temp.eq('callback #3 = duplicate', apply_payment_event('T1',3,'ORD-1',14900,'MYR','{}'), 'duplicate');
select pg_temp.eq('satu enrollment sahaja', (select count(*)::text from enrollments where order_id='dddddddd-0000-0000-0000-000000000001'), '1');
select pg_temp.eq('order paid', (select status from orders where order_number='ORD-1'), 'paid');
select pg_temp.eq('akses = paid_at + 6 bulan (config)', (select (access_ends_at = paid_at + interval '6 months')::text from enrollments e join orders o on o.id=e.order_id where o.order_number='ORD-1'), 'true');
select pg_temp.eq('satu payment_events untuk T1/3', (select count(*)::text from payment_events where transaction_id='T1' and status=3), '1');

-- 2. status 1 (pending) kemudian 3 untuk transaksi sama: dua baris, order paid sekali
select pg_temp.eq('status 1 dicatat, tak bayar', apply_payment_event('T2',1,'ORD-2',14900,'MYR','{}'), 'recorded_not_success');
select pg_temp.eq('order masih pending', (select status from orders where order_number='ORD-2'), 'pending');
select pg_temp.eq('tiada enrollment lagi', (select count(*)::text from enrollments where order_id='dddddddd-0000-0000-0000-000000000002'), '0');
select pg_temp.eq('status 3 selepas 1 = paid', apply_payment_event('T2',3,'ORD-2',14900,'MYR','{}'), 'paid');
select pg_temp.eq('T2 dua baris peristiwa', (select count(*)::text from payment_events where transaction_id='T2'), '2');

-- 3. negatif
select pg_temp.eq('amaun salah ditolak', apply_payment_event('T3',3,'ORD-3',100,'MYR','{}'), 'amount_mismatch');
select pg_temp.eq('mata wang salah ditolak', apply_payment_event('T4',3,'ORD-3',14900,'USD','{}'), 'amount_mismatch');
select pg_temp.eq('order tak dikenali', apply_payment_event('T5',3,'ORD-X',14900,'MYR','{}'), 'unknown_order');
select pg_temp.eq('status 2 tak bayar', apply_payment_event('T6',2,'ORD-3',14900,'MYR','{}'), 'recorded_not_success');
select pg_temp.eq('status 4 tak bayar', apply_payment_event('T7',4,'ORD-3',14900,'MYR','{}'), 'recorded_not_success');
select pg_temp.eq('ORD-3 kekal pending', (select status from orders where order_number='ORD-3'), 'pending');
-- sehala: selepas paid, status gagal tidak berundur
select pg_temp.eq('gagal selepas paid direkod sahaja', apply_payment_event('T8',2,'ORD-1',14900,'MYR','{}'), 'recorded_not_success');
select pg_temp.eq('ORD-1 kekal paid', (select status from orders where order_number='ORD-1'), 'paid');
-- transaksi kedua berjaya pada order sama (kes pelik): tiada enrollment kedua
select pg_temp.eq('transaksi lain pada order paid', apply_payment_event('T9',3,'ORD-1',14900,'MYR','{}'), 'already_paid');
select pg_temp.eq('masih satu enrollment', (select count(*)::text from enrollments where order_id='dddddddd-0000-0000-0000-000000000001'), '1');
-- config tiada akses -> gagal, order kekal pending (transaksi dibatalkan)
select pg_temp.fails('config access_months tiada = ralat', $q$select apply_payment_event('T10',3,'ORD-3',14900,'MYR','{}')$q$, 'courses.config.access_months tiada');
-- refunded tidak dibuka semula
update orders set status='refunded' where order_number='ORD-3';
select pg_temp.eq('order refunded diabaikan', apply_payment_event('T11',3,'ORD-3',14900,'MYR','{}'), 'ignored_refunded');

-- 4. grant manual
select pg_temp.fails('grant tanpa sebab ditolak', $q$select grant_manual('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000c','')$q$, 'reason_required');
select pg_temp.fails('actor bukan admin ditolak', $q$select grant_manual('aaaaaaaa-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','x')$q$, 'actor_not_admin');
select pg_temp.fails('sudah enrolled ditolak', $q$select grant_manual('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000c','x')$q$, 'already_enrolled');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p-d@t.local','{"privacy_accepted":true}');
select grant_manual('aaaaaaaa-0000-0000-0000-00000000000d','cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000c','pelajar alumni');
select pg_temp.eq('grant mencipta enrollment tanpa order', (select (order_id is null)::text from enrollments where user_id='aaaaaaaa-0000-0000-0000-00000000000d'), 'true');
select pg_temp.eq('grant direkod dalam admin_actions', (select count(*)::text from admin_actions where action='manual_grant' and reason='pelajar alumni' and actor_id='aaaaaaaa-0000-0000-0000-00000000000c'), '1');

-- 5. klien tak boleh panggil fungsi ini
set local role authenticated;
select pg_temp.fails('authenticated tak boleh apply_payment_event', $q$select apply_payment_event('Z',3,'ORD-2',14900,'MYR','{}')$q$, 'permission denied for function apply_payment_event');
select pg_temp.fails('authenticated tak boleh grant_manual', $q$select grant_manual(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'x')$q$, 'permission denied for function grant_manual');
reset role; set local role anon;
select pg_temp.fails('anon tak boleh apply_payment_event', $q$select apply_payment_event('Z',3,'ORD-2',14900,'MYR','{}')$q$, 'permission denied for function apply_payment_event');
rollback;
