-- Slice 5: kemajuan video dikira di SERVER sebagai set saat unik (CLAUDE.md #8).
-- Bitmap bytea (1 bit per saat) menggantikan seconds_set jsonb: padat, union murah.
-- Kredit saat hanya untuk tempoh yang munasabah dengan masa dinding server: main biasa dan 2x sah,
-- skip ke hujung / heartbeat palsu tidak menambah saat. Baca config: video_complete_pct (wajib),
-- video_max_rate (default 2) dan video_heartbeat_max_gap_sec (default 15), ASSUMPTION: belum disahkan Saiful.

alter table public.lesson_progress drop column seconds_set;
alter table public.lesson_progress add column seconds_bits bytea not null default ''::bytea;
alter table public.lesson_progress add column last_position integer;

create function public.record_heartbeat(p_enrollment uuid, p_lesson uuid, p_position integer, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments; l public.lessons; p public.lesson_progress; cfg jsonb;
  pct numeric; rate numeric; gap integer;
  d integer; pos integer; elapsed numeric; maxdiff integer; a integer; b integer; bits bytea; wu integer; need integer;
begin
  select * into e from enrollments where id = p_enrollment;
  if e.id is null then raise exception 'no_enrollment'; end if;
  -- pertahanan berlapis: akses tamat atau refund = tutup (selain semakan di route)
  if e.refunded_at is not null or e.access_ends_at <= p_now then raise exception 'access_closed'; end if;
  select * into l from lessons where id = p_lesson and course_id = e.course_id;
  if l.id is null then raise exception 'no_lesson'; end if;

  select config into cfg from courses where id = e.course_id;
  pct := (cfg->>'video_complete_pct')::numeric;
  if pct is null then raise exception 'courses.config.video_complete_pct tiada'; end if;
  rate := coalesce((cfg->>'video_max_rate')::numeric, 2);
  gap  := coalesce((cfg->>'video_heartbeat_max_gap_sec')::integer, 15);

  d := l.duration_seconds;
  pos := greatest(0, least(p_position, d - 1));

  insert into lesson_progress (enrollment_id, lesson_id, seconds_bits)
  values (p_enrollment, p_lesson, decode(repeat('00', (d + 7) / 8), 'hex'))
  on conflict (enrollment_id, lesson_id) do nothing;
  select * into p from lesson_progress where enrollment_id = p_enrollment and lesson_id = p_lesson for update;

  bits := p.seconds_bits;
  if length(bits) < (d + 7) / 8 then bits := bits || decode(repeat('00', (d + 7) / 8 - length(bits)), 'hex'); end if;

  if p.last_heartbeat_at is null then
    a := pos; b := pos;                                   -- heartbeat pertama: hanya saat semasa
  else
    elapsed := extract(epoch from (p_now - p.last_heartbeat_at));
    if elapsed < 2 then                                   -- terlalu kerap: abaikan, jangan ubah apa-apa
      return jsonb_build_object('watched', p.watched_seconds_unique, 'duration', d, 'completed', p.completed_at is not null, 'ignored', true);
    end if;
    maxdiff := floor(least(elapsed, gap) * rate) + 2;
    if pos > p.last_position and pos - p.last_position <= maxdiff then
      a := p.last_position + 1; b := pos;                 -- kemajuan selari masa nyata: kredit julat
    else
      a := pos; b := pos;                                 -- lompat jauh / undur / berhenti: saat semasa sahaja
    end if;
  end if;

  for i in a..b loop bits := set_bit(bits, i, 1); end loop;
  wu := bit_count(bits);
  need := ceil(d * pct);
  update lesson_progress set seconds_bits = bits, watched_seconds_unique = wu, last_position = pos, last_heartbeat_at = p_now,
    completed_at = case when completed_at is null and wu >= need then p_now else completed_at end
  where enrollment_id = p_enrollment and lesson_id = p_lesson
  returning * into p;
  return jsonb_build_object('watched', wu, 'duration', d, 'completed', p.completed_at is not null);
end $$;

revoke all on function public.record_heartbeat(uuid,uuid,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.record_heartbeat(uuid,uuid,integer,timestamptz) to service_role;
