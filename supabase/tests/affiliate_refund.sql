-- Ujian refund membalikkan komisen affiliate (B4). Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan (local sahaja): docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/affiliate_refund.sql
begin;
\set adm '''11111111-0000-0000-0000-000000000001'''
\set aff '''22222222-0000-0000-0000-000000000002'''
\set b1 '''33333333-0000-0000-0000-000000000003'''
\set b2 '''44444444-0000-0000-0000-000000000004'''
\set b3 '''55555555-0000-0000-0000-000000000005'''
\set b5 '''66666666-0000-0000-0000-000000000006'''

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:adm, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@test.local','{"full_name":"Admin","privacy_accepted":true,"phone":"0123456789"}'),
  (:aff, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','aff@test.local','{"full_name":"Aff","privacy_accepted":true,"phone":"0123456789"}'),
  (:b1,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b1@test.local','{"full_name":"B1","privacy_accepted":true,"phone":"0123456789"}'),
  (:b2,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b2@test.local','{"full_name":"B2","privacy_accepted":true,"phone":"0123456789"}'),
  (:b3,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b3@test.local','{"full_name":"B3","privacy_accepted":true,"phone":"0123456789"}'),
  (:b5,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b5@test.local','{"full_name":"B5","privacy_accepted":true,"phone":"0123456789"}');
update profiles set role = 'admin' where id = :adm;

insert into courses (slug, title, price, config) values
  ('b4', 'B4 Refund', 14900, '{"access_months":6,"commission_approve_after_days":7,"refund_window_days":3,"refund_progress_max_pct":10}');

insert into affiliates (user_id, code, status, rate_pct) values (:aff, 'B4AFF', 'approved', 20);

-- Dua payout: 'due' (belum dibayar, ada 2 komisen) dan 'paid' (sudah dibayar AHZ)
insert into payouts (affiliate_id, period, total_sen, status, paid_at, payment_ref)
  select id, '2026-10', 5960, 'due', null, null from affiliates where code = 'B4AFF';
insert into payouts (affiliate_id, period, total_sen, status, paid_at, payment_ref)
  select id, '2026-09', 2980, 'paid', now(), 'TRF-B4' from affiliates where code = 'B4AFF';

-- Order berbayar (dengan referral) untuk setiap kes
insert into orders (user_id, course_id, order_number, amount, status, paid_at, terms_accepted_at, referral_code)
  select u, c.id, n, 14900, 'paid', now(), now(), 'B4AFF' from courses c, (values
    (:b1::uuid, 'ORD-B4-1'), (:b2::uuid, 'ORD-B4-2'), (:b3::uuid, 'ORD-B4-3'), (:b5::uuid, 'ORD-B4-5')) as v(u, n)
  where c.slug = 'b4';

insert into enrollments (user_id, course_id, order_id, access_ends_at)
  select o.user_id, o.course_id, o.id, now() + interval '6 months' from orders o where o.order_number in ('ORD-B4-1','ORD-B4-2','ORD-B4-3');

insert into refund_requests (enrollment_id, status)
  select e.id, 'approved' from enrollments e join orders o on o.id = e.order_id where o.order_number in ('ORD-B4-1','ORD-B4-2','ORD-B4-3');

-- Komisen: 1 pending (belum dalam payout), 2 approved dalam payout due, 3 paid dalam payout paid, 5 approved dalam payout due (kekal)
insert into affiliate_commissions (affiliate_id, order_id, rate_pct_snapshot, base_amount_sen, amount_sen, status, approve_after, approved_at, payout_id)
  select a.id, o.id, 20, 14900, 2980, v.st, now(), v.appr, v.pid
  from affiliates a, orders o,
    (values ('ORD-B4-1','pending',null::timestamptz,null::uuid),
            ('ORD-B4-2','approved',now(),(select id from payouts where period='2026-10')),
            ('ORD-B4-3','paid',now(),(select id from payouts where period='2026-09')),
            ('ORD-B4-5','approved',now(),(select id from payouts where period='2026-10'))) as v(n, st, appr, pid)
  where a.code = 'B4AFF' and o.order_number = v.n;

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as
$$ begin if got <> want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if;
  raise notice 'lulus: %', label; end $$;

-- Refund 1 (pending): komisen reversed, tiada payout terlibat
select mark_refunded(:adm::uuid, (select r.id from refund_requests r join enrollments e on e.id = r.enrollment_id where e.user_id = :b1::uuid), 'TRF-REF-1');
select pg_temp.expect('pending -> reversed', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B4-1' and c.status = 'reversed' and c.reversed_at is not null), 1);
select pg_temp.expect('pending: tiada pelarasan', (select count(*) from affiliate_adjustments a join affiliate_commissions c on c.id = a.commission_id join orders o on o.id = c.order_id where o.order_number = 'ORD-B4-1'), 0);

-- Refund 2 (approved dalam payout due): reversed + total payout due dikira semula (5960 -> 2980)
select mark_refunded(:adm::uuid, (select r.id from refund_requests r join enrollments e on e.id = r.enrollment_id where e.user_id = :b2::uuid), 'TRF-REF-2');
select pg_temp.expect('due: komisen reversed', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B4-2' and c.status = 'reversed'), 1);
select pg_temp.expect('due: total payout dikira semula = 2980', (select total_sen::bigint from payouts where period = '2026-10' and affiliate_id = (select id from affiliates where code = 'B4AFF')), 2980);
select pg_temp.expect('due: komisen lain kekal approved', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B4-5' and c.status = 'approved'), 1);
select pg_temp.expect('due: tiada pelarasan', (select count(*) from affiliate_adjustments a join affiliate_commissions c on c.id = a.commission_id join orders o on o.id = c.order_id where o.order_number = 'ORD-B4-2'), 0);

-- Refund 3 (paid): reversed + pelarasan -2980 (belum dibawa), payout paid tidak berubah
select mark_refunded(:adm::uuid, (select r.id from refund_requests r join enrollments e on e.id = r.enrollment_id where e.user_id = :b3::uuid), 'TRF-REF-3');
select pg_temp.expect('paid: komisen reversed', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B4-3' and c.status = 'reversed'), 1);
select pg_temp.expect('paid: pelarasan -2980 belum dibawa', (select count(*) from affiliate_adjustments a join affiliate_commissions c on c.id = a.commission_id join orders o on o.id = c.order_id where o.order_number = 'ORD-B4-3' and a.amount_sen = -2980 and a.carried_to_payout_id is null), 1);
select pg_temp.expect('paid: payout paid tidak diubah = 2980', (select total_sen::bigint from payouts where period = '2026-09'), 2980);
select pg_temp.expect('paid: admin_actions affiliate_adjustment direkod', (select count(*) from admin_actions where action = 'affiliate_adjustment'), 1);

-- Semua order ditanda refunded; idempotent bila dipanggil semula
select pg_temp.expect('tiga order refunded', (select count(*) from orders where order_number in ('ORD-B4-1','ORD-B4-2','ORD-B4-3') and status = 'refunded'), 3);
select pg_temp.expect('panggilan semula = already_reversed', case when affiliate_reverse_commission(
  (select id from enrollments where user_id = :b1::uuid), (select id from orders where order_number = 'ORD-B4-1'), :adm::uuid, 'ulang') = 'already_reversed' then 1 else 0 end, 1);
select pg_temp.expect('panggilan semula tak tambah pelarasan', (select count(*) from affiliate_adjustments), 1);

select 'SEMUA ujian refund komisen B4 lulus' as keputusan;
rollback;
