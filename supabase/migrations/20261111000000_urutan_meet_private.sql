-- Susunan video ikut turutan (urutan_global, disyorkan, BUKAN dikunci), pautan Google Meet,
-- dan pautan group Telegram chat. Pautan ini TIDAK boleh dibaca awam:
--   * courses.config kekal awam (semua kunci ialah polisi, tiada rahsia). Pautan tidak masuk situ.
--   * course_sessions: anon/authenticated hanya dapat lajur awam; meet_link tidak termasuk.
--   * course_private: tiada akses anon/authenticated; hanya service_role (server).

-- 1. Urutan global video
alter table public.lessons add column urutan_global integer;
create unique index lessons_urutan_global_key on public.lessons (course_id, urutan_global) where urutan_global is not null;

-- Isi untuk 30 video semasa ikut video_ref (sama dengan docs/video-youtube-v3.csv, lajur turutan).
update public.lessons l set urutan_global = v.n
from (values
  ('a3sLJ6QJ4sw', 1), ('FBR7_NUTEHY', 2),
  ('Nb209OBnp68', 3), ('_aVaMfMg-qo', 4), ('CuXC_0qM9vM', 5), ('5e5b_sdKbx8', 6), ('5gwwZvcbQsw', 7),
  ('HEPCf321uCc', 8), ('o71S5otS4e8', 9), ('LwpXHIT6Nco', 10), ('OUc8sdZmusA', 11), ('ZGWe2aGzQAw', 12),
  ('xSiKXSC7dws', 13), ('cfzPPHfdN-4', 14), ('O_ejD2kTk0Q', 15), ('NLSsKujW_48', 16), ('1eHysGG1NGU', 17),
  ('E5YVTn7Jkl4', 18), ('DtljHrHi-qI', 19), ('BgEbcQHeLF0', 20), ('riJfoKxkVdc', 21), ('6vnkbwyFN7U', 22),
  ('5KQ20UKyOyg', 23), ('U4fNE83Ewbc', 24), ('1CxtVb1cXfY', 25), ('EyD9YVEWi2Y', 26), ('5YCoCNltDhY', 27),
  ('diEbYFE6Mhc', 28), ('Pe6XEhhp-Y8', 29), ('tTIfbBDqykc', 30)
) as v(ref, n)
where l.video_ref = v.ref;

-- 2. Pautan Google Meet per sesi: sembunyi daripada awam
alter table public.course_sessions add column meet_link text;
revoke select on public.course_sessions from anon, authenticated;
grant select (id, course_id, starts_at, ends_at, venue_or_link, capacity, status, created_at)
  on public.course_sessions to anon, authenticated;
-- polisi "public read sessions" (status <> 'draft') kekal; lajur meet_link tidak dihidang kepada anon/authenticated

-- 3. Jadual peribadi kursus: pautan group Telegram chat
create table public.course_private (
  course_id uuid primary key references public.courses(id),
  telegram_chat_link text,
  updated_at timestamptz not null default now()
);
alter table public.course_private enable row level security;
revoke all on public.course_private from anon, authenticated;
grant select, insert, update, delete on public.course_private to service_role;
-- tiada polisi untuk anon/authenticated: hanya service_role (server) boleh baca atau tulis

-- 4. RPC admin: tetapkan pautan Meet (sesi) dan pautan Telegram chat. Rekod dalam admin_actions tanpa menyimpan pautan.
create function public.set_course_links(p_actor uuid, p_course uuid, p_session uuid, p_meet text, p_telegram text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m text := nullif(trim(coalesce(p_meet, '')), ''); t text := nullif(trim(coalesce(p_telegram, '')), '');
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if m is not null and m !~ '^https://meet\.google\.com/[a-z0-9-]+$' then raise exception 'bad_meet_link'; end if;
  if t is not null and t !~ '^https://t\.me/' then raise exception 'bad_telegram_link'; end if;
  if m is null and t is null then raise exception 'nothing_to_set'; end if;
  if m is not null and p_session is null then raise exception 'session_required'; end if;
  -- Kosong = tidak diubah (tiada cara buang pautan melalui borang; elak pautan lain terpadam tanpa sengaja)
  if m is not null then
    update course_sessions set meet_link = m where id = p_session and course_id = p_course;
    if not found then raise exception 'not_found'; end if;
  end if;
  if t is not null then
    insert into course_private (course_id, telegram_chat_link, updated_at) values (p_course, t, now())
      on conflict (course_id) do update set telegram_chat_link = excluded.telegram_chat_link, updated_at = now();
  end if;
  insert into admin_actions (actor_id, action, reason, detail)
    values (p_actor, 'config_changed', p_reason,
            jsonb_build_object('key', 'course_links', 'session_id', p_session, 'meet_set', m is not null, 'telegram_set', t is not null));
end $$;
revoke all on function public.set_course_links(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.set_course_links(uuid, uuid, uuid, text, text, text) to service_role;
