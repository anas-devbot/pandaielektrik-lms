-- Fasa 1b (B8a): butiran bank affiliate untuk bayaran (keputusan Bos: affiliate & admin mesti nampak bank penerima).
-- Nama bank dan nama pemegang akaun: teks biasa (dipapar kepada affiliate dan admin).
-- Nombor akaun: DIENKRIP di server (AES-256-GCM, kunci AFFILIATE_BANK_KEY dalam env, bukan dalam DB).
-- Klien (authenticated) TIDAK boleh baca ciphertext; hanya 4 digit akhir. Admin baca melalui adminClient() selepas requireRole.
-- Berjalan MANUAL di produksi (runbook): pg_dump dahulu, kemudian psql -X -1 -v ON_ERROR_STOP=1.

alter table public.affiliates
  add column bank_name text,
  add column bank_account_name text,
  add column bank_account_enc text,              -- ciphertext sahaja: v1:<iv>:<tag>:<data> (base64)
  add column bank_account_last4 text check (bank_account_last4 ~ '^\d{4}$'),
  add column bank_updated_at timestamptz;
alter table public.affiliates add constraint affiliates_bank_consistent check (
  (bank_account_enc is null) = (bank_name is null and bank_account_name is null and bank_account_last4 is null and bank_updated_at is null)
  or (bank_account_enc is not null and bank_name is not null and bank_account_name is not null and bank_account_last4 is not null and bank_updated_at is not null));

-- Affiliate baca lajur bank (kecuali ciphertext) dan lajur sendiri sahaja (policy "affiliate own row" sedia ada).
revoke select on public.affiliates from authenticated;
grant select (id, user_id, code, status, is_test, rate_pct, approved_by, approved_at, created_at,
              bank_name, bank_account_name, bank_account_last4, bank_updated_at) on public.affiliates to authenticated;

-- Jenis log baharu: kemas kini bank direkod TANPA nilai (nombor akaun tidak masuk admin_actions)
alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked','energize_cancelled','practical_result','telegram_link_set','config_changed','session_saved','phone_changed',
   'catalog_changed','staff_added','staff_role_changed','staff_deactivated',
   'affiliate_approved','affiliate_rejected','affiliate_suspended','affiliate_payout_paid','affiliate_adjustment','affiliate_bank_changed'));
