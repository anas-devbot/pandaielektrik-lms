-- Ujian tindakan admin affiliate (B8b): transisi status, nota wajib, kadar snapshot, bayaran payout, nilai negatif, bukan admin.
-- Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan (local sahaja): docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/affiliate_admin.sql
begin;
\set adm '''11111111-b800-0000-0000-000000000001'''
\set p1 '''22222222-b800-0000-0000-000000000002'''
\set p2 '''33333333-b800-0000-0000-000000000003'''
\set p3 '''44444444-b800-0000-0000-000000000004'''
\set buyer '''55555555-b800-0000-0000-000000000005'''

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:adm, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','adm8@test.local','{"full_name":"Admin","privacy_accepted":true,"phone":"0123456789"}'),
  (:p1,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','p1-8@test.local','{"full_name":"P1","privacy_accepted":true,"phone":"0123456789"}'),
  (:p2,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','p2-8@test.local','{"full_name":"P2","privacy_accepted":true,"phone":"0123456789"}'),
  (:p3,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3-8@test.local','{"full_name":"P3","privacy_accepted":true,"phone":"0123456789"}'),
  (:buyer,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','bu8@test.local','{"full_name":"Bu","privacy_accepted":true,"phone":"0123456789"}');
update profiles set role = 'admin' where id = :adm;
insert into courses (slug, title, price, config) values ('b8b', 'B8b Admin', 14900, '{"access_months":6,"affiliate_rate_pct":25}');

insert into affiliates (id, user_id, code, status, rate_pct) values
  ('aaaaaaaa-b800-0000-0000-00000000000a', :p1, 'ADMP1', 'pending', 20),
  ('aaaaaaaa-b800-0000-0000-00000000000b', :p2, 'ADMP2', 'pending', 20),
  ('aaaaaaaa-b800-0000-0000-00000000000c', :p3, 'ADMP3', 'approved', 20);

-- Payout P3: due, total 2980 (satu komisen approved); payout bernilai negatif untuk ujian kedua
insert into orders (id, user_id, course_id, order_number, amount, status, paid_at, terms_accepted_at, referral_code)
  select 'bbbbbbbb-b800-0000-0000-000000000001', :buyer::uuid, c.id, 'ORD-B8B-1', 14900, 'paid', now(), now(), 'ADMP3' from courses c where c.slug = 'b8b';
insert into payouts (id, affiliate_id, period, total_sen, status) values
  ('cccccccc-b800-0000-0000-000000000001', 'aaaaaaaa-b800-0000-0000-00000000000c', '2026-10', 2980, 'due'),
  ('cccccccc-b800-0000-0000-000000000002', 'aaaaaaaa-b800-0000-0000-00000000000c', '2026-09', -500, 'due');
insert into affiliate_commissions (affiliate_id, order_id, rate_pct_snapshot, base_amount_sen, amount_sen, status, approve_after, approved_at, payout_id)
  values ('aaaaaaaa-b800-0000-0000-00000000000c', 'bbbbbbbb-b800-0000-0000-000000000001', 20, 14900, 2980, 'approved', now(), now(), 'cccccccc-b800-0000-0000-000000000001');

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as
$$ begin if got <> want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if;
  raise notice 'lulus: %', label; end $$;

-- helper: laksana SQL, mesti gagal dengan mesej tertentu
create function pg_temp.fails(label text, q text, want text) returns void language plpgsql as
$$ begin execute q; raise exception 'GAGAL %: tiada ralat', label;
  exception when others then
    if sqlerrm <> want then raise exception 'GAGAL %: dapat "%", mahu "%"', label, sqlerrm, want; end if;
    raise notice 'lulus: %', label; end $$;

-- ===== Status affiliate =====
select pg_temp.expect('luluskan pending -> approved', case when affiliate_set_status(:adm::uuid, 'aaaaaaaa-b800-0000-0000-00000000000a', 'approved', null) = 'approved' then 1 else 0 end, 1);
select pg_temp.expect('kadar disalin dari config semasa diluluskan', (select rate_pct::bigint from affiliates where code = 'ADMP1'), (select (config->>'affiliate_rate_pct')::bigint from courses where config ? 'affiliate_rate_pct' order by created_at limit 1));
select pg_temp.fails('luluskan dua kali = bad_transition', format($q$select affiliate_set_status(%L, 'aaaaaaaa-b800-0000-0000-00000000000a', 'approved', null)$q$, :adm), 'bad_transition');
select pg_temp.fails('gantung tanpa nota = note_required', format($q$select affiliate_set_status(%L, 'aaaaaaaa-b800-0000-0000-00000000000a', 'suspended', '  ')$q$, :adm), 'note_required');
select pg_temp.expect('gantung dengan nota', case when affiliate_set_status(:adm::uuid, 'aaaaaaaa-b800-0000-0000-00000000000a', 'suspended', 'Maklumat palsu') = 'suspended' then 1 else 0 end, 1);
select pg_temp.expect('aktif semula suspended -> approved', case when affiliate_set_status(:adm::uuid, 'aaaaaaaa-b800-0000-0000-00000000000a', 'approved', null) = 'approved' then 1 else 0 end, 1);
select pg_temp.fails('tolak tanpa nota = note_required', format($q$select affiliate_set_status(%L, 'aaaaaaaa-b800-0000-0000-00000000000b', 'rejected', null)$q$, :adm), 'note_required');
select pg_temp.expect('tolak pending dengan nota', case when affiliate_set_status(:adm::uuid, 'aaaaaaaa-b800-0000-0000-00000000000b', 'rejected', 'Kod tidak sesuai') = 'rejected' then 1 else 0 end, 1);
select pg_temp.fails('tolak affiliate sudah approved = bad_transition', format($q$select affiliate_set_status(%L, 'aaaaaaaa-b800-0000-0000-00000000000c', 'rejected', 'x')$q$, :adm), 'bad_transition');
select pg_temp.fails('bukan admin = actor_not_admin', format($q$select affiliate_set_status(%L, 'aaaaaaaa-b800-0000-0000-00000000000b', 'approved', null)$q$, :p1), 'actor_not_admin');
select pg_temp.expect('admin_actions affiliate A: 2 luluskan (asal + aktif semula)', (select count(*) from admin_actions where action = 'affiliate_approved' and detail->>'affiliate_id' = 'aaaaaaaa-b800-0000-0000-00000000000a'), 2);
select pg_temp.expect('admin_actions affiliate A: 1 gantung', (select count(*) from admin_actions where action = 'affiliate_suspended' and detail->>'affiliate_id' = 'aaaaaaaa-b800-0000-0000-00000000000a'), 1);
select pg_temp.expect('admin_actions affiliate B: 1 tolak', (select count(*) from admin_actions where action = 'affiliate_rejected' and detail->>'affiliate_id' = 'aaaaaaaa-b800-0000-0000-00000000000b'), 1);

-- ===== Bayaran payout =====
select pg_temp.fails('tanpa rujukan = ref_required', format($q$select affiliate_mark_payout_paid(%L, 'cccccccc-b800-0000-0000-000000000001', ' ')$q$, :adm), 'ref_required');
select pg_temp.expect('tandai bayar: 1 komisen bertukar paid', affiliate_mark_payout_paid(:adm::uuid, 'cccccccc-b800-0000-0000-000000000001', 'TRF-8B-01'), 1);
select pg_temp.expect('payout kini paid dengan rujukan', (select count(*) from payouts where id = 'cccccccc-b800-0000-0000-000000000001' and status = 'paid' and payment_ref = 'TRF-8B-01' and paid_at is not null), 1);
select pg_temp.expect('komisen dalam payout kini paid', (select count(*) from affiliate_commissions where payout_id = 'cccccccc-b800-0000-0000-000000000001' and status = 'paid'), 1);
select pg_temp.fails('bayar dua kali = bad_status', format($q$select affiliate_mark_payout_paid(%L, 'cccccccc-b800-0000-0000-000000000001', 'TRF-8B-02')$q$, :adm), 'bad_status');
select pg_temp.fails('payout negatif tidak dibayar', format($q$select affiliate_mark_payout_paid(%L, 'cccccccc-b800-0000-0000-000000000002', 'TRF-8B-03')$q$, :adm), 'payout_non_positive');
select pg_temp.expect('admin_actions: 1 bayaran direkod', (select count(*) from admin_actions where action = 'affiliate_payout_paid'), 1);

select 'SEMUA ujian tindakan admin B8b lulus' as keputusan;
rollback;
