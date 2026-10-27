-- Slice 11: refund. Semakan automatik di DB (nilai daripada courses.config, bukan hardcode), surat refund dijana, kelulusan admin,
-- refund sebenar dibuat MANUAL di dashboard Bayarcash (tiada endpoint refund), kemudian mark_refunded menutup akses dan membatalkan sijil.
-- Tidak memutuskan sama ada yuran Bayarcash ditolak atau dipulangkan (CLAUDE.md bahagian 8).
-- ASSUMPTION: "progres kurang daripada X%" ditafsir sebagai < refund_progress_max_pct (sama dengan X = gagal).
-- ASSUMPTION: refund_pdf_downloads_max (had log akses PDF) belum ditetapkan AHZ: jika tiada dalam config, kriteria itu tidak dikuatkuasakan.

alter table public.refund_requests
  add column reason text, add column override_note text, add column decision_note text,
  add column decided_at timestamptz, add column refunded_at timestamptz, add column refund_note text;
create unique index refund_requests_one_active on public.refund_requests (enrollment_id)
  where status in ('requested','auto_failed','letter_issued','letter_uploaded','approved');

create function public.refund_eligibility(p_enrollment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e public.enrollments; o public.orders; cfg jsonb; win integer; maxpct numeric; pdfmax integer;
        tot numeric; w numeric; pct numeric; subs integer; fin integer; pdfc integer; ok_window boolean; ok_prog boolean; ok_pdf boolean;
begin
  select * into e from enrollments where id = p_enrollment;
  if e.id is null then raise exception 'no_enrollment'; end if;
  select * into o from orders where id = e.order_id;
  if o.id is null or o.status not in ('paid','refunded') or o.paid_at is null then raise exception 'no_paid_order'; end if;   -- pendaftaran tanpa bayaran (grant manual) tiada refund
  select config into cfg from courses where id = e.course_id;
  win := (cfg->>'refund_window_days')::int; maxpct := (cfg->>'refund_progress_max_pct')::numeric; pdfmax := (cfg->>'refund_pdf_downloads_max')::int;
  if win is null or maxpct is null then raise exception 'config_refund_tiada'; end if;
  select coalesce(sum(duration_seconds), 0) into tot from lessons where course_id = e.course_id;
  select coalesce(sum(watched_seconds_unique), 0) into w from lesson_progress where enrollment_id = e.id;
  pct := case when tot = 0 then 0 else round(100 * w / tot, 2) end;
  select count(*) into subs from submissions where enrollment_id = e.id;                       -- subjektif, skematik, borang, video (semua sumber)
  select count(*) into fin from quiz_attempts where enrollment_id = e.id and type = 'final';   -- sebarang percubaan MCQ akhir
  select count(*) into pdfc from material_access_log where enrollment_id = e.id;
  ok_window := now() <= o.paid_at + make_interval(days => win);
  ok_prog := pct < maxpct;
  ok_pdf := pdfmax is null or pdfc <= pdfmax;
  return jsonb_build_object('paid_at', o.paid_at, 'deadline', o.paid_at + make_interval(days => win), 'window_days', win, 'window_ok', ok_window,
    'progress_pct', pct, 'progress_max_pct', maxpct, 'progress_ok', ok_prog,
    'submissions', subs, 'no_submissions', subs = 0, 'final_attempts', fin, 'no_final_attempt', fin = 0,
    'pdf_downloads', pdfc, 'pdf_max', pdfmax, 'pdf_ok', ok_pdf,
    'eligible', ok_window and ok_prog and subs = 0 and fin = 0 and ok_pdf);
end $$;

create function public.request_refund(p_enrollment uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.enrollments; snap jsonb; rid uuid; st text;
begin
  select * into e from enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null then raise exception 'refunded'; end if;
  snap := refund_eligibility(p_enrollment);
  if not (snap->>'window_ok')::boolean then raise exception 'window_closed'; end if;      -- tiada rekod: butang ditutup
  if exists (select 1 from refund_requests where enrollment_id = p_enrollment and status in ('requested','auto_failed','letter_issued','letter_uploaded','approved')) then raise exception 'already_requested'; end if;
  st := case when (snap->>'eligible')::boolean then 'letter_issued' else 'auto_failed' end;
  insert into refund_requests (enrollment_id, status, auto_check_snapshot, reason)
  values (p_enrollment, st, snap, nullif(left(trim(coalesce(p_reason, '')), 500), '')) returning id into rid;
  return jsonb_build_object('id', rid, 'status', st, 'snapshot', snap);
end $$;

create function public.attach_signed_letter(p_request uuid, p_enrollment uuid, p_file_key text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.refund_requests;
begin
  select * into r from refund_requests where id = p_request and enrollment_id = p_enrollment for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status <> 'letter_issued' then raise exception 'bad_status'; end if;
  if p_file_key is null or p_file_key not like 'refunds/' || p_enrollment::text || '/%' then raise exception 'bad_file_key'; end if;
  update refund_requests set status = 'letter_uploaded', signed_letter_key = p_file_key where id = r.id;
end $$;

-- Admin override: pelajar gagal semakan automatik tetapi admin membenarkan, dengan nota wajib. Direkod dalam admin_actions.
create function public.admin_override_refund(p_actor uuid, p_request uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.refund_requests;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;
  select * into r from refund_requests where id = p_request for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status <> 'auto_failed' then raise exception 'bad_status'; end if;
  update refund_requests set status = 'letter_issued', override_note = trim(p_note) where id = r.id;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'refund_override', r.enrollment_id, trim(p_note), jsonb_build_object('request_id', r.id, 'snapshot', r.auto_check_snapshot));
end $$;

create function public.decide_refund(p_actor uuid, p_request uuid, p_decision text, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare r public.refund_requests;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'bad_decision'; end if;
  if p_decision = 'rejected' and coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;
  select * into r from refund_requests where id = p_request for update;
  if r.id is null then raise exception 'not_found'; end if;
  -- kelulusan hanya selepas surat bertandatangan dimuat naik; penolakan/penutupan boleh pada mana-mana status aktif sebelum kelulusan
  if p_decision = 'approved' and r.status <> 'letter_uploaded' then raise exception 'bad_status'; end if;
  if p_decision = 'rejected' and r.status not in ('auto_failed','letter_issued','letter_uploaded') then raise exception 'bad_status'; end if;
  update refund_requests set status = p_decision, decided_by = p_actor, decided_at = now(), decision_note = nullif(trim(coalesce(p_note, '')), '') where id = r.id;
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'refund', r.enrollment_id, coalesce(nullif(trim(p_note), ''), 'Keputusan refund: ' || p_decision), jsonb_build_object('request_id', r.id, 'decision', p_decision));
  return p_decision;
end $$;

-- Dipanggil SELEPAS admin membuat refund sebenar di dashboard Bayarcash (manual). Menutup akses dan membatalkan sijil.
create function public.mark_refunded(p_actor uuid, p_request uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.refund_requests; e public.enrollments; certs uuid[];
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;      -- rujukan refund Bayarcash
  select * into r from refund_requests where id = p_request for update;
  if r.id is null then raise exception 'not_found'; end if;
  if r.status <> 'approved' then raise exception 'bad_status'; end if;
  select * into e from enrollments where id = r.enrollment_id for update;
  update refund_requests set status = 'refunded', refunded_at = now(), refund_note = trim(p_note) where id = r.id;
  update enrollments set refunded_at = now() where id = e.id;                           -- akses video/PDF/kuiz/penghantaran ditutup di semua tempat
  update orders set status = 'refunded' where id = e.order_id;
  select coalesce(array_agg(id), '{}') into certs from certificates where enrollment_id = e.id and revoked_at is null;
  update certificates set revoked_at = now() where enrollment_id = e.id and revoked_at is null;   -- sijil dibatalkan
  perform cancel_energize(e.id, p_actor, 'Refund: kebenaran bekalan ditamatkan');
  insert into admin_actions (actor_id, action, enrollment_id, reason, detail)
  values (p_actor, 'refund', e.id, trim(p_note), jsonb_build_object('request_id', r.id, 'executed', true, 'revoked_certificates', to_jsonb(certs)));
  return jsonb_build_object('revoked_certificates', cardinality(certs));
end $$;

do $$ declare f text; begin
  foreach f in array array['refund_eligibility(uuid)','request_refund(uuid,text)','attach_signed_letter(uuid,uuid,text)',
      'admin_override_refund(uuid,uuid,text)','decide_refund(uuid,uuid,text,text)','mark_refunded(uuid,uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
