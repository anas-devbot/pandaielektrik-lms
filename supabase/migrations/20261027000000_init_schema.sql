-- Migration slice 1: schema awal LMS (diluluskan Bos 27 Okt 2026). Sumber: CLAUDE.md bahagian 5-9.
-- Wang: integer sen MYR. Nilai polisi dalam courses.config, bukan kod.

create extension if not exists pgcrypto;

-- ---------- helper ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,                                   -- tiada No. IC (peraturan 11)
  role text not null default 'student' check (role in ('student','reviewer','approver','admin')),
  privacy_accepted_at timestamptz,
  utm_source text, utm_medium text, utm_campaign text,
  created_at timestamptz not null default now()
);

-- security definer supaya policy tak rekursif pada profiles
create function public.is_staff(min_role text default 'reviewer') returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
    and case min_role
          when 'reviewer' then p.role in ('reviewer','approver','admin')
          when 'approver' then p.role in ('approver','admin')
          else p.role = 'admin' end);
$$;

-- ---------- kursus & kandungan ----------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  price integer not null check (price > 0),     -- sen
  currency text not null default 'MYR',
  config jsonb not null default '{}'::jsonb,    -- access_months, pass_mark_mcq, video_complete_pct, refund_*, sla_*, dll
  created_at timestamptz not null default now()
);

create table public.course_sessions (           -- tarikh kursus live di landing
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_or_link text,
  capacity integer,
  status text not null default 'open' check (status in ('draft','open','full','closed')),
  created_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  position integer not null,
  title text not null,
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  chapter_id uuid not null references chapters(id),
  position integer not null,
  title text not null,
  video_provider text not null default 'youtube',
  video_ref text not null,                      -- ID video (unlisted)
  duration_seconds integer not null check (duration_seconds > 0),
  unique (chapter_id, position)
);

create table public.materials (                 -- PDF di R2 private
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  chapter_id uuid references chapters(id),
  title text not null,
  r2_key text not null
);

-- ---------- kewangan ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  course_id uuid not null references courses(id),
  order_number text not null unique,            -- unik setiap percubaan bayar (padanan callback)
  amount integer not null check (amount > 0),   -- disalin dari courses.price di server
  currency text not null default 'MYR',
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  terms_accepted_at timestamptz not null,       -- T&C checkbox sebelum bayar
  paid_at timestamptz,
  referral_code text,                           -- nullable sahaja; tiada jadual affiliate
  utm_source text, utm_medium text, utm_campaign text,
  created_at timestamptz not null default now()
);

create table public.payment_events (            -- append-only, idempotency
  id bigserial primary key,
  order_id uuid references orders(id),
  transaction_id text not null,
  status integer not null,
  order_number text not null,
  amount integer,
  outcome text not null,
  raw jsonb not null,
  received_at timestamptz not null default now(),
  unique (transaction_id, status)               -- ASSUMPTION: belum disahkan callback sebenar (ujian live RM2)
);

-- ---------- enrollment & kemajuan ----------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  course_id uuid not null references courses(id),
  order_id uuid references orders(id),
  stage text not null default 'enrolled' check (stage in
    ('enrolled','learning','final_mcq','part2_review','theory_passed','practical','completed')),
  access_ends_at timestamptz not null,
  cert_track text check (cert_track in ('theory','theory_practical')),
  identity_verified_at timestamptz, identity_verified_by uuid references profiles(id), identity_method text,
  energize_approved_at timestamptz, energize_approved_by uuid references profiles(id),
  approved_submission_id uuid,                  -- FK ditambah selepas submissions (di bawah)
  telegram_invite_link text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table public.lesson_progress (
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  lesson_id uuid not null references lessons(id),
  seconds_set jsonb not null default '[]'::jsonb,   -- ASSUMPTION: set saat unik; boleh tukar ke bitmap/bytea
  watched_seconds_unique integer not null default 0,
  last_heartbeat_at timestamptz,
  completed_at timestamptz,
  primary key (enrollment_id, lesson_id)
);

-- ---------- kuiz (kunci jawapan server sahaja) ----------
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  chapter_id uuid not null references chapters(id),
  type text not null check (type in ('practice','final')),
  body text not null,
  explanation text
);
create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions(id) on delete cascade,
  label text not null,
  body text not null,
  is_correct boolean not null default false
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  type text not null check (type in ('practice','final')),
  attempt_no integer not null,
  question_ids uuid[] not null,
  answers jsonb,
  score_pct numeric(5,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (enrollment_id, type, attempt_no)
);

-- ---------- penghantaran ----------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  enrollment_id uuid not null references enrollments(id),
  type text not null check (type in ('subjective','schematic','form','video')),
  file_key text,
  text_answer text,
  storage text not null default 'r2' check (storage in ('r2','external')),
  external_ref text,
  source text not null default 'lms' check (source in ('lms','manual_fasi')),
  declared_at timestamptz,
  received_at date,                             -- wajib bila source = manual_fasi
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  score numeric,
  comment text,
  attempt_no integer not null default 1,
  reviewer_id uuid references profiles(id),
  claimed_by uuid references profiles(id),
  claimed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (source <> 'manual_fasi' or (received_at is not null and reviewer_id is not null))
);
alter table public.enrollments
  add constraint enrollments_approved_submission_fk
  foreign key (approved_submission_id) references submissions(id);

-- ---------- sijil, refund, log ----------
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  enrollment_id uuid not null references enrollments(id),
  type text not null check (type in ('theory','theory_practical')),
  cert_id text not null unique,
  verify_token text not null unique default encode(gen_random_bytes(16),'hex'),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  pdf_key text
);

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  status text not null default 'requested' check (status in ('requested','auto_failed','letter_issued','letter_uploaded','approved','rejected','refunded')),
  signed_letter_key text,
  decided_by uuid references profiles(id),
  auto_check_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table public.material_access_log (
  id bigserial primary key,
  enrollment_id uuid not null references enrollments(id),
  material_id uuid not null references materials(id),
  accessed_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  type text not null,
  sent_at timestamptz not null default now(),
  unique (enrollment_id, type)
);

create table public.admin_actions (             -- append-only
  id bigserial primary key,
  actor_id uuid not null references profiles(id),
  action text not null check (action in ('manual_grant','extend_access','refund','refund_override','energize_approval','manual_submission')),
  enrollment_id uuid references enrollments(id),
  reason text,
  detail jsonb not null default '{}'::jsonb,    -- termasuk teks panduan keselamatan AHZ untuk energize_approval
  created_at timestamptz not null default now()
);
create function public.deny_mutation() returns trigger language plpgsql as
$$ begin raise exception '% is append-only', tg_table_name; end $$;
create trigger admin_actions_append_only before update or delete on public.admin_actions
  for each row execute function public.deny_mutation();
create trigger payment_events_append_only before update or delete on public.payment_events
  for each row execute function public.deny_mutation();

-- ---------- grants + RLS + policy ----------
-- Supabase beri default privileges ke anon/authenticated pada jadual baharu. Cabut dahulu supaya hanya grant eksplisit di bawah berkuat.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant execute on function public.is_staff(text) to authenticated;

-- Semua: service_role penuh. Klien: baca data sendiri sahaja. Tulisan pelajar melalui server (service_role).
do $$ declare t text; begin
  foreach t in array array['profiles','courses','course_sessions','chapters','lessons','materials','orders',
    'payment_events','enrollments','lesson_progress','quiz_questions','quiz_options','quiz_attempts','submissions',
    'certificates','refund_requests','material_access_log','reminders','admin_actions'] loop
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;

-- awam (landing)
grant select on public.courses, public.course_sessions to anon, authenticated;
create policy "public read courses" on public.courses for select to anon, authenticated using (true);
create policy "public read sessions" on public.course_sessions for select to anon, authenticated using (status <> 'draft');

-- kandungan: tajuk bab/pelajaran untuk pelajar berenrollment aktif. PDF key & video_ref diselit server; ASSUMPTION: video_ref dihidang server selepas semak akses
grant select on public.chapters to authenticated;
create policy "read chapters" on public.chapters for select to authenticated using (true);

-- profil sendiri
grant select, update (full_name, phone) on public.profiles to authenticated;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- baca data sendiri
grant select on public.orders, public.enrollments, public.lesson_progress, public.quiz_attempts,
  public.submissions, public.certificates, public.refund_requests to authenticated;
create policy "own orders" on public.orders for select to authenticated using (user_id = auth.uid() or public.is_staff('admin'));
create policy "own enrollments" on public.enrollments for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "own progress" on public.lesson_progress for select to authenticated using (
  exists (select 1 from enrollments e where e.id = enrollment_id and (e.user_id = auth.uid() or public.is_staff())));
create policy "own attempts" on public.quiz_attempts for select to authenticated using (
  exists (select 1 from enrollments e where e.id = enrollment_id and (e.user_id = auth.uid() or public.is_staff())));
create policy "own submissions" on public.submissions for select to authenticated using (
  exists (select 1 from enrollments e where e.id = enrollment_id and (e.user_id = auth.uid() or public.is_staff())));
create policy "own certificates" on public.certificates for select to authenticated using (
  exists (select 1 from enrollments e where e.id = enrollment_id and (e.user_id = auth.uid() or public.is_staff())));
create policy "own refunds" on public.refund_requests for select to authenticated using (
  exists (select 1 from enrollments e where e.id = enrollment_id and (e.user_id = auth.uid() or public.is_staff())));

-- staf sahaja
grant select on public.admin_actions, public.payment_events, public.material_access_log, public.reminders to authenticated;
create policy "staff admin_actions" on public.admin_actions for select to authenticated using (public.is_staff('admin'));
create policy "staff payment_events" on public.payment_events for select to authenticated using (public.is_staff('admin'));
create policy "staff access_log" on public.material_access_log for select to authenticated using (public.is_staff('admin'));
create policy "staff reminders" on public.reminders for select to authenticated using (public.is_staff('admin'));

-- TIADA grant klien: lessons, materials, quiz_questions, quiz_options (kunci jawapan, video_ref, r2_key = server sahaja)
-- Tiada policy untuk jadual ini bagi authenticated = ditolak sepenuhnya.

create index on public.enrollments (user_id);
create index on public.submissions (enrollment_id, type, status);
create index on public.submissions (status, claimed_at);
create index on public.orders (user_id);
create index on public.quiz_questions (course_id, type, chapter_id);
