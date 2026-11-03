-- Had gagal log masuk per emel. Hanya server (service_role) membaca dan menulis; pelajar dan anon tidak nampak langsung.
-- email_key = SHA-256 emel (huruf kecil), bukan emel mentah. Tetingkap dan kunci dikira di app (src/lib/login-throttle.ts).
create table public.login_attempts (
  email_key text primary key,
  failures integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.login_attempts enable row level security;
-- Supabase beri anon/authenticated kuasa tulis lalai pada jadual baharu: tarik balik secara eksplisit.
revoke all on public.login_attempts from anon, authenticated;
grant select, insert, update, delete on public.login_attempts to service_role;

create policy "service role sahaja" on public.login_attempts for all to service_role using (true) with check (true);
