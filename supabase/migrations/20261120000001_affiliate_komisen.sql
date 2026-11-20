-- Fasa 1b (B3): komisen dicipta HANYA oleh callback Bayarcash status 3 (paid), dalam transaksi yang sama.
-- Idempotent: apply_payment_event sudah pulang 'duplicate' untuk callback berulang; UNIQUE(order_id) ialah lapisan kedua.
-- Berjalan MANUAL di produksi (runbook): pg_dump dahulu, kemudian psql -X -1 -v ON_ERROR_STOP=1.
-- Nota: ini create or replace penuh untuk apply_payment_event (salinan 20261027020000 + blok komisen).

-- Normalisasi emel untuk self-referral. Sepadan dengan normalizeEmail() dalam src/lib/affiliate.ts (emel biasa, satu '@').
create or replace function public.affiliate_email_norm(p text) returns text
language plpgsql immutable set search_path = public as $$
declare e text := lower(trim(coalesce(p, ''))); local_part text; domain text;
begin
  if position('@' in e) < 2 then return e; end if;
  local_part := split_part(split_part(e, '@', 1), '+', 1);
  domain := split_part(e, '@', 2);
  if domain in ('gmail.com', 'googlemail.com') then
    local_part := replace(local_part, '.', '');
    domain := 'gmail.com';
  end if;
  return local_part || '@' || domain;
end $$;

create or replace function public.apply_payment_event(
  p_transaction_id text, p_status integer, p_order_number text,
  p_amount integer, p_currency text, p_raw jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  outcome text;
  ev bigint;
  months integer;
  paid_ts timestamptz := now();
  aff public.affiliates;
  buyer_email text;
  aff_email text;
  cfg_days integer;
begin
  select * into o from orders where order_number = p_order_number for update;  -- serialize callback serentak

  outcome := case
    when o.id is null then 'unknown_order'
    when p_status <> 3 then 'recorded_not_success'
    when p_amount is distinct from o.amount or p_currency is distinct from o.currency then 'amount_mismatch'
    when o.status = 'paid' then 'already_paid'
    when o.status = 'refunded' then 'ignored_refunded'
    else 'paid' end;

  insert into payment_events (order_id, transaction_id, status, order_number, amount, outcome, raw)
  values (o.id, p_transaction_id, p_status, p_order_number, p_amount, outcome, p_raw)
  on conflict (transaction_id, status) do nothing returning id into ev;
  if ev is null then return 'duplicate'; end if;   -- sudah diproses: tiada kesan kedua

  if outcome = 'paid' then
    select (c.config->>'access_months')::int into months from courses c where c.id = o.course_id;
    if months is null then raise exception 'courses.config.access_months tiada'; end if;
    update orders set status = 'paid', paid_at = paid_ts where id = o.id;
    insert into enrollments (user_id, course_id, order_id, access_ends_at)
    values (o.user_id, o.course_id, o.id, paid_ts + make_interval(months => months))   -- ASSUMPTION: akses bermula paid_at
    on conflict (user_id, course_id) do update set order_id = coalesce(enrollments.order_id, excluded.order_id);

    -- Komisen affiliate (B3). Tiada kod / affiliate tak approved (pending, rejected, suspended) = tiada komisen.
    if o.referral_code is not null then
      select * into aff from affiliates where lower(code) = lower(o.referral_code) and status = 'approved';
      if aff.id is not null then
        select email into buyer_email from auth.users where id = o.user_id;
        select email into aff_email from auth.users where id = aff.user_id;
        -- Self-referral: user_id sama ATAU emel sama selepas normalisasi (tidak dikira)
        if aff.user_id <> o.user_id and affiliate_email_norm(buyer_email) is distinct from affiliate_email_norm(aff_email) then
          select (c.config->>'commission_approve_after_days')::int into cfg_days from courses c where c.id = o.course_id;
          if cfg_days is null then raise exception 'courses.config.commission_approve_after_days tiada'; end if;
          insert into affiliate_commissions (affiliate_id, order_id, rate_pct_snapshot, base_amount_sen, amount_sen, is_test, approve_after)
          values (aff.id, o.id, aff.rate_pct, o.amount, (o.amount * aff.rate_pct) / 100, aff.is_test,
                  paid_ts + make_interval(days => cfg_days))
          on conflict (order_id) do nothing;   -- satu komisen setiap order
        end if;
      end if;
    end if;
  end if;
  return outcome;
end $$;

revoke all on function public.affiliate_email_norm(text) from public, anon, authenticated;
revoke all on function public.apply_payment_event(text,integer,text,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text,integer,text,integer,text,jsonb) to service_role;
