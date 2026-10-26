-- Slice 4 (bahagian DB): pemprosesan bayaran idempotent + grant manual.
-- apply_payment_event dipanggil SERVER sahaja (service_role) SELEPAS checksum callback disahkan.
-- State machine order: pending -> paid, tidak berundur. Callback berulang = satu kesan.
-- ASSUMPTION: unique (transaction_id, status) belum disahkan dengan callback sebenar (ujian live RM2).

alter table public.orders add column terms_version text;

create function public.apply_payment_event(
  p_transaction_id text, p_status integer, p_order_number text,
  p_amount integer, p_currency text, p_raw jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  outcome text;
  ev bigint;
  months integer;
  paid_ts timestamptz := now();
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
  end if;
  return outcome;
end $$;

create function public.grant_manual(p_user uuid, p_course uuid, p_actor uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare months integer; eid uuid;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  select (config->>'access_months')::int into months from courses where id = p_course;
  if months is null then raise exception 'courses.config.access_months tiada'; end if;
  if exists (select 1 from enrollments where user_id = p_user and course_id = p_course) then raise exception 'already_enrolled'; end if;
  insert into enrollments (user_id, course_id, access_ends_at)
  values (p_user, p_course, now() + make_interval(months => months)) returning id into eid;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'manual_grant', eid, p_reason, jsonb_build_object('user_id', p_user, 'course_id', p_course));
  return eid;
end $$;

revoke all on function public.apply_payment_event(text,integer,text,integer,text,jsonb) from public, anon, authenticated;
revoke all on function public.grant_manual(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text,integer,text,integer,text,jsonb) to service_role;
grant execute on function public.grant_manual(uuid,uuid,uuid,text) to service_role;
