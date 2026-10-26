-- Slice 3: profil dicipta automatik bila auth.users dicipta; persetujuan privasi dikuat di DB.
-- Pelajar: mesti hantar raw_user_meta_data.privacy_accepted = true (panggilan terus ke API auth pun tertakluk).
--   Peranan SENTIASA student; raw_user_meta_data dikawal pengguna jadi tidak dipercayai.
-- Staf: admin (service_role) daftar emel + peranan dalam staff_invites dahulu. Trigger padankan emel semasa
--   akaun dicipta. (app_metadata tak boleh dipakai: GoTrue mengisinya SELEPAS baris dimasukkan.)

alter table public.profiles add column privacy_version text;

create table public.staff_invites (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('reviewer','approver','admin')),
  created_at timestamptz not null default now()
);
alter table public.staff_invites enable row level security;
grant select, insert, update, delete on public.staff_invites to service_role;
revoke all on public.staff_invites from anon, authenticated;
-- tiada policy untuk anon/authenticated: tertutup sepenuhnya

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invite public.staff_invites;
  accepted boolean := coalesce(new.raw_user_meta_data->>'privacy_accepted', '') = 'true';
begin
  delete from public.staff_invites where email = lower(new.email) returning * into invite;
  if invite.email is null and not accepted then
    raise exception 'privacy_not_accepted' using errcode = 'P0001';
  end if;
  insert into public.profiles (id, full_name, role, privacy_accepted_at, privacy_version)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce(invite.role, 'student'),
    case when accepted then now() end,
    case when accepted then new.raw_user_meta_data->>'privacy_version' end
  );
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
