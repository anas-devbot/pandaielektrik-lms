-- Slice 9: trek praktikal. GATE KESELAMATAN: sistem TIDAK menjana atau mengotomasikan kebenaran memasukkan bekalan (CLAUDE.md #9).
-- Kebenaran hanya wujud melalui approve_energize() yang dipanggil secara eksplisit oleh pengguna berperanan 'approver', terikat pada
-- deklarasi video tertentu (approved_submission_id), merekod teks panduan keselamatan AHZ dalam admin_actions (append-only).
-- Hantar semula video atau borang = deklarasi baharu = kelulusan lama dibatalkan automatik.

alter table public.enrollments
  add column telegram_consent_at timestamptz,
  add column practical_result text check (practical_result in ('lulus','belum')),
  add column practical_result_by uuid references public.profiles(id),
  add column practical_result_at timestamptz,
  add column practical_comment text;

alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked','energize_cancelled','practical_result','telegram_link_set'));

-- Pelajar memilih trek praktikal (trek teori melalui issue_certificate/choose_track sedia ada).
create or replace function public.choose_track(p_enrollment uuid, p_track text) returns text
language plpgsql security definer set search_path = public as $$
declare e public.enrollments;
begin
  if p_track is null or p_track not in ('theory','theory_practical') then raise exception 'bad_track'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null then raise exception 'refunded'; end if;
  if e.stage <> 'theory_passed' then raise exception 'not_eligible'; end if;
  if e.cert_track is not null then raise exception 'track_locked'; end if;
  update enrollments set cert_track = p_track, stage = case when p_track = 'theory_practical' then 'practical' else stage end where id = p_enrollment;
  return p_track;
end $$;

-- Batalkan kelulusan bekalan (dalaman). Direkod dalam admin_actions; pelaku = pengguna yang mencetuskan pembatalan.
create function public.cancel_energize(p_enrollment uuid, p_actor uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare e public.enrollments;
begin
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null or e.energize_approved_at is null then return false; end if;
  update enrollments set energize_approved_at = null, energize_approved_by = null, approved_submission_id = null where id = p_enrollment;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'energize_cancelled', p_enrollment, p_reason,
          jsonb_build_object('was_approved_by', e.energize_approved_by, 'was_approved_at', e.energize_approved_at, 'was_submission_id', e.approved_submission_id));
  return true;
end $$;

create function public.submit_practical(p_enrollment uuid, p_type text, p_file_key text, p_external_ref text, p_consent boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.enrollments; last public.submissions; form public.submissions; sid uuid; ref text := trim(coalesce(p_external_ref, ''));
begin
  if p_type is null or p_type not in ('form','video') then raise exception 'bad_type'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null or e.access_ends_at <= now() then raise exception 'access_closed'; end if;
  if e.cert_track is distinct from 'theory_practical' or e.stage <> 'practical' or e.practical_result = 'lulus' then raise exception 'practical_closed'; end if;
  select * into last from submissions where enrollment_id = p_enrollment and type = p_type order by attempt_no desc limit 1;
  if last.id is not null and last.status = 'pending' then raise exception 'not_resubmittable'; end if;   -- sedang disemak

  if p_type = 'form' then
    if p_file_key is null or p_file_key not like 'submissions/' || p_enrollment::text || '/%' then raise exception 'bad_file_key'; end if;
  else
    -- video disimpan di Telegram (di luar sistem): hanya rujukan + deklarasi. Persetujuan privasi group wajib SEBELUM deklarasi.
    if p_consent is not true then raise exception 'consent_required'; end if;
    if length(ref) < 3 or length(ref) > 200 then raise exception 'bad_ref'; end if;
    select * into form from submissions where enrollment_id = p_enrollment and type = 'form' order by attempt_no desc limit 1;
    if form.id is null or form.status = 'rejected' then raise exception 'form_required'; end if;
    update enrollments set telegram_consent_at = coalesce(telegram_consent_at, now()) where id = p_enrollment;
  end if;

  -- deklarasi/borang baharu membatalkan kelulusan bekalan terdahulu secara automatik
  perform cancel_energize(p_enrollment, e.user_id, 'Penghantaran semula ' || p_type || ': kelulusan lama dibatalkan automatik');

  insert into submissions (course_id, enrollment_id, type, file_key, external_ref, storage, source, declared_at, status, attempt_no)
  values (e.course_id, p_enrollment, p_type, case when p_type = 'form' then p_file_key end, case when p_type = 'video' then ref end,
          case when p_type = 'form' then 'r2' else 'external' end, 'lms', now(), 'pending', coalesce(last.attempt_no, 0) + 1)
  returning id into sid;
  return sid;
end $$;

create function public.claim_practical(p_enrollment uuid, p_reviewer uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare expiry integer; n integer; held integer;
begin
  if not exists (select 1 from profiles where id = p_reviewer and role in ('reviewer','approver','admin')) then raise exception 'not_reviewer'; end if;
  select (c.config->>'claim_expiry_days')::int into expiry from enrollments e join courses c on c.id = e.course_id where e.id = p_enrollment;
  if expiry is null then raise exception 'config_claim_expiry_days_tiada'; end if;
  perform 1 from submissions where enrollment_id = p_enrollment and status = 'pending' and type in ('form','video') for update;
  select count(*) into held from submissions where enrollment_id = p_enrollment and status = 'pending' and type in ('form','video')
    and claimed_by is not null and claimed_by <> p_reviewer and claimed_at > now() - make_interval(days => expiry);
  if held > 0 then raise exception 'claimed_by_other'; end if;
  update submissions set claimed_by = p_reviewer, claimed_at = now() where enrollment_id = p_enrollment and status = 'pending' and type in ('form','video');
  get diagnostics n = row_count;
  if n = 0 then raise exception 'nothing_pending'; end if;
  return n;
end $$;

-- Reviewer menyemak borang/video yang diisytihar (video dilihat di Telegram, di luar sistem). Ini BUKAN kebenaran bekalan.
create function public.review_practical_item(p_submission uuid, p_reviewer uuid, p_decision text, p_comment text) returns text
language plpgsql security definer set search_path = public as $$
declare s public.submissions; expiry integer;
begin
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'bad_decision'; end if;
  if not exists (select 1 from profiles where id = p_reviewer and role in ('reviewer','approver','admin')) then raise exception 'not_reviewer'; end if;
  select * into s from submissions where id = p_submission for update;
  if s.id is null or s.type not in ('form','video') then raise exception 'not_found'; end if;
  if s.status <> 'pending' then raise exception 'already_reviewed'; end if;
  select (c.config->>'claim_expiry_days')::int into expiry from courses c where c.id = s.course_id;
  if s.claimed_by is distinct from p_reviewer or s.claimed_at <= now() - make_interval(days => coalesce(expiry, 0)) then raise exception 'not_claimed_by_you'; end if;
  if p_decision = 'rejected' and coalesce(trim(p_comment), '') = '' then raise exception 'comment_required'; end if;
  update submissions set status = p_decision, comment = nullif(trim(coalesce(p_comment, '')), ''), reviewer_id = p_reviewer, reviewed_at = now() where id = s.id;
  return p_decision;
end $$;

-- KEBENARAN BEKALAN: manual, approver sahaja, terikat pada deklarasi video semasa. Teks panduan keselamatan ditulis AHZ (config).
create function public.approve_energize(p_actor uuid, p_enrollment uuid, p_video uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.enrollments; v public.submissions; f public.submissions; guidance text; lv uuid; lf uuid;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'approver') then raise exception 'actor_not_approver'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null then raise exception 'refunded'; end if;
  if e.cert_track is distinct from 'theory_practical' or e.stage <> 'practical' or e.practical_result = 'lulus' then raise exception 'practical_closed'; end if;
  if e.energize_approved_at is not null then raise exception 'already_approved'; end if;
  select c.config->>'energize_guidance_text' into guidance from courses c where c.id = e.course_id;
  if coalesce(trim(guidance), '') = '' then raise exception 'guidance_text_tiada'; end if;   -- teks keselamatan AHZ wajib sebelum sebarang kelulusan

  select * into v from submissions where enrollment_id = p_enrollment and type = 'video' order by attempt_no desc limit 1;
  select * into f from submissions where enrollment_id = p_enrollment and type = 'form' order by attempt_no desc limit 1;
  if v.id is null or v.id is distinct from p_video then raise exception 'video_not_current'; end if;   -- terikat pada deklarasi SEMASA sahaja
  if v.status <> 'approved' then raise exception 'video_not_reviewed'; end if;
  if f.id is null or f.status <> 'approved' then raise exception 'form_not_reviewed'; end if;

  update enrollments set energize_approved_at = now(), energize_approved_by = p_actor, approved_submission_id = v.id where id = p_enrollment;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'energize_approval', p_enrollment, 'Kebenaran memasukkan bekalan diluluskan secara manual oleh approver',
          jsonb_build_object('video_submission_id', v.id, 'form_submission_id', f.id, 'video_external_ref', v.external_ref,
                             'guidance_text', guidance, 'video_attempt', v.attempt_no, 'form_attempt', f.attempt_no));
  return v.id;
end $$;

-- Keputusan praktikal direkod reviewer SELEPAS bekalan dimasukkan (di luar sistem). Hanya jika kebenaran bekalan wujud.
create function public.record_practical_result(p_reviewer uuid, p_enrollment uuid, p_result text, p_comment text) returns text
language plpgsql security definer set search_path = public as $$
declare e public.enrollments;
begin
  if p_result is null or p_result not in ('lulus','belum') then raise exception 'bad_result'; end if;
  if not exists (select 1 from profiles where id = p_reviewer and role in ('reviewer','approver')) then raise exception 'not_reviewer'; end if;
  if p_result = 'belum' and coalesce(trim(p_comment), '') = '' then raise exception 'comment_required'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.cert_track is distinct from 'theory_practical' or e.stage <> 'practical' or e.practical_result = 'lulus' then raise exception 'practical_closed'; end if;
  if e.energize_approved_at is null then raise exception 'no_energize_approval'; end if;
  update enrollments set practical_result = p_result, practical_result_by = p_reviewer, practical_result_at = now(),
    practical_comment = nullif(trim(coalesce(p_comment, '')), '') where id = p_enrollment;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_reviewer, 'practical_result', p_enrollment, coalesce(nullif(trim(p_comment), ''), 'Keputusan praktikal'), jsonb_build_object('result', p_result));
  if p_result = 'belum' then perform cancel_energize(p_enrollment, p_reviewer, 'Keputusan praktikal: belum lulus, kelulusan bekalan ditamatkan'); end if;
  return p_result;
end $$;

-- Pautan jemputan Telegram group (dipaparkan di dashboard pelajar). Group dicipta manual oleh AHZ.
create function public.set_telegram_link(p_actor uuid, p_enrollment uuid, p_link text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_actor and role in ('approver','admin')) then raise exception 'actor_not_allowed'; end if;
  if p_link is null or p_link !~ '^https://t\.me/[A-Za-z0-9_+/-]{5,100}$' then raise exception 'bad_link'; end if;
  update enrollments set telegram_invite_link = p_link where id = p_enrollment;
  if not found then raise exception 'no_enrollment'; end if;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail) values (p_actor, 'telegram_link_set', p_enrollment, 'Pautan jemputan Telegram ditetapkan', '{}');
end $$;

do $$ declare f text; begin
  foreach f in array array['choose_track(uuid,text)','cancel_energize(uuid,uuid,text)','submit_practical(uuid,text,text,text,boolean)','claim_practical(uuid,uuid)',
      'review_practical_item(uuid,uuid,text,text)','approve_energize(uuid,uuid,uuid)','record_practical_result(uuid,uuid,text,text)','set_telegram_link(uuid,uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
