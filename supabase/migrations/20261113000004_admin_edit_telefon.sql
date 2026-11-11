-- Admin: tukar nombor telefon pelajar. Tindakan direkod dalam admin_actions (action 'phone_changed').
-- Nilai telefon TIDAK disimpan dalam log (detail hanya id pelajar), supaya log tak jadi salinan data peribadi.
-- Hanya service_role boleh panggil (melalui server action admin, selepas requireRole(["admin"])).

alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked','energize_cancelled','practical_result','telegram_link_set','config_changed','session_saved','phone_changed'));

create or replace function public.admin_set_phone(p_actor uuid, p_user uuid, p_phone text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_phone is null or p_phone !~ '^01[0-9]{8,9}$' then raise exception 'bad_phone'; end if;
  update profiles set phone = p_phone where id = p_user;
  if not found then raise exception 'not_found'; end if;
  select e.id into eid from enrollments e where e.user_id = p_user order by e.created_at limit 1;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'phone_changed', eid, p_reason, jsonb_build_object('target_user', p_user));
end $$;

revoke all on function public.admin_set_phone(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_phone(uuid, uuid, text, text) to service_role;
