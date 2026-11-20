-- Ujian komisen dalam callback paid (B3). Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan (local sahaja): docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/affiliate_komisen.sql
begin;
\set aff1 '''aaaaaaaa-1000-0000-0000-000000000001'''
\set aff2 '''bbbbbbbb-2000-0000-0000-000000000002'''
\set aff3 '''dddddddd-4000-0000-0000-000000000004'''
\set aff4 '''eeeeeeee-5000-0000-0000-000000000005'''
\set buyer '''cccccccc-3000-0000-0000-000000000003'''
\set buyer2 '''ffffffff-6000-0000-0000-000000000006'''

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:aff1, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','aff1@test.local','{"full_name":"Aff1","privacy_accepted":true,"phone":"0123456789"}'),
  (:aff2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','aff2@test.local','{"full_name":"Aff2","privacy_accepted":true,"phone":"0123456789"}'),
  (:aff3, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','uji@test.local','{"full_name":"Aff3 Uji","privacy_accepted":true,"phone":"0123456789"}'),
  (:aff4, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','penjual@gmail.com','{"full_name":"Aff4","privacy_accepted":true,"phone":"0123456789"}'),
  (:buyer,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','buyer@test.local','{"full_name":"Pembeli","privacy_accepted":true,"phone":"0123456789"}'),
  (:buyer2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','pen.jual+beli@googlemail.com','{"full_name":"Pembeli 2","privacy_accepted":true,"phone":"0123456789"}');

insert into courses (slug, title, price, config) values
  ('b3', 'B3 Komisen', 14900, '{"access_months":6,"commission_approve_after_days":7}');

insert into affiliates (user_id, code, status, rate_pct, is_test) values
  (:aff1, 'AFFSATU', 'approved', 20, false),
  (:aff2, 'AFFSUS',  'suspended', 20, false),
  (:aff3, 'AFFUJI',  'approved', 20, true),
  (:aff4, 'AFFEMEL', 'approved', 20, false);

-- Order (pending) untuk setiap kes. Semua RM149 (14900 sen).
insert into orders (user_id, course_id, order_number, amount, status, terms_accepted_at, referral_code)
select u, c.id, n, 14900, 'pending', now(), r
from courses c, (values
  (:buyer::uuid,  'ORD-B3-1', 'AFFSATU'),   -- kes utama
  (:buyer::uuid,  'ORD-B3-2', null),       -- tiada referral
  (:buyer::uuid,  'ORD-B3-3', 'AFFSUS'),   -- affiliate suspended
  (:aff1::uuid,   'ORD-B3-4', 'AFFSATU'),  -- self-referral (user_id sama)
  (:buyer2::uuid, 'ORD-B3-5', 'AFFEMEL'),  -- self-referral (emel sama selepas normalisasi)
  (:buyer::uuid,  'ORD-B3-6', 'AFFUJI'),   -- akaun ujian: is_test
  (:buyer::uuid,  'ORD-B3-7', 'affsatu'),  -- kod huruf kecil, mesti sepadan (case-insensitive)
  (:buyer::uuid,  'ORD-B3-8', 'AFFSATU'),  -- status 1: tiada bayaran berjaya
  (:buyer::uuid,  'ORD-B3-9', 'AFFSATU')   -- amaun tidak sepadan
) as v(u, n, r)
where c.slug = 'b3';

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as
$$ begin if got <> want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if;
  raise notice 'lulus: %', label; end $$;

-- 1) Callback 3 kali untuk satu order = satu komisen sahaja
select pg_temp.expect('callback #1 paid', case when apply_payment_event('B3-T1',3,'ORD-B3-1',14900,'MYR','{}') = 'paid' then 1 else 0 end, 1);
select pg_temp.expect('callback #2 duplicate', case when apply_payment_event('B3-T1',3,'ORD-B3-1',14900,'MYR','{}') = 'duplicate' then 1 else 0 end, 1);
select pg_temp.expect('callback #3 transaksi lain status 3 = already_paid', case when apply_payment_event('B3-T2',3,'ORD-B3-1',14900,'MYR','{}') = 'already_paid' then 1 else 0 end, 1);
select pg_temp.expect('tepat satu komisen untuk ORD-B3-1', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-1'), 1);
select pg_temp.expect('komisen = 20% daripada 14900 = 2980 sen', (select amount_sen::bigint from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-1'), 2980);
select pg_temp.expect('komisen pending, bukan is_test', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-1' and c.status = 'pending' and c.is_test = false), 1);
select pg_temp.expect('approve_after = paid_at + 7 hari', (select case when c.approve_after = o.paid_at + interval '7 days' then 1 else 0 end from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-1'), 1);
select pg_temp.expect('kadar snapshot ikut affiliate', (select rate_pct_snapshot::bigint from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-1'), 20);

-- 2) Tiada kod referral = tiada komisen
select pg_temp.expect('paid tanpa referral: callback paid', case when apply_payment_event('B3-T3',3,'ORD-B3-2',14900,'MYR','{}') = 'paid' then 1 else 0 end, 1);
select pg_temp.expect('tanpa referral: tiada komisen', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-2'), 0);

-- 3) Affiliate suspended = tiada komisen (order tetap paid)
select pg_temp.expect('suspended: callback paid', case when apply_payment_event('B3-T4',3,'ORD-B3-3',14900,'MYR','{}') = 'paid' then 1 else 0 end, 1);
select pg_temp.expect('suspended: tiada komisen', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-3'), 0);

-- 4) Self-referral (user_id sama) = tiada komisen
select pg_temp.expect('self user_id: callback paid', case when apply_payment_event('B3-T5',3,'ORD-B3-4',14900,'MYR','{}') = 'paid' then 1 else 0 end, 1);
select pg_temp.expect('self user_id: tiada komisen', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-4'), 0);

-- 5) Self-referral (emel sama selepas normalisasi gmail) = tiada komisen
select pg_temp.expect('self emel: callback paid', case when apply_payment_event('B3-T6',3,'ORD-B3-5',14900,'MYR','{}') = 'paid' then 1 else 0 end, 1);
select pg_temp.expect('self emel: tiada komisen', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-5'), 0);

-- 6) Akaun ujian: komisen dicipta, ditanda is_test
select pg_temp.expect('is_test: callback paid', case when apply_payment_event('B3-T7',3,'ORD-B3-6',14900,'MYR','{}') = 'paid' then 1 else 0 end, 1);
select pg_temp.expect('is_test: komisen is_test = true', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-6' and c.is_test = true), 1);

-- 7) Kod huruf kecil sepadan dengan affiliate yang sama
select pg_temp.expect('case-insensitive: callback paid', case when apply_payment_event('B3-T8',3,'ORD-B3-7',14900,'MYR','{}') = 'paid' then 1 else 0 end, 1);
select pg_temp.expect('case-insensitive: komisen untuk aff1', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id join affiliates a on a.id = c.affiliate_id where o.order_number = 'ORD-B3-7' and a.code = 'AFFSATU'), 1);

-- 8) Status bukan berjaya / amaun tidak sepadan = tiada komisen
select pg_temp.expect('status 1: recorded_not_success', case when apply_payment_event('B3-T9',1,'ORD-B3-8',14900,'MYR','{}') = 'recorded_not_success' then 1 else 0 end, 1);
select pg_temp.expect('status 1: tiada komisen', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-8'), 0);
select pg_temp.expect('amaun salah: amount_mismatch', case when apply_payment_event('B3-T10',3,'ORD-B3-9',9999,'MYR','{}') = 'amount_mismatch' then 1 else 0 end, 1);
select pg_temp.expect('amaun salah: tiada komisen', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B3-9'), 0);

-- 9) Jumlah keseluruhan: tepat 3 komisen (ORD-B3-1, ORD-B3-6, ORD-B3-7)
select pg_temp.expect('jumlah komisen kes ini = 3', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number like 'ORD-B3-%'), 3);

select 'SEMUA ujian komisen B3 lulus' as keputusan;
rollback;
