-- Ujian tutup bulan affiliate (B6): kitaran MYT, sempadan cutoff, idempotent, pelarasan dibawa, affiliate ujian tiada payout.
-- Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan (local sahaja): docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/affiliate_tutup_bulan.sql
begin;
\set aff '''aaaaaaaa-8000-0000-0000-000000000001'''
\set ujian '''bbbbbbbb-8000-0000-0000-000000000002'''
\set b1 '''cccccccc-8000-0000-0000-000000000003'''
\set b2 '''dddddddd-8000-0000-0000-000000000004'''
\set b3 '''eeeeeeee-8000-0000-0000-000000000005'''
\set b4 '''ffffffff-8000-0000-0000-000000000006'''
\set b5 '''01010101-8000-0000-0000-000000000007'''

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:aff,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6a@test.local','{"full_name":"T6A","privacy_accepted":true,"phone":"0123456789"}'),
  (:ujian, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6u@test.local','{"full_name":"T6U","privacy_accepted":true,"phone":"0123456789"}'),
  (:b1, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6b1@test.local','{"full_name":"B1","privacy_accepted":true,"phone":"0123456789"}'),
  (:b2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6b2@test.local','{"full_name":"B2","privacy_accepted":true,"phone":"0123456789"}'),
  (:b3, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6b3@test.local','{"full_name":"B3","privacy_accepted":true,"phone":"0123456789"}'),
  (:b4, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6b4@test.local','{"full_name":"B4","privacy_accepted":true,"phone":"0123456789"}'),
  (:b5, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6b5@test.local','{"full_name":"B5","privacy_accepted":true,"phone":"0123456789"}');
insert into courses (slug, title, price, config) values ('b6', 'B6 Tutup Bulan', 14900, '{"access_months":6,"commission_approve_after_days":7}');
insert into affiliates (user_id, code, status, rate_pct, is_test) values
  (:aff, 'T6AFF', 'approved', 20, false),
  (:ujian, 'T6UJI', 'approved', 20, true);

-- Order untuk setiap komisen (satu order satu komisen)
insert into orders (user_id, course_id, order_number, amount, status, paid_at, terms_accepted_at, referral_code)
  select u, c.id, n, 14900, 'paid', now(), now(), r from courses c, (values
    (:b1::uuid, 'ORD-T6-A', 'T6AFF'), (:b2::uuid, 'ORD-T6-E', 'T6AFF'), (:b3::uuid, 'ORD-T6-B', 'T6AFF'),
    (:b4::uuid, 'ORD-T6-R', 'T6AFF'), (:b5::uuid, 'ORD-T6-U', 'T6UJI')) as v(u, n, r)
  where c.slug = 'b6';

-- Komisen approved:
--  A  : 23 Nov (dalam Nov)                 2980
--  E  : 30 Nov 23:59:59 MYT (dalam Nov)    1000
--  B  : 1 Dec 00:00:00 MYT (tepat cutoff, masuk Dec)  2980
--  U  : affiliate ujian, 10 Nov (tiada payout) 2980
--  R  : direfund (reversed) -> rujukan untuk pelarasan
insert into affiliate_commissions (affiliate_id, order_id, rate_pct_snapshot, base_amount_sen, amount_sen, is_test, status, approve_after, approved_at, reversed_at)
  select a.id, o.id, 20, 14900, v.amt, a.is_test, v.st, v.appr, v.appr, v.rev
  from orders o join affiliates a on a.code = o.referral_code
  join (values
      ('ORD-T6-A', 2980, 'approved', timestamptz '2026-11-23 15:00:00+08', null::timestamptz),
      ('ORD-T6-E', 1000, 'approved', timestamptz '2026-11-30 23:59:59+08', null::timestamptz),
      ('ORD-T6-B', 2980, 'approved', timestamptz '2026-12-01 00:00:00+08', null::timestamptz),
      ('ORD-T6-U', 2980, 'approved', timestamptz '2026-11-10 10:00:00+08', null::timestamptz),
      ('ORD-T6-R', 2980, 'reversed', timestamptz '2026-11-05 10:00:00+08', timestamptz '2026-11-06 10:00:00+08')
    ) as v(n, amt, st, appr, rev) on v.n = o.order_number;

-- Pelarasan (refund selepas payout dibayar): satu dalam Nov (20 Nov), satu dalam Dec (10 Dec)
insert into affiliate_adjustments (affiliate_id, commission_id, amount_sen, created_at)
  select a.id, c.id, -500, timestamptz '2026-11-20 12:00:00+08' from affiliates a
  join affiliate_commissions c on c.affiliate_id = a.id join orders o on o.id = c.order_id
  where a.code = 'T6AFF' and o.order_number = 'ORD-T6-R';
insert into affiliate_adjustments (affiliate_id, commission_id, amount_sen, created_at)
  select a.id, c.id, -300, timestamptz '2026-12-10 12:00:00+08' from affiliates a
  join affiliate_commissions c on c.affiliate_id = a.id join orders o on o.id = c.order_id
  where a.code = 'T6AFF' and o.order_number = 'ORD-T6-R';

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as
$$ begin if got <> want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if;
  raise notice 'lulus: %', label; end $$;

-- Run 1: 1 Dec 00:10 MYT -> tutup Nov sahaja
select pg_temp.expect('run1: periods hanya 2026-11', case when affiliate_close_elapsed(timestamptz '2026-12-01 00:10:00+08')->'periods' = '["2026-11"]'::jsonb then 1 else 0 end, 1);
select pg_temp.expect('Nov payout wujud untuk T6AFF', (select count(*) from payouts p join affiliates a on a.id = p.affiliate_id where a.code = 'T6AFF' and p.period = '2026-11' and p.status = 'due'), 1);
select pg_temp.expect('Nov total = 2980 + 1000 - 500 = 3480', (select total_sen::bigint from payouts p join affiliates a on a.id = p.affiliate_id where a.code = 'T6AFF' and p.period = '2026-11'), 3480);
select pg_temp.expect('komisen 23 Nov & 30 Nov masuk Nov', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number in ('ORD-T6-A','ORD-T6-E') and c.payout_id is not null), 2);
select pg_temp.expect('komisen tepat cutoff 1 Dec TIDAK masuk Nov', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-T6-B' and c.payout_id is null), 1);
select pg_temp.expect('pelarasan Nov dibawa ke payout Nov', (select count(*) from affiliate_adjustments where created_at = timestamptz '2026-11-20 12:00:00+08' and carried_to_payout_id is not null), 1);
select pg_temp.expect('affiliate ujian tiada payout', (select count(*) from payouts p join affiliates a on a.id = p.affiliate_id where a.code = 'T6UJI'), 0);
select pg_temp.expect('komisen ujian kekal approved tanpa payout', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-T6-U' and c.status = 'approved' and c.payout_id is null), 1);

-- Idempotent: run kedua pada masa sama tidak menambah apa-apa
select pg_temp.expect('run2: tiada period lama tertunggak (hanya 1 Dec belum dibayar, bulan semasa)', case when affiliate_close_elapsed(timestamptz '2026-12-01 00:10:00+08')->'periods' = '[]'::jsonb then 1 else 0 end, 1);
select pg_temp.expect('run2: Nov total tidak berubah', (select total_sen::bigint from payouts p join affiliates a on a.id = p.affiliate_id where a.code = 'T6AFF' and p.period = '2026-11'), 3480);
select pg_temp.expect('run2: tiada payout Nov kedua', (select count(*) from payouts where period = '2026-11'), 1);

-- Masa 5 Dec: Dec belum berlalu, tiada yang ditutup
select pg_temp.expect('5 Dec: tiada period ditutup', case when affiliate_close_elapsed(timestamptz '2026-12-05 09:00:00+08')->'periods' = '[]'::jsonb then 1 else 0 end, 1);
select pg_temp.expect('5 Dec: komisen 1 Dec masih belum dalam payout', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-T6-B' and c.payout_id is null), 1);

-- 1 Jan 2027 00:10 MYT -> tutup Dec: komisen 1 Dec + pelarasan 10 Dec
select pg_temp.expect('run3: periods 2026-12', case when affiliate_close_elapsed(timestamptz '2027-01-01 00:10:00+08')->'periods' = '["2026-12"]'::jsonb then 1 else 0 end, 1);
select pg_temp.expect('Dec total = 2980 - 300 = 2680', (select total_sen::bigint from payouts p join affiliates a on a.id = p.affiliate_id where a.code = 'T6AFF' and p.period = '2026-12'), 2680);
select pg_temp.expect('pelarasan 10 Dec dibawa ke payout Dec', (select count(*) from affiliate_adjustments where created_at = timestamptz '2026-12-10 12:00:00+08' and carried_to_payout_id is not null), 1);

-- Pelarasan yang sudah dibawa tidak boleh diubah semula (append-only)
do $$ begin
  begin update affiliate_adjustments set carried_to_payout_id = null where carried_to_payout_id is not null;
    raise exception 'GAGAL: pelarasan dibawa boleh diubah';
  exception when raise_exception then raise notice 'lulus: pelarasan dibawa tidak boleh diubah semula'; end;
  begin delete from affiliate_adjustments;
    raise exception 'GAGAL: pelarasan boleh dipadam';
  exception when raise_exception then raise notice 'lulus: pelarasan tidak boleh dipadam'; end;
end $$;

select 'SEMUA ujian tutup bulan B6 lulus' as keputusan;
rollback;
