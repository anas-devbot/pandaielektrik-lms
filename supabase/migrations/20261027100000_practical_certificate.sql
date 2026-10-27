-- Slice 10: Sijil Teori & Praktikal guna enjin slice 8. Hanya gating berubah: perlu practical_result = 'lulus' (dicatat reviewer, slice 9).

create or replace function public.issue_certificate(p_enrollment uuid, p_type text, p_holder_name text) returns uuid
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
  -- Kelayakan ikut jenis. 'completed' dibenarkan: sijil dibatalkan (cth. salah nama) boleh dikeluarkan semula oleh pelajar yang layak.
  if p_type = 'theory' then
    if e.cert_track is distinct from 'theory' or e.stage not in ('theory_passed','completed') then raise exception 'not_eligible'; end if;
  else
    -- Teori & Praktikal: trek praktikal DAN keputusan praktikal 'lulus' direkod reviewer. Tiada laluan lain.
    if e.cert_track is distinct from 'theory_practical' or e.practical_result is distinct from 'lulus' or e.stage not in ('practical','completed') then
      raise exception 'not_eligible'; end if;
  end if;
  select * into c from courses where id = e.course_id;
  if coalesce((c.config->'identity_check_enabled'->>p_type)::boolean, false) and e.identity_verified_at is null then raise exception 'identity_required'; end if;
  if length(nm) < 2 or length(nm) > 120 or nm ~ '[0-9<>{}\[\]\\|`~!#$%^&*=+;:?"@]' then raise exception 'bad_name'; end if;
  insert into certificates (course_id, enrollment_id, type, cert_id, holder_name, course_title, period_start, period_end)
  values (e.course_id, p_enrollment, p_type, 'AHZ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.certificate_seq')::text, 5, '0'),
          nm, c.title, e.created_at::date, current_date)
  returning * into cert;
  update enrollments set stage = 'completed' where id = p_enrollment;     -- selesai bila sijil dikeluarkan
  return cert.id;
end $$;


revoke all on function public.issue_certificate(uuid,text,text) from public, anon, authenticated;
grant execute on function public.issue_certificate(uuid,text,text) to service_role;
