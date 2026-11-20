-- B9: tandakan akaun ujian sebagai affiliate DILULUSKAN dengan is_test = true (komisen ujian tidak masuk bayaran sebenar).
-- Dijalankan MANUAL, SELEPAS migration affiliate (B1..B8b) berada di persekitaran sasaran. Produksi: pg_dump dahulu.
-- Parameter (wajib, dihantar sebagai -v):
--   email  : emel akaun ujian (mesti wujud dalam auth.users)
--   actor  : profiles.id admin yang meluluskan (dicatat dalam admin_actions)
-- Contoh:  psql "<URL pangkalan>" -X -v ON_ERROR_STOP=1 -v email='...' -v actor='<uuid>' -f scripts/affiliate-uji.sql
-- Idempotent: sudah lulus sebagai ujian = tiada perubahan. Affiliate sedia ada yang BUKAN ujian = berhenti (tiada tukar senyap).
-- Pembeli ujian MESTI emel lain. Gmail menganggap planetrizq+uji@ dan planetrizq@ sama (self-referral).

select set_config('b9.email', :'email', false), set_config('b9.actor', :'actor', false);

do $$
declare
  uid uuid;
  aff public.affiliates;
begin
  select id into uid from auth.users where email = current_setting('b9.email');
  if uid is null then raise exception 'emel_tidak_dijumpai'; end if;
  if not exists (select 1 from profiles where id = current_setting('b9.actor')::uuid and role = 'admin') then
    raise exception 'actor_not_admin';
  end if;

  select * into aff from affiliates where user_id = uid;
  if aff.id is not null then
    if not aff.is_test then raise exception 'affiliate_sedia_ada_bukan_ujian'; end if;
    if aff.status = 'approved' then raise notice 'sudah diluluskan sebagai ujian: tiada perubahan'; return; end if;
  else
    insert into affiliates (user_id, code, status, rate_pct, is_test)
      values (uid, 'UJIAFF', 'pending', 20, true)   -- rate_pct disegarkan oleh affiliate_set_status dari config
      returning * into aff;
  end if;

  perform affiliate_set_status(current_setting('b9.actor')::uuid, aff.id, 'approved',
    'Akaun ujian (B9): is_test, komisen tidak masuk bayaran sebenar');
  raise notice 'diluluskan sebagai affiliate ujian: %', aff.id;
end $$;

select a.code, a.status, a.is_test, a.rate_pct
from affiliates a join auth.users u on u.id = a.user_id
where u.email = :'email';
