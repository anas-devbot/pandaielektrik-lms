-- Slice 12: modul admin. Semua tindakan admin masuk admin_actions (append-only). Fungsi service_role sahaja.
-- ASSUMPTION: stuck_inactive_days (default 14) dan expiry_warning_days (default 30 dan 7) ialah polisi dari CLAUDE.md bahagian 9;
-- dibaca daripada config jika ada, jika tidak guna default tersebut (belum disahkan Saiful).

alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked','energize_cancelled','practical_result','telegram_link_set','config_changed','session_saved'));

-- Lanjut tempoh akses (polisi lanjutan belum diputuskan AHZ: tindakan manual dengan sebab wajib)
create function public.extend_access(p_actor uuid, p_enrollment uuid, p_days integer, p_reason text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare e public.enrollments; new_end timestamptz;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'bad_days'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null then raise exception 'refunded'; end if;
  new_end := greatest(e.access_ends_at, now()) + make_interval(days => p_days);
  update enrollments set access_ends_at = new_end where id = p_enrollment;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'extend_access', p_enrollment, trim(p_reason), jsonb_build_object('days', p_days, 'old_end', e.access_ends_at, 'new_end', new_end));
  return new_end;
end $$;

-- Ubah nilai polisi/teks AHZ dalam courses.config TANPA deploy. Hanya kunci dalam senarai putih, jenis dan julat disemak, nilai lama/baharu direkod.
create function public.update_course_config(p_actor uuid, p_course uuid, p_path text[], p_value jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text := array_to_string(p_path, '.'); old jsonb; lo numeric; hi numeric; kind text; n numeric;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select case k
    when 'access_months' then 'int:1:36' when 'pass_mark_mcq' then 'int:1:100' when 'max_mcq_attempts' then 'int:1:20' when 'mcq_count' then 'int:1:200'
    when 'refund_window_days' then 'int:0:30' when 'refund_progress_max_pct' then 'int:0:100' when 'refund_pdf_downloads_max' then 'int:0:1000'
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

-- Sesi kursus live (tarikh dipaparkan di landing)
create function public.upsert_session(p_actor uuid, p_id uuid, p_course uuid, p_starts timestamptz, p_ends timestamptz, p_venue text, p_capacity integer, p_status text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_status is null or p_status not in ('draft','open','full','closed') then raise exception 'bad_status'; end if;
  if p_starts is null then raise exception 'starts_required'; end if;
  if p_ends is not null and p_ends < p_starts then raise exception 'bad_dates'; end if;
  if p_capacity is not null and p_capacity < 0 then raise exception 'bad_capacity'; end if;
  if p_id is null then
    insert into course_sessions (course_id, starts_at, ends_at, venue_or_link, capacity, status) values (p_course, p_starts, p_ends, nullif(trim(coalesce(p_venue, '')), ''), p_capacity, p_status) returning id into sid;
  else
    update course_sessions set starts_at = p_starts, ends_at = p_ends, venue_or_link = nullif(trim(coalesce(p_venue, '')), ''), capacity = p_capacity, status = p_status
      where id = p_id and course_id = p_course returning id into sid;
    if sid is null then raise exception 'not_found'; end if;
  end if;
  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, 'session_saved', case when p_id is null then 'Sesi live ditambah' else 'Sesi live dikemas kini' end,
          jsonb_build_object('session_id', sid, 'starts_at', p_starts, 'status', p_status, 'capacity', p_capacity));
  return sid;
end $$;

-- Pelajar tersangkut: tiada aktiviti N hari, MCQ akhir habis had percubaan, baki akses menghampiri tamat. Hanya pendaftaran aktif.
create function public.stuck_students() returns table (enrollment_id uuid, user_id uuid, full_name text, email text, phone text,
  reason text, detail jsonb, last_activity timestamptz, access_ends_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  with base as (
    select e.id eid, e.user_id uid, e.access_ends_at ends, e.mcq_extra_attempts extra, c.config cfg,
      greatest(e.created_at,
        coalesce((select max(lp.last_heartbeat_at) from lesson_progress lp where lp.enrollment_id = e.id), e.created_at),
        coalesce((select max(greatest(qa.started_at, coalesce(qa.submitted_at, qa.started_at))) from quiz_attempts qa where qa.enrollment_id = e.id), e.created_at),
        coalesce((select max(s.created_at) from submissions s where s.enrollment_id = e.id), e.created_at)) last_act
    from enrollments e join courses c on c.id = e.course_id
    where e.refunded_at is null and e.access_ends_at > now() and e.stage <> 'completed'
  ), reasons as (
    select eid, uid, ends, last_act, 'tiada_aktiviti'::text reason,
           jsonb_build_object('days', floor(extract(epoch from (now() - last_act)) / 86400)::int) detail
      from base where last_act < now() - make_interval(days => coalesce((cfg->>'stuck_inactive_days')::int, 14))
    union all
    select eid, uid, ends, last_act, 'mcq_had_habis',
           jsonb_build_object('attempts', (select count(*) from quiz_attempts q where q.enrollment_id = base.eid and q.type = 'final' and q.submitted_at is not null),
                              'limit', (cfg->>'max_mcq_attempts')::int + extra)
      from base
      where not exists (select 1 from quiz_attempts q where q.enrollment_id = base.eid and q.type = 'final' and q.passed)
        and (select count(*) from quiz_attempts q where q.enrollment_id = base.eid and q.type = 'final' and q.submitted_at is not null) >= coalesce((cfg->>'max_mcq_attempts')::int, 3) + extra
    union all
    select eid, uid, ends, last_act, 'akses_7', jsonb_build_object('days_left', ceil(extract(epoch from (ends - now())) / 86400)::int)
      from base where ends <= now() + make_interval(days => coalesce((cfg->'expiry_warning_days'->>1)::int, 7))
    union all
    select eid, uid, ends, last_act, 'akses_30', jsonb_build_object('days_left', ceil(extract(epoch from (ends - now())) / 86400)::int)
      from base where ends <= now() + make_interval(days => coalesce((cfg->'expiry_warning_days'->>0)::int, 30))
        and ends > now() + make_interval(days => coalesce((cfg->'expiry_warning_days'->>1)::int, 7))
  )
  select r.eid, r.uid, p.full_name, u.email::text, p.phone, r.reason, r.detail, r.last_act, r.ends
  from reasons r join profiles p on p.id = r.uid join auth.users u on u.id = r.uid
  order by r.reason, r.last_act
$$;

do $$ declare f text; begin
  foreach f in array array['extend_access(uuid,uuid,integer,text)','update_course_config(uuid,uuid,text[],jsonb,text)',
      'upsert_session(uuid,uuid,uuid,timestamptz,timestamptz,text,integer,text)','stuck_students()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
