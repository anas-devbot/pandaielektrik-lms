-- Ujian lajur bank affiliate (B8a): klien tak boleh baca ciphertext; lajur bank awam boleh. Dalam transaksi, ROLLBACK.
-- Jalankan (local sahaja): docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/affiliate_bank.sql
begin;
\set aff '''aaaaaaaa-9000-0000-0000-000000000001'''
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:aff, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','bank@test.local','{"full_name":"Bank","privacy_accepted":true,"phone":"0123456789"}');
insert into affiliates (user_id, code, status, rate_pct, bank_name, bank_account_name, bank_account_enc, bank_account_last4, bank_updated_at)
  values (:aff, 'BANKAFF', 'approved', 20, 'Maybank', 'Ali Bin Abu', 'v1:aa:bb:cc', '7890', now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-9000-0000-0000-000000000001','role','authenticated')::text, true);

do $$ begin
  begin perform bank_account_enc from affiliates; raise exception 'GAGAL: affiliate boleh baca ciphertext';
  exception when insufficient_privilege then raise notice 'lulus: ciphertext tak boleh dibaca klien'; end;
  perform bank_name, bank_account_name, bank_account_last4 from affiliates;
  raise notice 'lulus: affiliate boleh baca bank_name, nama akaun, 4 digit akhir';
  begin perform * from affiliates; raise exception 'GAGAL: select * tanpa lajur boleh (termasuk ciphertext)';
  exception when insufficient_privilege then raise notice 'lulus: select * ditolak (lajur ciphertext dihadkan)'; end;
  begin update affiliates set bank_name = 'CIMB Bank'; raise exception 'GAGAL: affiliate boleh tukar bank terus';
  exception when insufficient_privilege then raise notice 'lulus: affiliate tak boleh tulis terus ke bank'; end;
end $$;

select 'SEMUA ujian lajur bank B8a lulus' as keputusan;
rollback;
