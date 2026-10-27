-- Slice 8: sijil. Semua penjanaan melalui fungsi service_role (gating di DB). Data pada sijil disnapshot semasa dikeluarkan
-- supaya tidak berubah bila profil berubah. Wording sijil menunggu AHZ (disimpan di config, bukan kod).
-- ASSUMPTION: tempoh pada sijil = tarikh enrollment hingga tarikh dikeluarkan (kursus self-paced); belum disahkan AHZ.

alter table public.certificates
  add column holder_name text, add column course_title text, add column period_start date, add column period_end date;
create sequence public.certificate_seq;

alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked'));

-- Pelajar memilih trek selepas teori lulus. Trek terkunci selepas dipilih (ASSUMPTION: polisi tukar trek belum diputuskan AHZ).
create function public.choose_track(p_enrollment uuid, p_track text) returns text
language plpgsql security definer set search_path = public as $$
declare e public.enrollments;
begin
  if p_track is null or p_track not in ('theory','theory_practical') then raise exception 'bad_track'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null then raise exception 'refunded'; end if;
  if e.stage <> 'theory_passed' then raise exception 'not_eligible'; end if;
  if e.cert_track is not null then raise exception 'track_locked'; end if;
  update enrollments set cert_track = p_track, stage = case when p_track = 'theory_practical' then 'practical' else stage end
    where id = p_enrollment;
  return p_track;
end $$;

create function public.verify_identity(p_actor uuid, p_enrollment uuid, p_method text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = p_actor and role in ('approver','admin')) then raise exception 'actor_not_allowed'; end if;
  if coalesce(trim(p_method), '') = '' or coalesce(trim(p_reason), '') = '' then raise exception 'method_reason_required'; end if;
  update enrollments set identity_verified_at = now(), identity_verified_by = p_actor, identity_method = trim(p_method) where id = p_enrollment;
  if not found then raise exception 'no_enrollment'; end if;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'identity_verified', p_enrollment, p_reason, jsonb_build_object('method', trim(p_method)));
end $$;

create function public.issue_certificate(p_enrollment uuid, p_type text, p_holder_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.enrollments; c public.courses; cert public.certificates; nm text := trim(coalesce(p_holder_name, ''));
begin
  if p_type is null or p_type not in ('theory','theory_practical') then raise exception 'bad_type'; end if;
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null then raise exception 'refunded'; end if;
  -- idempotent: sijil sah (tak dibatalkan) jenis sama dipulangkan, nama tidak berubah
  select * into cert from certificates where enrollment_id = p_enrollment and type = p_type and revoked_at is null;
  if cert.id is not null then return cert.id; end if;
  if p_type = 'theory_practical' then raise exception 'practical_not_ready'; end if;   -- dibuka di slice 9/10
  -- 'completed' dibenarkan: sijil dibatalkan (cth. salah nama) boleh dikeluarkan semula oleh pelajar yang layak
  if e.cert_track is distinct from 'theory' or e.stage not in ('theory_passed','completed') then raise exception 'not_eligible'; end if;
  select * into c from courses where id = e.course_id;
  if coalesce((c.config->'identity_check_enabled'->>p_type)::boolean, false) and e.identity_verified_at is null then raise exception 'identity_required'; end if;
  if length(nm) < 2 or length(nm) > 120 or nm ~ '[0-9<>{}\[\]\\|`~!#$%^&*=+;:?"@]' then raise exception 'bad_name'; end if;
  insert into certificates (course_id, enrollment_id, type, cert_id, holder_name, course_title, period_start, period_end)
  values (e.course_id, p_enrollment, p_type, 'AHZ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.certificate_seq')::text, 5, '0'),
          nm, c.title, e.created_at::date, current_date)
  returning * into cert;
  update enrollments set stage = 'completed' where id = p_enrollment;     -- trek teori: selesai bila sijil dikeluarkan
  return cert.id;
end $$;

create function public.revoke_certificate(p_actor uuid, p_certificate uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare cert public.certificates;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into cert from certificates where id = p_certificate for update;
  if cert.id is null then raise exception 'not_found'; end if;
  if cert.revoked_at is not null then raise exception 'already_revoked'; end if;
  update certificates set revoked_at = now() where id = cert.id;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'certificate_revoked', cert.enrollment_id, p_reason, jsonb_build_object('certificate_id', cert.cert_id));
end $$;

-- Halaman semakan awam: HANYA medan ini. Tiada emel, telefon, enrollment atau nama pengguna dalaman.
create function public.certificate_public(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('cert_id', cert_id, 'type', type, 'holder_name', holder_name, 'course_title', course_title,
    'period_start', period_start, 'period_end', period_end, 'issued_at', issued_at::date,
    'status', case when revoked_at is null then 'sah' else 'dibatalkan' end)
  from certificates where verify_token = p_token
$$;

do $$ declare f text; begin
  foreach f in array array['choose_track(uuid,text)','verify_identity(uuid,uuid,text,text)','issue_certificate(uuid,text,text)',
      'revoke_certificate(uuid,uuid,text)','certificate_public(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
