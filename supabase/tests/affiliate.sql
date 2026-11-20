-- Ujian RLS dan kekangan jadual affiliate (B1). Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan (local sahaja): docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/affiliate.sql
begin;
\set aff1 '''aaaaaaaa-1000-0000-0000-000000000001'''
\set aff2 '''bbbbbbbb-2000-0000-0000-000000000002'''
\set buyer '''cccccccc-3000-0000-0000-000000000003'''

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:aff1, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','aff1@test.local','{"full_name":"Aff1","privacy_accepted":true,"phone":"0123456789"}'),
  (:aff2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','aff2@test.local','{"full_name":"Aff2","privacy_accepted":true,"phone":"0123456789"}'),
  (:buyer,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','buyer@test.local','{"full_name":"Pembeli","privacy_accepted":true,"phone":"0123456789"}');
insert into courses (slug,title,price,config) values ('aff','Aff',14900,'{"access_months":6}');
insert into orders (user_id,course_id,order_number,amount,status,paid_at,terms_accepted_at)
  select :buyer::uuid, c.id, 'ORD-AFF-1', 14900, 'paid', now(), now() from courses c where c.slug='aff';
insert into affiliates (user_id, code, status, rate_pct) values
  (:aff1, 'AFFSATU', 'approved', 20),
  (:aff2, 'AFFDUA',  'approved', 20);

-- komisen untuk aff1 sahaja; payout + pelarasan untuk aff1
insert into payouts (affiliate_id, period, total_sen, status, paid_at, payment_ref)
  select a.id, '2026-11', 2980, 'paid', now(), 'TRF-TEST' from affiliates a where a.code='AFFSATU';
insert into affiliate_commissions (affiliate_id, order_id, rate_pct_snapshot, base_amount_sen, amount_sen, status, approve_after, approved_at, payout_id)
  select a.id, o.id, 20, 14900, 2980, 'paid', now(), now(), p.id
  from affiliates a, orders o, payouts p where a.code='AFFSATU' and o.order_number='ORD-AFF-1' and p.affiliate_id = a.id;
insert into affiliate_adjustments (affiliate_id, commission_id, amount_sen)
  select a.id, c.id, -2980 from affiliates a join affiliate_commissions c on c.affiliate_id = a.id where a.code='AFFSATU';

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as
$$ begin if got <> want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if;
  raise notice 'lulus: %', label; end $$;

-- ===== Sebagai affiliate 1 =====
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-1000-0000-0000-000000000001','role','authenticated')::text, true);

select pg_temp.expect('aff1 nampak 1 affiliates sendiri', (select count(*) from affiliates), 1);
select pg_temp.expect('aff1 tak nampak affiliate aff2', (select count(*) from affiliates where code='AFFDUA'), 0);
select pg_temp.expect('aff1 nampak 1 komisen sendiri', (select count(*) from affiliate_commissions), 1);
select pg_temp.expect('aff1 nampak 1 payout sendiri', (select count(*) from payouts), 1);
select pg_temp.expect('aff1 nampak 1 pelarasan sendiri', (select count(*) from affiliate_adjustments), 1);

-- tulisan dilarang untuk klien (permission denied)
do $$ begin
  begin insert into affiliates (user_id, code, rate_pct) values ('cccccccc-3000-0000-0000-000000000003','HACK1', 100);
    raise exception 'GAGAL: aff1 boleh insert affiliates';
  exception when insufficient_privilege then raise notice 'lulus: aff1 tak boleh insert affiliates'; end;
  begin update affiliate_commissions set amount_sen = 999999;
    raise exception 'GAGAL: aff1 boleh update komisen';
  exception when insufficient_privilege then raise notice 'lulus: aff1 tak boleh update komisen'; end;
  begin update payouts set status = 'due';
    raise exception 'GAGAL: aff1 boleh update payout';
  exception when insufficient_privilege then raise notice 'lulus: aff1 tak boleh update payout'; end;
  begin insert into affiliate_adjustments (affiliate_id, commission_id, amount_sen) values (null, null, -1);
    raise exception 'GAGAL: aff1 boleh insert pelarasan';
  exception when insufficient_privilege then raise notice 'lulus: aff1 tak boleh insert pelarasan'; end;
end $$;

-- tiada data pembeli dalam jadual affiliate (orders/profiles tidak boleh dibaca oleh affiliate melalui jadual ini)
select pg_temp.expect('aff1 tak nampak admin_actions/payment_events (RLS staf)', (select count(*) from payment_events), 0);

-- ===== Sebagai anon =====
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin perform 1 from affiliates; raise exception 'GAGAL: anon boleh baca affiliates';
  exception when insufficient_privilege then raise notice 'lulus: anon tak boleh baca affiliates'; end;
  begin perform 1 from affiliate_commissions; raise exception 'GAGAL: anon boleh baca komisen';
  exception when insufficient_privilege then raise notice 'lulus: anon tak boleh baca komisen'; end;
end $$;

-- ===== Kekangan (sebagai superuser/postgres, bukan klien) =====
reset role;
do $$ begin
  begin insert into affiliate_commissions (affiliate_id, order_id, rate_pct_snapshot, base_amount_sen, amount_sen, approve_after)
    select a.id, o.id, 20, 14900, 2980, now() from affiliates a, orders o where a.code='AFFDUA' and o.order_number='ORD-AFF-1';
    raise exception 'GAGAL: order yang sama boleh dapat dua komisen';
  exception when unique_violation then raise notice 'lulus: satu komisen setiap order (UNIQUE order_id)'; end;
  begin insert into affiliates (user_id, code, rate_pct) values ('cccccccc-3000-0000-0000-000000000003','affsatu', 20);
    raise exception 'GAGAL: kod affiliate sama (case-insensitive) diterima';
  exception when unique_violation then raise notice 'lulus: kod affiliate unik case-insensitive'; end;
  begin insert into affiliates (user_id, code, rate_pct) values ('cccccccc-3000-0000-0000-000000000003','X', 20);
    raise exception 'GAGAL: kod terlalu pendek diterima';
  exception when check_violation then raise notice 'lulus: kod affiliate format betul'; end;
  begin insert into payouts (affiliate_id, period, total_sen, status) select id, '2026-1', 0, 'due' from affiliates where code='AFFSATU';
    raise exception 'GAGAL: period format salah diterima';
  exception when check_violation then raise notice 'lulus: period format YYYY-MM'; end;
  begin update affiliate_adjustments set amount_sen = -1;
    raise exception 'GAGAL: pelarasan boleh diedit';
  exception when raise_exception then raise notice 'lulus: pelarasan append-only'; end;
  begin delete from affiliate_commissions;
    raise exception 'GAGAL: komisen boleh dipadam';
  exception when raise_exception then raise notice 'lulus: komisen tidak boleh dipadam'; end;
  begin update affiliate_commissions set approved_at = null where status = 'paid';
    raise exception 'GAGAL: status paid tanpa approved_at diterima';
  exception when check_violation then raise notice 'lulus: status konsisten dengan tarikh'; end;
end $$;

select 'SEMUA ujian affiliate lulus' as keputusan;
rollback;
