-- Ujian katalog kursus (migration 20261113000005). Dalam transaksi dan di-rollback: tiada data kekal.
-- Guna: psql -v ON_ERROR_STOP=1 -f supabase/tests/katalog.sql
begin;
do $$
declare
  kid uuid; ada_admin uuid; n int; gagal boolean;
begin
  -- 1) kursus DIY dipaparkan dan CTA daftar
  select count(*) into n from courses where slug = 'kursus-elektrik' and published and cta = 'daftar';
  if n <> 1 then raise exception 'DIY tidak dipaparkan/cta salah (%)', n; end if;

  -- 2) kursus draf wujud, tapi awam tak nampak
  insert into courses (slug, title, price, cta, published, config) values ('uji-draf-katalog', 'Uji draf', 1000, 'whatsapp', false, '{}') returning id into kid;
  set local role anon;
  select count(*) into n from courses where slug = 'uji-draf-katalog';
  reset role;
  if n <> 0 then raise exception 'kursus draf kelihatan kepada anon (%)', n; end if;

  -- 3) kursus dipaparkan kelihatan kepada anon
  update courses set published = true where id = kid;
  set local role anon;
  select count(*) into n from courses where slug = 'uji-draf-katalog';
  reset role;
  if n <> 1 then raise exception 'kursus dipaparkan tak kelihatan kepada anon (%)', n; end if;

  -- 4) sesi draf tak kelihatan kepada anon walaupun kursus dipaparkan
  insert into course_sessions (course_id, starts_at, status) values (kid, now() + interval '5 days', 'draft');
  set local role anon;
  select count(*) into n from course_sessions where course_id = kid;
  reset role;
  if n <> 0 then raise exception 'sesi draf kelihatan kepada anon (%)', n; end if;

  -- 5) RPC: pelaku bukan admin ditolak
  begin
    perform upsert_course_catalog('00000000-0000-0000-0000-000000000000'::uuid, null, 'Kursus Uji', 'kursus-uji', null, 1000, 'whatsapp', 'https://chat.whatsapp.com/ABC', true, null);
    gagal := false;
  exception when others then gagal := true; end;
  if not gagal then raise exception 'RPC menerima pelaku bukan admin'; end if;

  -- 6) RPC: URL WhatsApp tak sah ditolak (pengesahan sebelum admin check tak perlu; guna admin sebenar jika ada)
  select id into ada_admin from profiles where role = 'admin' limit 1;
  if ada_admin is not null then
    begin
      perform upsert_course_catalog(ada_admin, null, 'Kursus Uji', 'kursus-uji', null, 1000, 'whatsapp', 'http://bukan-wa.example', true, null);
      gagal := false;
    exception when others then gagal := true; end;
    if not gagal then raise exception 'URL bukan WhatsApp diterima'; end if;
  end if;

  -- 7) anon tak boleh panggil RPC
  begin
    set local role anon;
    perform upsert_course_catalog('00000000-0000-0000-0000-000000000000'::uuid, null, 'Kursus Uji', 'kursus-uji', null, 1000, 'whatsapp', 'https://chat.whatsapp.com/ABC', true, null);
    gagal := false;
  exception when others then gagal := true; reset role; end;
  if not gagal then raise exception 'anon boleh panggil upsert_course_catalog'; end if;
  reset role;

  raise notice 'katalog: semua ujian lulus';
end $$;
rollback;
