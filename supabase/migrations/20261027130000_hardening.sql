-- Audit keselamatan Pintu 1: anon/authenticated tidak perlu USAGE pada certificate_seq (hanya fungsi security definer service_role menjana nombor sijil).
revoke all on sequence public.certificate_seq from public, anon, authenticated;
grant usage, select on sequence public.certificate_seq to service_role;
