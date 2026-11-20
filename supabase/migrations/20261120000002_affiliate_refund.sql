-- Fasa 1b (B4): refund membalikkan komisen affiliate (refund penuh, keputusan Bos).
-- Tiga kes, semua dalam transaksi mark_refunded yang sama:
--   1. pending / approved, belum dalam payout  -> reversed
--   2. approved dalam payout status 'due'        -> reversed + total payout dikira semula
--   3. paid (sudah dibayar AHZ)                  -> reversed + pelarasan negatif (dibawa ke payout seterusnya)
-- Idempotent: komisen yang sudah reversed tidak diproses semula. mark_refunded hanya berjalan sekali (status approved).
-- Berjalan MANUAL di produksi (runbook): pg_dump dahulu, kemudian psql -X -1 -v ON_ERROR_STOP=1.

create function public.affiliate_reverse_commission(p_enrollment uuid, p_order uuid, p_actor uuid, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare
  c public.affiliate_commissions;
  p public.payouts;
  new_total integer;
begin
  select * into c from affiliate_commissions where order_id = p_order for update;
  if c.id is null then return 'none'; end if;
  if c.status = 'reversed' then return 'already_reversed'; end if;

  if c.payout_id is not null then
    select * into p from payouts where id = c.payout_id for update;
  end if;

  if c.status = 'paid' or p.status = 'paid' then                       -- kes 3: sudah dibayar, guna pelarasan
    update affiliate_commissions set status = 'reversed', reversed_at = now() where id = c.id;
    insert into affiliate_adjustments (affiliate_id, commission_id, amount_sen) values (c.affiliate_id, c.id, -c.amount_sen);
    insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
    values (p_actor, 'affiliate_adjustment', p_enrollment, coalesce(nullif(trim(p_note), ''), 'Refund selepas payout dibayar'),
            jsonb_build_object('commission_id', c.id, 'amount_sen', -c.amount_sen));
    return 'adjustment';
  end if;

  update affiliate_commissions set status = 'reversed', reversed_at = now() where id = c.id;
  if p.id is not null then                                              -- kes 2: payout 'due' belum dibayar, kira semula
    select coalesce(sum(amount_sen), 0) into new_total from affiliate_commissions
      where payout_id = p.id and status in ('approved', 'paid');
    select new_total + coalesce(sum(amount_sen), 0) into new_total from affiliate_adjustments
      where carried_to_payout_id = p.id;
    update payouts set total_sen = new_total where id = p.id;
    return 'payout_recomputed';
  end if;
  return 'reversed';                                                    -- kes 1: belum dalam mana-mana payout
end $$;

-- mark_refunded: salinan 20261027110000_refund.sql + satu panggilan pembalikan komisen.
create or replace function public.mark_refunded(p_actor uuid, p_request uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.refund_requests; e public.enrollments; certs uuid[];
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;      -- rujukan refund Bayarcash
  select * into r from refund_requests where id = p_request for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status <> 'approved' then raise exception 'bad_status'; end if;
  select * into e from enrollments where id = r.enrollment_id for update;
  update refund_requests set status = 'refunded', refunded_at = now(), refund_note = trim(p_note) where id = r.id;
  update enrollments set refunded_at = now() where id = e.id;                           -- akses video/PDF/kuiz/penghantaran ditutup di semua tempat
  update orders set status = 'refunded' where id = e.order_id;
  perform affiliate_reverse_commission(e.id, e.order_id, p_actor, trim(p_note));         -- komisen affiliate (B4)
  select coalesce(array_agg(id), '{}') into certs from certificates where enrollment_id = e.id and revoked_at is null;
  update certificates set revoked_at = now() where enrollment_id = e.id and revoked_at is null;   -- sijil dibatalkan
  perform cancel_energize(e.id, p_actor, 'Refund: kebenaran bekalan ditamatkan');
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'refund', e.id, trim(p_note), jsonb_build_object('request_id', r.id, 'executed', true, 'revoked_certificates', to_jsonb(certs)));
  return jsonb_build_object('revoked_certificates', cardinality(certs));
end $$;

revoke all on function public.affiliate_reverse_commission(uuid,uuid,uuid,text) from public, anon, authenticated;
