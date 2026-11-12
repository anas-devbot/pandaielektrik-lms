-- Ujian RLS: pelajar A tak boleh baca data pelajar B. Semua dalam transaksi, ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/rls.sql
begin;
\set a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set b '''bbbbbbbb-0000-0000-0000-000000000002'''
-- profil dicipta oleh trigger handle_new_user (slice 3)
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  (:a, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.local','{"full_name":"A","privacy_accepted":true,"phone":"0123456789"}'),
  (:b, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@test.local','{"full_name":"B","privacy_accepted":true,"phone":"0123456789"}');
insert into courses (slug,title,price) values ('t','T',14900);
insert into chapters (course_id,position,title) select id,1,'Bab 1' from courses where slug='t';
insert into lessons (course_id,chapter_id,position,title,video_ref,duration_seconds)
  select c.id, ch.id, 1, 'L1', 'vid', 600 from courses c join chapters ch on ch.course_id=c.id where c.slug='t';
insert into quiz_questions (course_id,chapter_id,type,body)
  select c.id, ch.id, 'final', 'Q?' from courses c join chapters ch on ch.course_id=c.id where c.slug='t';
insert into orders (user_id,course_id,order_number,amount,terms_accepted_at)
  select u, c.id, 'ORD-'||u::text, 14900, now() from courses c, (values (:a::uuid),(:b::uuid)) v(u) where c.slug='t';
insert into enrollments (user_id,course_id,access_ends_at)
  select u, c.id, now()+interval '6 months' from courses c, (values (:a::uuid),(:b::uuid)) v(u) where c.slug='t';
insert into submissions (course_id,enrollment_id,type,text_answer)
  select course_id, id, 'subjective', 'jawapan '||user_id::text from enrollments;
insert into certificates (course_id,enrollment_id,type,cert_id)
  select course_id, id, 'theory', 'C-'||user_id::text from enrollments;
insert into admin_actions (actor_id, action) values (:a, 'manual_grant');

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as
$$ begin if got <> want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if;
  raise notice 'lulus: %', label; end $$;

-- log masuk sebagai pelajar A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-0000-0000-0000-000000000001','role','authenticated')::text, true);

select pg_temp.expect('A nampak 1 enrollment sendiri', (select count(*) from enrollments), 1);
select pg_temp.expect('A tak nampak enrollment B', (select count(*) from enrollments where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0);
select pg_temp.expect('A nampak 1 order sendiri', (select count(*) from orders), 1);
select pg_temp.expect('A nampak 1 submission sendiri', (select count(*) from submissions), 1);
select pg_temp.expect('A nampak 1 sijil sendiri', (select count(*) from certificates), 1);
select pg_temp.expect('A nampak 1 profil sendiri', (select count(*) from profiles), 1);
select pg_temp.expect('A tak nampak admin_actions', (select count(*) from admin_actions), 0);

-- A tak boleh ubah/padam/sisip data B atau data sendiri yang dilarang
do $$ declare n int; begin
  update profiles set full_name='X' where id='bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'GAGAL: A boleh update profil B'; end if;
  raise notice 'lulus: A tak boleh update profil B';
end $$;

do $$ begin
  begin perform 1 from lessons; raise exception 'GAGAL: A boleh baca lessons';
  exception when insufficient_privilege then raise notice 'lulus: A tak boleh baca lessons'; end;
  begin perform 1 from quiz_options; raise exception 'GAGAL: A boleh baca quiz_options (kunci jawapan)';
  exception when insufficient_privilege then raise notice 'lulus: A tak boleh baca quiz_options'; end;
  begin perform 1 from quiz_questions; raise exception 'GAGAL: A boleh baca quiz_questions';
  exception when insufficient_privilege then raise notice 'lulus: A tak boleh baca quiz_questions'; end;
  begin perform 1 from materials; raise exception 'GAGAL: A boleh baca materials';
  exception when insufficient_privilege then raise notice 'lulus: A tak boleh baca materials'; end;
  begin update enrollments set stage='completed'; raise exception 'GAGAL: A boleh update enrollments';
  exception when insufficient_privilege then raise notice 'lulus: A tak boleh update enrollments'; end;
  begin insert into orders (user_id,course_id,order_number,amount,terms_accepted_at)
    select user_id, course_id, 'HACK', 1, now() from enrollments limit 1; raise exception 'GAGAL: A boleh sisip order';
  exception when insufficient_privilege then raise notice 'lulus: A tak boleh sisip order (harga server sahaja)'; end;
  begin insert into payment_events (transaction_id,status,order_number,outcome,raw) values ('t',3,'x','x','{}'); raise exception 'GAGAL: A boleh sisip payment_events';
  exception when insufficient_privilege then raise notice 'lulus: A tak boleh sisip payment_events'; end;
end $$;

-- anon: tiada data peribadi
reset role; set local role anon;
do $$ begin
  begin perform 1 from enrollments; raise exception 'GAGAL: anon boleh baca enrollments';
  exception when insufficient_privilege then raise notice 'lulus: anon tak boleh baca enrollments'; end;
end $$;
reset role; update courses set published = true where slug='t';   -- kursus dipaparkan (migration 20261113000005)
set local role anon;
select pg_temp.expect('anon nampak kursus (landing)', (select count(*) from courses where slug='t'), 1);

-- service_role: append-only dikuat
reset role; set local role service_role;
do $$ begin
  begin delete from admin_actions; raise exception 'GAGAL: admin_actions boleh dipadam';
  exception when raise_exception then if sqlerrm like 'GAGAL%' then raise; end if; raise notice 'lulus: admin_actions append-only'; end;
end $$;

-- audit Pintu 1: invarian global (gagal jika jadual/fungsi baharu terlepas dikunci)
reset role;
do $$ declare n integer; begin
  select count(*) into n from pg_tables where schemaname='public' and not rowsecurity;
  if n > 0 then raise exception 'GAGAL: % jadual public tanpa RLS', n; end if; raise notice 'lulus: semua jadual public ada RLS';
  select count(*) into n from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type <> 'SELECT';
  if n > 0 then raise exception 'GAGAL: anon/authenticated ada kuasa tulis pada % jadual', n; end if; raise notice 'lulus: anon/authenticated hanya SELECT pada jadual (tulis melalui server)';
  select count(*) into n from information_schema.role_table_grants where table_schema='public' and grantee='anon' and table_name not in ('courses','course_sessions');
  if n > 0 then raise exception 'GAGAL: anon boleh baca jadual selain landing'; end if; raise notice 'lulus: anon hanya boleh baca courses + course_sessions';
  select count(*) into n from pg_proc p join pg_roles r on has_function_privilege(r.oid, p.oid, 'execute') where p.pronamespace='public'::regnamespace and r.rolname in ('anon','authenticated') and p.proname not in ('is_staff','deny_mutation');
  if n > 0 then raise exception 'GAGAL: % fungsi public boleh dipanggil klien', n; end if; raise notice 'lulus: tiada fungsi public (selain is_staff) boleh dipanggil anon/authenticated';
  select count(*) into n from pg_proc where pronamespace='public'::regnamespace and prosecdef and (proconfig is null or not exists (select 1 from unnest(proconfig) c where c like 'search_path=%'));
  if n > 0 then raise exception 'GAGAL: % fungsi security definer tanpa search_path', n; end if; raise notice 'lulus: semua security definer tetapkan search_path';
  if has_sequence_privilege('authenticated', 'public.certificate_seq', 'usage') or has_sequence_privilege('anon', 'public.certificate_seq', 'usage') then raise exception 'GAGAL: klien boleh nextval certificate_seq'; end if;
  raise notice 'lulus: klien tak boleh nextval certificate_seq';
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'update') then raise exception 'GAGAL: pelajar boleh ubah profiles.role'; end if;
  raise notice 'lulus: pelajar tak boleh ubah profiles.role';
end $$;

rollback;
