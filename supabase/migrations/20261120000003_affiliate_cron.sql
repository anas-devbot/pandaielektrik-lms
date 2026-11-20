-- Fasa 1b (B5): langkah approve harian. Komisen pending yang sudah cukup tempoh (approve_after <= masa ini)
-- bertukar kepada approved. Idempotent: hanya status 'pending' disentuh; panggilan kedua mengembalikan 0.
-- Affiliate yang tidak lagi 'approved' (suspended/rejected) TIDAK diluluskan: komisen kekal pending untuk semakan AHZ.
-- Dipanggil SERVER sahaja (service_role) oleh /api/cron/affiliate. Berjalan MANUAL di produksi (runbook).

create function public.affiliate_approve_due(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with due as (
    update affiliate_commissions c set status = 'approved', approved_at = p_now
    where c.status = 'pending'
      and c.approve_after <= p_now
      and exists (select 1 from affiliates a where a.id = c.affiliate_id and a.status = 'approved')
    returning c.id
  )
  select count(*) into n from due;
  return n;
end $$;

revoke all on function public.affiliate_approve_due(timestamptz) from public, anon, authenticated;
grant execute on function public.affiliate_approve_due(timestamptz) to service_role;
