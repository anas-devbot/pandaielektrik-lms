-- Katalog kursus (keputusan Bos, 12 Nov 2026). Admin isi maklumat kursus; kursus dipaparkan di landing bila published = true.
-- Pautan WhatsApp digunakan untuk SEMUA kursus (termasuk DIY). Kursus DIY kekal dengan CTA daftar dan bayar.
-- Kursus draf tak kelihatan kepada awam. Pelajar yang sudah berenrollment tetap boleh baca kursus mereka.

alter table public.courses
  add column if not exists published boolean not null default false,
  add column if not exists cta text not null default 'whatsapp' check (cta in ('daftar','whatsapp')),
  add column if not exists summary text,
  add column if not exists cta_url text not null default 'https://chat.whatsapp.com/FZlPLzJrC5a9IK5nLAqroz',
  add column if not exists poster_key text;

-- kursus DIY sedia ada kekal di landing dengan CTA daftar dan bayar
update public.courses set published = true, cta = 'daftar' where slug = 'kursus-elektrik';

-- Buang fungsi pembantu percubaan awal (tak digunakan lagi; elak fungsi awam tambahan).
drop function if exists public.pelajar_berdaftar_kursus(uuid);

-- RLS: awam nampak kursus yang dipaparkan sahaja.
-- Pengguna log masuk (authenticated) juga nampak kursus yang dia sudah berdaftar, walaupun tak dipaparkan.
-- Anon tak ada kebenaran SELECT pada enrollments, jadi polisi anon hanya rujuk published.
drop policy if exists "public read courses" on public.courses;
drop policy if exists "kursus dipaparkan boleh dibaca" on public.courses;
drop policy if exists "kursus dipaparkan untuk awam" on public.courses;
drop policy if exists "kursus dipaparkan atau pelajar berdaftar" on public.courses;
create policy "kursus dipaparkan untuk awam" on public.courses
  for select to anon using (published);
create policy "kursus dipaparkan atau pelajar berdaftar" on public.courses
  for select to authenticated
  using (published or exists (select 1 from public.enrollments e where e.course_id = courses.id and e.user_id = auth.uid()));

drop policy if exists "public read sessions" on public.course_sessions;
drop policy if exists "sesi kursus dipaparkan boleh dibaca" on public.course_sessions;
drop policy if exists "sesi kursus dipaparkan untuk awam" on public.course_sessions;
drop policy if exists "sesi kursus dipaparkan atau pelajar berdaftar" on public.course_sessions;
create policy "sesi kursus dipaparkan untuk awam" on public.course_sessions
  for select to anon
  using (status <> 'draft' and exists (select 1 from public.courses c where c.id = course_sessions.course_id and c.published));
create policy "sesi kursus dipaparkan atau pelajar berdaftar" on public.course_sessions
  for select to authenticated
  using (
    status <> 'draft'
    and exists (
      select 1 from public.courses c
      where c.id = course_sessions.course_id
        and (c.published or exists (select 1 from public.enrollments e where e.course_id = c.id and e.user_id = auth.uid()))
    )
  );

-- admin_actions: jenis tindakan baharu untuk perubahan katalog
alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in
  ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission','extra_attempts',
   'identity_verified','certificate_revoked','energize_cancelled','practical_result','telegram_link_set','config_changed','session_saved','phone_changed',
   'catalog_changed'));

-- Cipta atau kemas kini kursus dalam katalog. Hanya admin (disemak dalam fungsi). Direkod dalam admin_actions.
-- p_poster_key null = kekalkan poster sedia ada.
create or replace function public.upsert_course_catalog(
  p_actor uuid, p_id uuid, p_title text, p_slug text, p_summary text, p_price integer,
  p_cta text, p_cta_url text, p_published boolean, p_poster_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin') then raise exception 'actor_not_admin'; end if;
  if p_title is null or length(trim(p_title)) < 3 or length(p_title) > 120 then raise exception 'bad_title'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]{3,60}$' then raise exception 'bad_slug'; end if;
  if p_summary is not null and length(p_summary) > 400 then raise exception 'bad_summary'; end if;
  if p_price is null or p_price < 0 then raise exception 'bad_price'; end if;
  if p_cta is null or p_cta not in ('daftar','whatsapp') then raise exception 'bad_cta'; end if;
  if p_cta_url is null or p_cta_url !~ '^https://(chat\.whatsapp\.com|wa\.me)/' then raise exception 'bad_cta_url'; end if;
  if p_published is null then raise exception 'bad_published'; end if;

  if p_id is null then
    insert into courses (slug, title, price, summary, cta, cta_url, published, poster_key, config)
    values (p_slug, trim(p_title), p_price, nullif(trim(coalesce(p_summary, '')), ''), p_cta, p_cta_url, p_published, p_poster_key, '{}'::jsonb)
    returning id into cid;
  else
    update courses set
      slug = p_slug, title = trim(p_title), price = p_price,
      summary = nullif(trim(coalesce(p_summary, '')), ''),
      cta = p_cta, cta_url = p_cta_url, published = p_published,
      poster_key = coalesce(p_poster_key, poster_key)
    where id = p_id
    returning id into cid;
    if cid is null then raise exception 'not_found'; end if;
  end if;

  insert into admin_actions (actor_id, action, reason, detail)
  values (p_actor, 'catalog_changed', 'kemas kini katalog kursus', jsonb_build_object('course_id', cid, 'published', p_published, 'cta', p_cta));
  return cid;
end $$;

revoke all on function public.upsert_course_catalog(uuid,uuid,text,text,text,integer,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.upsert_course_catalog(uuid,uuid,text,text,text,integer,text,text,boolean,text) to service_role;
