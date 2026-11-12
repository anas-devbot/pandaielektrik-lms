-- Modul ketujuh admin: Staf. Hanya fungsi (security definer, panggil melalui service_role dari server action) dan jenis tindakan baharu.
-- "Padam staf" = nyahaktif: peranan dibuang (jadi 'student'); akaun TIDAK dipadam kerana admin_actions append-only dan kelulusan/penilaian merujuk pelaku.
-- Kata laluan sementara dijana dan dipaparkan oleh server action SEKALI; tidak pernah masuk DB, log atau admin_actions.
alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked','energize_cancelled','practical_result','telegram_link_set','config_changed','session_saved','phone_changed',
   'catalog_changed','staff_added','staff_role_changed','staff_deactivated'));

-- Jemput staf baharu (cipta baris staff_invites; akaun dicipta oleh server dengan kata laluan sementara, trigger handle_new_user memberi peranan).
-- Emel yang sudah berdaftar ditolak: pelajar tidak dijadikan staf secara tak sengaja (guna set_staff_role dengan pengesahan).
create function public.add_staff(p_actor uuid, p_email text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, ''))); r text;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_role is null or p_role not in ('reviewer','approver','admin') then raise exception 'bad_role'; end if;
  if length(e) > 254 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  select p.role into r from auth.users u join profiles p on p.id = u.id where lower(u.email) = e;
  if found then raise exception '%', case when r = 'student' then 'user_exists_student' else 'user_exists_staff' end; end if;
  if exists (select 1 from auth.users where lower(email) = e) then raise exception 'user_exists_student'; end if;
  insert into staff_invites (email, role) values (e, p_role) on conflict (email) do update set role = excluded.role, created_at = now();
end $$;

-- Rekod staf baharu selepas akaun berjaya dicipta (tiada kata laluan dalam rekod).
create function public.confirm_staff_added(p_actor uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  select role into r from profiles where id = p_user;
  if not found or r is distinct from p_role or r = 'student' then raise exception 'not_found'; end if;
  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, 'staff_added', 'staf baharu', jsonb_build_object('user_id', p_user, 'role', p_role));
end $$;

-- Ubah peranan staf. Pelajar menjadi staf hanya dengan p_confirm_student = true. Admin tidak boleh mengubah dirinya; admin terakhir tidak boleh diturunkan.
create function public.set_staff_role(p_actor uuid, p_target uuid, p_role text, p_confirm_student boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare old text;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_actor = p_target then raise exception 'self_change'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if p_role is null or p_role not in ('reviewer','approver','admin') then raise exception 'bad_role'; end if;
  select role into old from profiles where id = p_target for update;
  if not found then raise exception 'not_found'; end if;
  if old = 'student' and not coalesce(p_confirm_student, false) then raise exception 'student_needs_confirm'; end if;
  if old = p_role then raise exception 'no_change'; end if;
  if old = 'admin' and (select count(*) from profiles where role = 'admin') <= 1 then raise exception 'last_admin'; end if;
  update profiles set role = p_role where id = p_target;
  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, 'staff_role_changed', trim(p_reason), jsonb_build_object('user_id', p_target, 'old', old, 'new', p_role));
end $$;

-- Nyahaktif staf: buang peranan (jadi 'student'). Akaun dan rekod kekal. Server menyekat log masuk (ban) selepas ini berjaya.
create function public.deactivate_staff(p_actor uuid, p_target uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare old text;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_actor = p_target then raise exception 'self_change'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select role into old from profiles where id = p_target for update;
  if not found then raise exception 'not_found'; end if;
  if old = 'student' then raise exception 'not_staff'; end if;
  if old = 'admin' and (select count(*) from profiles where role = 'admin') <= 1 then raise exception 'last_admin'; end if;
  update profiles set role = 'student' where id = p_target;
  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, 'staff_deactivated', trim(p_reason), jsonb_build_object('user_id', p_target, 'old', old));
end $$;

do $$ declare f text; begin
  foreach f in array array['add_staff(uuid,text,text)','confirm_staff_added(uuid,uuid,text)','set_staff_role(uuid,uuid,text,boolean,text)','deactivate_staff(uuid,uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
