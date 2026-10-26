-- Slice 7: (1) tambah percubaan MCQ oleh admin, (2) penghantaran subjektif + skematik, tuntut tugasan, semakan,
-- laluan manual fasilitator. Semua fungsi service_role sahaja; klien baca baris sendiri melalui RLS sedia ada.

alter table public.enrollments add column mcq_extra_attempts integer not null default 0 check (mcq_extra_attempts >= 0);
alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts'));

-- start_quiz: had = max_mcq_attempts (config) + mcq_extra_attempts (diberi admin)
create or replace function public.start_quiz(p_enrollment uuid, p_type text, p_chapter uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments; cfg jsonb; cnt integer; maxatt integer; att uuid; n integer; ids uuid[];
  cs uuid[]; av integer[]; qa integer[]; remaining integer; progressed boolean; i integer;
begin
  select * into e from enrollments where id = p_enrollment;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null or e.access_ends_at <= now() then raise exception 'access_closed'; end if;
  if p_type not in ('practice','final') then raise exception 'bad_type'; end if;
  select config into cfg from courses where id = e.course_id;

  -- satu percubaan terbuka pada satu masa: sambung yang sedia ada (soalan sama)
  select id into att from quiz_attempts
    where enrollment_id = p_enrollment and type = p_type and submitted_at is null
      and (p_type = 'final' or question_ids <@ array(select id from quiz_questions where chapter_id = p_chapter and type = 'practice'))
    order by started_at desc limit 1;
  if att is not null then return att; end if;

  if p_type = 'practice' then
    if p_chapter is null then raise exception 'chapter_required'; end if;
    select array_agg(id) into ids from quiz_questions where course_id = e.course_id and chapter_id = p_chapter and type = 'practice';
    if ids is null then raise exception 'no_questions'; end if;
  else
    cnt := (cfg->>'mcq_count')::int; maxatt := (cfg->>'max_mcq_attempts')::int;
    if cnt is null or maxatt is null or (cfg->>'pass_mark_mcq') is null then raise exception 'config_mcq_tiada'; end if;
    if not (final_gate(p_enrollment)->>'open')::boolean then raise exception 'gate_closed'; end if;
    if exists (select 1 from quiz_attempts where enrollment_id = p_enrollment and type = 'final' and passed) then raise exception 'already_passed'; end if;
    select count(*) into n from quiz_attempts where enrollment_id = p_enrollment and type = 'final' and submitted_at is not null;
    if n >= maxatt + e.mcq_extra_attempts then raise exception 'attempts_exhausted'; end if;

    -- agihan seimbang ikut bab: bulat-bulat 1 soalan setiap bab sehingga cukup, bab yang kurang soalan beri baki kepada yang lain
    select array_agg(chapter_id), array_agg(c) into cs, av from (
      select chapter_id, count(*)::int c from quiz_questions where course_id = e.course_id and type = 'final' group by chapter_id order by random()) x;
    if cs is null or (select sum(a) from unnest(av) a) < cnt then raise exception 'bank_too_small'; end if;
    qa := array_fill(0, array[array_length(cs, 1)]); remaining := cnt;
    while remaining > 0 loop
      progressed := false;
      for i in 1..array_length(cs, 1) loop
        if remaining > 0 and qa[i] < av[i] then qa[i] := qa[i] + 1; remaining := remaining - 1; progressed := true; end if;
      end loop;
      exit when not progressed;
    end loop;
    -- elak soalan yang sudah dilihat dalam percubaan terdahulu (utamakan yang belum), rawak dalam bab
    select array_agg(qid) into ids from (
      select picked.id as qid from unnest(cs, qa) as w(ch, quota)
      cross join lateral (
        select q.id from quiz_questions q
        where q.course_id = e.course_id and q.type = 'final' and q.chapter_id = w.ch
        order by (q.id = any(coalesce((select array_agg(x) from quiz_attempts a, unnest(a.question_ids) x
                                        where a.enrollment_id = p_enrollment and a.type = 'final'), '{}'::uuid[]))) , random()
        limit w.quota) picked
    ) s;
    update enrollments set stage = 'final_mcq' where id = p_enrollment and stage in ('enrolled','learning');
  end if;

  select coalesce(max(attempt_no), 0) + 1 into n from quiz_attempts where enrollment_id = p_enrollment and type = p_type;
  insert into quiz_attempts (enrollment_id, type, attempt_no, question_ids) values (p_enrollment, p_type, n, ids) returning id into att;
  return att;
end $$;


create function public.grant_extra_attempts(p_actor uuid, p_enrollment uuid, p_count integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if p_count is null or p_count < 1 then raise exception 'bad_count'; end if;
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  update enrollments set mcq_extra_attempts = mcq_extra_attempts + p_count where id = p_enrollment returning mcq_extra_attempts into total;
  if total is null then raise exception 'no_enrollment'; end if;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'extra_attempts', p_enrollment, p_reason, jsonb_build_object('added', p_count, 'extra_total', total));
  return total;
end $$;

-- Bahagian 2 lulus bila subjektif DAN skematik terkini berstatus approved. Tahap identiti ditangani di slice 8 (gating sijil).
create function public.maybe_pass_theory(p_enrollment uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select bool_and(latest_status = 'approved') and count(*) = 2 into ok from (
    select distinct on (type) type, status as latest_status from submissions
    where enrollment_id = p_enrollment and type in ('subjective','schematic') order by type, attempt_no desc) x;
  if coalesce(ok, false) then
    update enrollments set stage = 'theory_passed' where id = p_enrollment and stage = 'part2_review';
  end if;
  return coalesce(ok, false);
end $$;

create function public.submit_part2(p_enrollment uuid, p_type text, p_text text, p_file_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.enrollments; last public.submissions; sid uuid;
begin
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null or e.access_ends_at <= now() then raise exception 'access_closed'; end if;
  if e.stage <> 'part2_review' then raise exception 'part2_closed'; end if;   -- dibuka hanya selepas MCQ akhir lulus
  if p_type is null or p_type not in ('subjective','schematic') then raise exception 'bad_type'; end if;
  if p_type = 'subjective' and (p_text is null or length(trim(p_text)) < 1 or length(p_text) > 20000) then raise exception 'bad_text'; end if;
  if p_type = 'schematic' and (p_file_key is null or p_file_key not like 'submissions/' || p_enrollment::text || '/%') then raise exception 'bad_file_key'; end if;
  select * into last from submissions where enrollment_id = p_enrollment and type = p_type order by attempt_no desc limit 1;
  if last.id is not null and last.status <> 'rejected' then raise exception 'not_resubmittable'; end if;  -- pending/approved: tunggu atau sudah lulus
  insert into submissions (course_id, enrollment_id, type, text_answer, file_key, storage, source, declared_at, status, attempt_no)
  values (e.course_id, p_enrollment, p_type, case when p_type = 'subjective' then trim(p_text) end,
          case when p_type = 'schematic' then p_file_key end, 'r2', 'lms', now(), 'pending', coalesce(last.attempt_no, 0) + 1)
  returning id into sid;
  return sid;
end $$;

-- Tuntut SEMUA item menunggu bagi satu enrollment (satu skrin). Dua penilai tak boleh pegang item yang sama; tuntutan luput (claim_expiry_days).
create function public.claim_review(p_enrollment uuid, p_reviewer uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare expiry integer; n integer; held integer;
begin
  if not exists (select 1 from profiles where id = p_reviewer and role in ('reviewer','approver','admin')) then raise exception 'not_reviewer'; end if;
  select (c.config->>'claim_expiry_days')::int into expiry from enrollments e join courses c on c.id = e.course_id where e.id = p_enrollment;
  if expiry is null then raise exception 'config_claim_expiry_days_tiada'; end if;
  perform 1 from submissions where enrollment_id = p_enrollment and status = 'pending' and type in ('subjective','schematic') for update;
  select count(*) into held from submissions
    where enrollment_id = p_enrollment and status = 'pending' and type in ('subjective','schematic')
      and claimed_by is not null and claimed_by <> p_reviewer and claimed_at > now() - make_interval(days => expiry);
  if held > 0 then raise exception 'claimed_by_other'; end if;
  update submissions set claimed_by = p_reviewer, claimed_at = now()
    where enrollment_id = p_enrollment and status = 'pending' and type in ('subjective','schematic');
  get diagnostics n = row_count;
  if n = 0 then raise exception 'nothing_pending'; end if;
  return n;
end $$;

create function public.review_submission(p_submission uuid, p_reviewer uuid, p_decision text, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.submissions; expiry integer; passed boolean;
begin
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'bad_decision'; end if;
  if not exists (select 1 from profiles where id = p_reviewer and role in ('reviewer','approver','admin')) then raise exception 'not_reviewer'; end if;
  select * into s from submissions where id = p_submission for update;
  if s.id is null or s.type not in ('subjective','schematic') then raise exception 'not_found'; end if;
  if s.status <> 'pending' then raise exception 'already_reviewed'; end if;
  select (c.config->>'claim_expiry_days')::int into expiry from courses c where c.id = s.course_id;
  if s.claimed_by is distinct from p_reviewer or s.claimed_at <= now() - make_interval(days => coalesce(expiry, 0)) then raise exception 'not_claimed_by_you'; end if;
  if p_decision = 'rejected' and coalesce(trim(p_comment), '') = '' then raise exception 'comment_required'; end if;
  update submissions set status = p_decision, comment = nullif(trim(coalesce(p_comment, '')), ''), reviewer_id = p_reviewer, reviewed_at = now()
    where id = s.id;
  passed := maybe_pass_theory(s.enrollment_id);
  return jsonb_build_object('status', p_decision, 'theory_passed', passed);
end $$;

-- Laluan manual (sesi bantuan fasilitator sahaja): wajib tarikh terima, penilai dan sebab; rekod masuk admin_actions (append-only).
create function public.record_manual_submission(
  p_actor uuid, p_enrollment uuid, p_type text, p_received_at date, p_reviewer uuid,
  p_decision text, p_comment text, p_text text, p_file_key text, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.enrollments; last public.submissions; sid uuid;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_received_at is null then raise exception 'received_at_required'; end if;
  if p_received_at > current_date then raise exception 'received_at_future'; end if;
  if p_reviewer is null or not exists (select 1 from profiles where id = p_reviewer and role in ('reviewer','approver','admin')) then raise exception 'reviewer_required'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'bad_decision'; end if;
  if p_type is null or p_type not in ('subjective','schematic') then raise exception 'bad_type'; end if;
  if p_decision = 'rejected' and coalesce(trim(p_comment), '') = '' then raise exception 'comment_required'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.stage <> 'part2_review' then raise exception 'part2_closed'; end if;
  select * into last from submissions where enrollment_id = p_enrollment and type = p_type order by attempt_no desc limit 1;
  if last.id is not null and last.status <> 'rejected' then raise exception 'not_resubmittable'; end if;
  insert into submissions (course_id, enrollment_id, type, text_answer, file_key, storage, source, received_at, declared_at,
                           status, comment, attempt_no, reviewer_id, reviewed_at)
  values (e.course_id, p_enrollment, p_type, nullif(trim(coalesce(p_text, '')), ''), p_file_key,
          case when p_file_key is null then 'external' else 'r2' end, 'manual_fasi', p_received_at, p_received_at::timestamptz,
          p_decision, nullif(trim(coalesce(p_comment, '')), ''), coalesce(last.attempt_no, 0) + 1, p_reviewer, now())
  returning id into sid;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'manual_submission', p_enrollment, p_reason,
          jsonb_build_object('submission_id', sid, 'type', p_type, 'received_at', p_received_at, 'reviewer_id', p_reviewer,
                             'decision', p_decision, 'file_outside_system', p_file_key is null));
  perform maybe_pass_theory(p_enrollment);
  return sid;
end $$;

do $$ declare f text; begin
  foreach f in array array['grant_extra_attempts(uuid,uuid,integer,text)','maybe_pass_theory(uuid)','submit_part2(uuid,text,text,text)',
      'claim_review(uuid,uuid)','review_submission(uuid,uuid,text,text)',
      'record_manual_submission(uuid,uuid,text,date,uuid,text,text,text,text,text)','start_quiz(uuid,text,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
