-- Ujian langkah approve harian (B5). Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan (local sahaja): docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/affiliate_cron.sql
begin;
\set aff1 '''aaaaaaaa-7000-0000-0000-000000000001'''
\set aff2 '''bbbbbbbb-7000-0000-0000-000000000002'''
\set buyer '''cccccccc-7000-0000-0000-000000000003'''

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:aff1, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','c1@test.local','{"full_name":"C1","privacy_accepted":true,"phone":"0123456789"}'),
  (:aff2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','c2@test.local','{"full_name":"C2","privacy_accepted":true,"phone":"0123456789"}'),
  (:buyer,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','cb@test.local','{"full_name":"CB","privacy_accepted":true,"phone":"0123456789"}');
insert into courses (slug, title, price, config) values ('b5', 'B5 Cron', 14900, '{"access_months":6}');
insert into affiliates (user_id, code, status, rate_pct) values
  (:aff1, 'CRONA1', 'approved', 20),
  (:aff2, 'CRONS2', 'suspended', 20);

-- Empat order + komisen pending: 1 sudah due, 2 belum due, 3 due tetapi affiliate suspended, 4 approved sedia ada
insert into orders (user_id, course_id, order_number, amount, status, paid_at, terms_accepted_at)
  select :buyer::uuid, c.id, n, 14900, 'paid', now(), now() from courses c, (values ('ORD-B5-1'),('ORD-B5-2'),('ORD-B5-3'),('ORD-B5-4')) as v(n) where c.slug = 'b5';

insert into affiliate_commissions (affiliate_id, order_id, rate_pct_snapshot, base_amount_sen, amount_sen, status, approve_after, approved_at)
  select a.id, o.id, 20, 14900, 2980, v.st, v.aft, v.appr
  from orders o, (values
      ('ORD-B5-1', 'pending',  now() - interval '1 hour', null::timestamptz, 'CRONA1'),
      ('ORD-B5-2', 'pending',  now() + interval '6 days', null::timestamptz, 'CRONA1'),
      ('ORD-B5-3', 'pending',  now() - interval '1 hour', null::timestamptz, 'CRONS2'),
      ('ORD-B5-4', 'approved', now() - interval '2 days', now() - interval '2 days', 'CRONA1')
    ) as v(n, st, aft, appr, code)
  join affiliates a on a.code = v.code
  where o.order_number = v.n;

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as
$$ begin if got <> want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if;
  raise notice 'lulus: %', label; end $$;

-- Panggilan pertama: hanya ORD-B5-1 (due, affiliate approved) bertukar kepada approved
select pg_temp.expect('panggilan 1 meluluskan 1 komisen', affiliate_approve_due(), 1);
select pg_temp.expect('ORD-B5-1 kini approved dengan approved_at', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B5-1' and c.status = 'approved' and c.approved_at is not null), 1);
select pg_temp.expect('ORD-B5-2 belum due kekal pending', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B5-2' and c.status = 'pending'), 1);
select pg_temp.expect('ORD-B5-3 affiliate suspended kekal pending', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B5-3' and c.status = 'pending'), 1);
select pg_temp.expect('ORD-B5-4 approved sedia ada tidak disentuh', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B5-4' and c.status = 'approved' and c.approved_at < now() - interval '1 day'), 1);

-- Idempotent: panggilan kedua tidak meluluskan apa-apa
select pg_temp.expect('panggilan 2 = 0 (idempotent)', affiliate_approve_due(), 0);
select pg_temp.expect('panggilan 2 tidak ubah ORD-B5-1', (select count(*) from affiliate_commissions c join orders o on o.id = c.order_id where o.order_number = 'ORD-B5-1' and c.approved_at <= now()), 1);

-- Selepas tempoh ORD-B5-2 tamat (masa simulasi +7 hari): ia diluluskan
select pg_temp.expect('masa simulasi +7 hari: ORD-B5-2 diluluskan', affiliate_approve_due(now() + interval '7 days'), 1);

select 'SEMUA ujian approve harian B5 lulus' as keputusan;
rollback;
