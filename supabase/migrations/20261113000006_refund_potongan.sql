-- Potongan kos pemprosesan refund (sen) sebagai kunci config yang boleh diubah admin tanpa deploy (keputusan Bos, 13 Nov 2026: RM5 = 500 sen).
-- Menggantikan update_course_config dengan satu kunci tambahan sahaja ('refund_deduction_sen'); kebenaran fungsi tidak berubah (CREATE OR REPLACE).
-- Nilai awal 500 hanya ditetapkan jika kunci belum wujud. Berjalan selamat pada DB kosong (tiada baris courses = tiada kesan).
create or replace function public.update_course_config(p_actor uuid, p_course uuid, p_path text[], p_value jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text := array_to_string(p_path, '.'); old jsonb; lo numeric; hi numeric; kind text; n numeric;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select case k
    when 'access_months' then 'int:1:36' when 'pass_mark_mcq' then 'int:1:100' when 'max_mcq_attempts' then 'int:1:20' when 'mcq_count' then 'int:1:200'
    when 'refund_window_days' then 'int:0:30' when 'refund_progress_max_pct' then 'int:0:100' when 'refund_pdf_downloads_max' then 'int:0:1000'
    when 'refund_deduction_sen' then 'int:0:1000000'
    when 'sla_business_days' then 'int:1:60' when 'claim_expiry_days' then 'int:1:30' when 'telegram_member_delete_days' then 'int:1:365' when 'stuck_inactive_days' then 'int:1:90'
    when 'video_complete_pct' then 'num:0.5:1' when 'schematic_max_mb' then 'num:1:11' when 'video_max_rate' then 'num:1:4' when 'video_heartbeat_max_gap_sec' then 'num:5:60'
    when 'certificate.wording_approved' then 'bool' when 'refund_letter.approved' then 'bool'
    when 'identity_check_enabled.theory' then 'bool' when 'identity_check_enabled.theory_practical' then 'bool'
    when 'energize_guidance_text' then 'text' when 'energize_waiting_notice' then 'text' when 'telegram_privacy_notice' then 'text'
    when 'practical_task_text' then 'text' when 'subjective_prompt' then 'text' when 'schematic_prompt' then 'text'
  end into kind;
  if kind is null then raise exception 'key_not_allowed'; end if;
  if kind = 'bool' then
    if jsonb_typeof(p_value) <> 'boolean' then raise exception 'bad_value'; end if;
  elsif kind = 'text' then
    if jsonb_typeof(p_value) <> 'string' or length(p_value #>> '{}') > 4000 then raise exception 'bad_value'; end if;
  else
    if jsonb_typeof(p_value) <> 'number' then raise exception 'bad_value'; end if;
    n := (p_value #>> '{}')::numeric; lo := split_part(kind, ':', 2)::numeric; hi := split_part(kind, ':', 3)::numeric;
    if n < lo or n > hi or (split_part(kind, ':', 1) = 'int' and n <> trunc(n)) then raise exception 'out_of_range'; end if;
  end if;
  select config #> p_path into old from courses where id = p_course for update;
  if not found then raise exception 'no_course'; end if;
  -- kunci bersarang: cipta objek induk jika belum ada (jsonb_set tidak mencipta induk)
  if array_length(p_path, 1) > 1 then
    update courses set config = jsonb_set(config, array[p_path[1]], coalesce(config -> p_path[1], '{}'::jsonb), true) where id = p_course;
  end if;
  update courses set config = jsonb_set(config, p_path, p_value, true) where id = p_course;
  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, 'config_changed', trim(p_reason), jsonb_build_object('course_id', p_course, 'key', k, 'old', old, 'new', p_value));
  return jsonb_build_object('key', k, 'old', old, 'new', p_value);
end $$;

update public.courses set config = jsonb_set(config, '{refund_deduction_sen}', '500'::jsonb, true) where not (config ? 'refund_deduction_sen');
