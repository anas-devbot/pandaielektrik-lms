-- Fasa 1b: sistem affiliate (B1). Jadual, RLS, grant, config dan jenis admin_actions baharu.
-- Berjalan MANUAL di produksi (runbook): pg_dump dahulu, kemudian psql -X -1 -v ON_ERROR_STOP=1.
-- Tiada logik komisen di sini (B3), tiada cron (B5/B6). Tulisan hanya oleh service role/RPC.
-- Semua nilai polisi dalam courses.config (CLAUDE.md #12); lajur config sedia ada tidak ditimpa.

-- 1. Config affiliate (kunci sedia ada didahulukan: "config || default" sahaja akan menimpa, jadi guna urutan terbalik)
update public.courses set config = jsonb_build_object(
    'affiliate_rate_pct', 20,
    'affiliate_cookie_days', 30,
    'commission_approve_after_days', 7,
    'payout_day_of_month', 7,
    'commission_base', 'full_price'
  ) || config
where not (config ? 'affiliate_rate_pct');

-- 2. Jenis admin_actions baharu (append-only kekal)
alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked','energize_cancelled','practical_result','telegram_link_set','config_changed','session_saved','phone_changed',
   'catalog_changed','staff_added','staff_role_changed','staff_deactivated',
   'affiliate_approved','affiliate_rejected','affiliate_suspended','affiliate_payout_paid','affiliate_adjustment'));

-- 3. affiliates: satu profil = satu affiliate
create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  code text not null check (code ~ '^[A-Za-z0-9]{4,20}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  is_test boolean not null default false,              -- akaun ujian: komisen is_test TIDAK masuk payout sebenar
  rate_pct integer not null check (rate_pct between 0 and 100),   -- snapshot semasa diluluskan
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index affiliates_code_ci on public.affiliates (lower(code));

-- 4. payouts: satu baris setiap affiliate setiap period (YYYY-MM, MYT). Dibuat oleh cron tutup bulan (B6).
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  total_sen integer not null,                          -- boleh negatif jika pelarasan melebihi komisen
  status text not null default 'due' check (status in ('due','paid')),
  paid_at timestamptz,
  payment_ref text,                                    -- rujukan transfer bank AHZ (tiada butiran bank)
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (affiliate_id, period),
  check ((status = 'paid') = (paid_at is not null))
);

-- 5. affiliate_commissions: satu komisen setiap order (UNIQUE order_id = idempotency lapisan kedua)
create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  rate_pct_snapshot integer not null check (rate_pct_snapshot between 0 and 100),
  base_amount_sen integer not null check (base_amount_sen > 0),   -- harga penuh (sen) ketika order paid
  amount_sen integer not null check (amount_sen >= 0),            -- base * rate / 100, dibundarkan ke bawah
  is_test boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed')),
  approve_after timestamptz not null,                             -- paid_at + commission_approve_after_days (snapshot)
  approved_at timestamptz,
  reversed_at timestamptz,
  payout_id uuid references public.payouts(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (status <> 'pending' or approved_at is null),
  check (status not in ('approved','paid') or approved_at is not null),
  check (status <> 'reversed' or reversed_at is not null),
  check (status <> 'paid' or payout_id is not null)
);
create index affiliate_commissions_affiliate_status on public.affiliate_commissions (affiliate_id, status);
create index affiliate_commissions_pending_due on public.affiliate_commissions (approve_after) where status = 'pending';

-- 6. affiliate_adjustments: pelarasan negatif (refund selepas payout paid). Append-only, JANGAN edit rekod lama.
create table public.affiliate_adjustments (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  commission_id uuid not null references public.affiliate_commissions(id) on delete restrict,
  amount_sen integer not null check (amount_sen < 0),
  carried_to_payout_id uuid references public.payouts(id) on delete restrict,   -- diisi bila dibawa ke payout seterusnya
  created_at timestamptz not null default now()
);
create index affiliate_adjustments_affiliate on public.affiliate_adjustments (affiliate_id) where carried_to_payout_id is null;

-- Append-only: fungsi deny_mutation sedia ada (init schema)
create trigger affiliate_adjustments_append_only before update or delete on public.affiliate_adjustments
  for each row execute function public.deny_mutation();
create trigger affiliate_commissions_no_delete before delete on public.affiliate_commissions
  for each row execute function public.deny_mutation();
create trigger payouts_no_delete before delete on public.payouts
  for each row execute function public.deny_mutation();

-- 7. RLS dan grant (corak init schema: cabut default, grant eksplisit, service_role penuh)
alter table public.affiliates enable row level security;
alter table public.payouts enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_adjustments enable row level security;

-- Cabut default Supabase (anon/authenticated dapat semua pada jadual baharu), kemudian grant eksplisit.
revoke all on public.affiliates, public.payouts, public.affiliate_commissions, public.affiliate_adjustments from anon, authenticated;
grant select, insert, update, delete on public.affiliates, public.payouts, public.affiliate_commissions, public.affiliate_adjustments to service_role;
grant select on public.affiliates, public.payouts, public.affiliate_commissions, public.affiliate_adjustments to authenticated;

-- Affiliate baca baris SENDIRI sahaja. Tiada insert/update/delete untuk klien: semua tulisan melalui server (service role).
create policy "affiliate own row" on public.affiliates for select to authenticated using (user_id = auth.uid());
create policy "affiliate own commissions" on public.affiliate_commissions for select to authenticated using (
  affiliate_id in (select id from public.affiliates where user_id = auth.uid()));
create policy "affiliate own payouts" on public.payouts for select to authenticated using (
  affiliate_id in (select id from public.affiliates where user_id = auth.uid()));
create policy "affiliate own adjustments" on public.affiliate_adjustments for select to authenticated using (
  affiliate_id in (select id from public.affiliates where user_id = auth.uid()));
-- Staf admin baca melalui adminClient() selepas requireRole (tiada policy staf: sama corak refund/payment_events).
