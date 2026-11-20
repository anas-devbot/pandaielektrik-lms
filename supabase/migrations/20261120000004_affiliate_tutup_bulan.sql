-- Fasa 1b (B6): tutup bulan. Komisen approved (belum dalam payout) dan pelarasan belum dibawa,
-- yang masuk sebelum cutoff (00:00 hari 1 bulan berikut, MYT), dimasukkan ke payout 'due' period YYYY-MM.
-- Idempotent: komisen/pelarasan yang sudah ada payout tidak disentuh semula; panggilan kedua tidak menambah apa-apa.
-- Affiliate is_test TIDAK dibayar (keputusan B1/spec): komisen ujian kekal approved tanpa payout.
-- Berjalan MANUAL di produksi (runbook): pg_dump dahulu, kemudian psql -X -1 -v ON_ERROR_STOP=1.

-- 1. Pelarasan: kekal append-only, tetapi SATU kemas kini dibenarkan: menanda carried_to_payout_id (sekali sahaja).
create or replace function public.affiliate_adjustments_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'append_only'; end if;
  if old.carried_to_payout_id is not null
     or new.id is distinct from old.id or new.affiliate_id is distinct from old.affiliate_id
     or new.commission_id is distinct from old.commission_id or new.amount_sen is distinct from old.amount_sen
     or new.created_at is distinct from old.created_at or new.carried_to_payout_id is null then
    raise exception 'append_only';
  end if;
  return new;
end $$;

drop trigger affiliate_adjustments_append_only on public.affiliate_adjustments;
create trigger affiliate_adjustments_append_only before update or delete on public.affiliate_adjustments
  for each row execute function public.affiliate_adjustments_guard();

-- 2. Tutup satu period. Cutoff = 00:00 MYT hari 1 bulan berikut (sempadan tepat TIDAK termasuk).
create or replace function public.affiliate_close_period(p_period text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cutoff timestamptz := (((p_period || '-01')::date + interval '1 month')::timestamp) at time zone 'Asia/Kuala_Lumpur';
  aff record;
  p public.payouts;
  touched integer := 0;
begin
  for aff in
    select af.id from affiliates af
    where af.is_test = false and (
      exists (select 1 from affiliate_commissions c where c.affiliate_id = af.id and c.status = 'approved' and c.payout_id is null and c.approved_at < cutoff)
      or exists (select 1 from affiliate_adjustments a where a.affiliate_id = af.id and a.carried_to_payout_id is null and a.created_at < cutoff))
  loop
    select * into p from payouts where affiliate_id = aff.id and period = p_period for update;
    if p.id is null then
      insert into payouts (affiliate_id, period, total_sen, status) values (aff.id, p_period, 0, 'due') returning * into p;
    end if;
    if p.status = 'paid' then continue; end if;   -- tidak pernah berlaku (tutup sekali sahaja), tetapi jangan ubah payout yang sudah dibayar
    update affiliate_commissions set payout_id = p.id
      where affiliate_id = aff.id and status = 'approved' and payout_id is null and approved_at < cutoff;
    update affiliate_adjustments set carried_to_payout_id = p.id
      where affiliate_id = aff.id and carried_to_payout_id is null and created_at < cutoff;
    update payouts set total_sen = (
        select coalesce(sum(amount_sen), 0) from affiliate_commissions where payout_id = p.id and status in ('approved', 'paid'))
      + (select coalesce(sum(amount_sen), 0) from affiliate_adjustments where carried_to_payout_id = p.id)
      where id = p.id;
    touched := touched + 1;
  end loop;
  return touched;
end $$;

-- 3. Tutup semua period yang sudah berlalu dan belum ditutup (dari yang paling awal hingga bulan lepas, MYT).
create or replace function public.affiliate_close_elapsed(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cur_m date := date_trunc('month', p_now at time zone 'Asia/Kuala_Lumpur')::date;
  oldest timestamptz;
  m date;
  periods text[] := '{}';
begin
  -- affiliate ujian tidak dibayar: abaikan dalam pengiraan permulaan supaya tidak mengimbas period lama setiap hari
  select least(
    (select min(c.approved_at) from affiliate_commissions c join affiliates a on a.id = c.affiliate_id
       where a.is_test = false and c.status = 'approved' and c.payout_id is null),
    (select min(j.created_at) from affiliate_adjustments j join affiliates a on a.id = j.affiliate_id
       where a.is_test = false and j.carried_to_payout_id is null)) into oldest;
  if oldest is null then return jsonb_build_object('periods', '[]'::jsonb); end if;
  m := date_trunc('month', oldest at time zone 'Asia/Kuala_Lumpur')::date;
  while m < cur_m loop
    perform affiliate_close_period(to_char(m, 'YYYY-MM'));
    periods := array_append(periods, to_char(m, 'YYYY-MM'));
    m := (m + interval '1 month')::date;
  end loop;
  return jsonb_build_object('periods', to_jsonb(periods));
end $$;

revoke all on function public.affiliate_adjustments_guard() from public, anon, authenticated;
revoke all on function public.affiliate_close_period(text) from public, anon, authenticated;
revoke all on function public.affiliate_close_elapsed(timestamptz) from public, anon, authenticated;
grant execute on function public.affiliate_close_elapsed(timestamptz) to service_role;
