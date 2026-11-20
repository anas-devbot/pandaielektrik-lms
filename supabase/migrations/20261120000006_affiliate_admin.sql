-- Fasa 1b (B8b): tindakan admin affiliate. Semua melalui fungsi (satu transaksi + admin_actions), bukan UPDATE terus.
-- Berjalan MANUAL di produksi (runbook): pg_dump dahulu, kemudian psql -X -1 -v ON_ERROR_STOP=1.

-- 1. Tukar status affiliate.
--    pending  -> approved  (kadar disalin dari courses.config.affiliate_rate_pct ketika diluluskan)
--    suspended-> approved  (aktifkan semula; kadar disegarkan dari config)
--    pending  -> rejected  (nota wajib)
--    approved -> suspended (nota wajib). Komisen pending tidak diluluskan semasa digantung (B5).
create function public.affiliate_set_status(p_actor uuid, p_affiliate uuid, p_to text, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare
  a public.affiliates;
  rate integer;
  act text;
  note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_to not in ('approved', 'rejected', 'suspended') then raise exception 'bad_status'; end if;
  select * into a from affiliates where id = p_affiliate for update;
  if a.id is null then raise exception 'not_found'; end if;

  if p_to = 'approved' then
    if a.status not in ('pending', 'suspended') then raise exception 'bad_transition'; end if;
    select (config->>'affiliate_rate_pct')::int into rate from courses where config ? 'affiliate_rate_pct' order by created_at limit 1;
    if rate is null then raise exception 'config_affiliate_tiada'; end if;
    update affiliates set status = 'approved', rate_pct = rate, approved_by = p_actor, approved_at = coalesce(approved_at, now()) where id = a.id;
    act := 'affiliate_approved';
  elsif p_to = 'rejected' then
    if a.status <> 'pending' then raise exception 'bad_transition'; end if;
    if note is null then raise exception 'note_required'; end if;
    update affiliates set status = 'rejected' where id = a.id;
    act := 'affiliate_rejected';
  else
    if a.status <> 'approved' then raise exception 'bad_transition'; end if;
    if note is null then raise exception 'note_required'; end if;
    update affiliates set status = 'suspended' where id = a.id;
    act := 'affiliate_suspended';
  end if;

  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, act, coalesce(note, 'Kelulusan affiliate'),
          jsonb_build_object('affiliate_id', a.id, 'from', a.status, 'to', p_to));
  return p_to;
end $$;

-- 2. Tandakan payout 'due' sudah dibayar (transfer bank oleh AHZ). Rujukan transfer wajib.
--    Komisen approved dalam payout ini bertukar kepada paid. Payout bernilai <= 0 tidak dibayar.
create function public.affiliate_mark_payout_paid(p_actor uuid, p_payout uuid, p_ref text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  p public.payouts;
  ref text := nullif(trim(coalesce(p_ref, '')), '');
  n integer;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if ref is null then raise exception 'ref_required'; end if;
  select * into p from payouts where id = p_payout for update;
  if p.id is null then raise exception 'not_found'; end if;
  if p.status <> 'due' then raise exception 'bad_status'; end if;
  if p.total_sen <= 0 then raise exception 'payout_non_positive'; end if;

  update payouts set status = 'paid', paid_at = now(), payment_ref = ref where id = p.id;
  update affiliate_commissions set status = 'paid' where payout_id = p.id and status = 'approved';
  get diagnostics n = row_count;

  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, 'affiliate_payout_paid', 'Bayaran affiliate ' || p.period,
          jsonb_build_object('payout_id', p.id, 'affiliate_id', p.affiliate_id, 'period', p.period,
                             'total_sen', p.total_sen, 'payment_ref', ref, 'commissions', n));
  return n;
end $$;

revoke all on function public.affiliate_set_status(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.affiliate_mark_payout_paid(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.affiliate_set_status(uuid,uuid,text,text) to service_role;
grant execute on function public.affiliate_mark_payout_paid(uuid,uuid,text) to service_role;
