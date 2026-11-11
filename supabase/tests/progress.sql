-- Ujian kemajuan video (saat unik). ROLLBACK di hujung.
-- Jalankan: docker exec -i supabase_db_pandaielektrik psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/progress.sql
begin;
create function pg_temp.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'GAGAL %: dapat %, mahu %', label, got, want; end if; raise notice 'lulus: %', label; end $$;
create function pg_temp.fails(label text, sql text, want text) returns void language plpgsql as $$
begin
  begin execute sql; raise exception 'GAGAL %: tidak ditolak', label;
  exception when others then
    if sqlerrm like 'GAGAL%' then raise; end if;
    if sqlerrm <> want then raise exception 'GAGAL %: ralat % (mahu %)', label, sqlerrm, want; end if;
    raise notice 'lulus: %', label;
  end;
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v-a@t.local','{"privacy_accepted":true,"full_name":"Ujian Pelajar","phone":"0123456789"}');
insert into courses (id, slug, title, price, config) values
  ('cccccccc-0000-0000-0000-0000000000c1','vt','VT',14900,'{"video_complete_pct":0.9}'),
  ('cccccccc-0000-0000-0000-0000000000c2','vt-nocfg','VT2',14900,'{}');
insert into chapters (id, course_id, position, title) values
  ('bbbbbbbb-0000-0000-0000-0000000000b1','cccccccc-0000-0000-0000-0000000000c1',1,'B1'),
  ('bbbbbbbb-0000-0000-0000-0000000000b2','cccccccc-0000-0000-0000-0000000000c2',1,'B2');
insert into lessons (id, course_id, chapter_id, position, title, video_ref, duration_seconds) values
  ('11111111-0000-0000-0000-0000000000f1','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',1,'L1','v1',600),
  ('11111111-0000-0000-0000-0000000000f2','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',2,'L2','v2',600),
  ('11111111-0000-0000-0000-0000000000f3','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',3,'L3','v3',600),
  ('11111111-0000-0000-0000-0000000000f4','cccccccc-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-0000000000b1',4,'L4','v4',600),
  ('11111111-0000-0000-0000-0000000000f9','cccccccc-0000-0000-0000-0000000000c2','bbbbbbbb-0000-0000-0000-0000000000b2',1,'L9','v9',600);
insert into enrollments (id, user_id, course_id, access_ends_at) values
  ('eeeeeeee-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000c1', timestamptz '2027-01-01'),
  ('eeeeeeee-0000-0000-0000-0000000000e2','aaaaaaaa-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000c2', timestamptz '2027-01-01');

create function pg_temp.hb(lesson text, pos int, at_sec int) returns jsonb language sql as $$
  select record_heartbeat('eeeeeeee-0000-0000-0000-0000000000e1', ('11111111-0000-0000-0000-0000000000'||lesson)::uuid, pos, timestamptz '2026-12-01 00:00:00+00' + at_sec * interval '1 second') $$;
create function pg_temp.w(lesson text) returns text language sql as $$
  select watched_seconds_unique::text from lesson_progress where lesson_id = ('11111111-0000-0000-0000-0000000000'||lesson)::uuid $$;

-- 1. main biasa: heartbeat tiap 5s, kedudukan +5 -> ~1 saat dikira per saat dinding
select pg_temp.hb('f1', 0, 0);
select pg_temp.eq('heartbeat pertama = 1 saat', pg_temp.w('f1'), '1');
do $$ begin for i in 1..20 loop perform pg_temp.hb('f1', i*5, i*5); end loop; end $$;
select pg_temp.eq('main biasa 100s = 101 saat unik', pg_temp.w('f1'), '101');
-- main semula (rewind) tidak menggandakan
select pg_temp.hb('f1', 0, 105);
do $$ begin for i in 1..20 loop perform pg_temp.hb('f1', i*5, 105 + i*5); end loop; end $$;
select pg_temp.eq('main kali ke-2 saat sama kekal 101', pg_temp.w('f1'), '101');

-- 2. skip ke hujung: tidak menambah saat
select pg_temp.hb('f2', 0, 0); select pg_temp.hb('f2', 5, 5);
select pg_temp.hb('f2', 590, 10);
select pg_temp.eq('skip 5 -> 590 dalam 5s: +1 sahaja (6 -> 7, bukan 585)', pg_temp.w('f2'), '7');
select pg_temp.eq('skip tidak menanda selesai', (select (completed_at is not null)::text from lesson_progress where lesson_id='11111111-0000-0000-0000-0000000000f2'), 'false');

-- 3. heartbeat palsu terlalu kerap diabaikan
select pg_temp.hb('f3', 0, 0); select pg_temp.hb('f3', 1, 1);
select pg_temp.eq('heartbeat < 2s diabaikan', pg_temp.w('f3'), '1');
-- hantar kedudukan tinggi dengan masa singkat: tidak dikredit
select pg_temp.hb('f3', 300, 6);
select pg_temp.eq('lompat 300s selepas 6s: +1', pg_temp.w('f3'), '2');

-- 4. 2x sah: +10 kedudukan per 5s
select pg_temp.hb('f4', 0, 0);
do $$ begin for i in 1..20 loop perform pg_temp.hb('f4', i*10, i*5); end loop; end $$;
select pg_temp.eq('2x: 200 saat dalam 100s dikira (201)', pg_temp.w('f4'), '201');
-- 3x ditolak (dikreditkan sebagai lompat, bukan julat)
select pg_temp.hb('f4', 215, 105);   -- +15 dalam 5s = 3x, melebihi 2*5+2=12
select pg_temp.eq('3x tidak dikira julat (hanya saat semasa)', pg_temp.w('f4'), '202');

-- 5. selesai pada 90% dan tak boleh dicapai dengan masa terlalu singkat
select pg_temp.hb('f1', 600, 400);  -- reset kedudukan terakhir ke hujung (tak kredit julat)
do $$ declare i int; begin
  -- f1 ada 101 saat. Teruskan main dari 100 hingga 599 pada kelajuan 1x
  perform pg_temp.hb('f1', 100, 500);
  for i in 1..99 loop perform pg_temp.hb('f1', 100 + i*5, 500 + i*5); end loop;
end $$;
select pg_temp.eq('selesai pada >= 90% saat unik', (select (completed_at is not null)::text from lesson_progress where lesson_id='11111111-0000-0000-0000-0000000000f1'), 'true');

-- 6. kedudukan di luar julat dipagar
select pg_temp.fails('lesson bukan milik kursus ditolak',
  $q$select record_heartbeat('eeeeeeee-0000-0000-0000-0000000000e2','11111111-0000-0000-0000-0000000000f1',1)$q$, 'no_lesson');
select pg_temp.eq('kedudukan luar julat dipagar (<= d-1)', (pg_temp.hb('f2', 99999, 1000)->>'duration'), '600');
select pg_temp.fails('config video_complete_pct tiada = ralat',
  $q$select record_heartbeat('eeeeeeee-0000-0000-0000-0000000000e2','11111111-0000-0000-0000-0000000000f9',1)$q$, 'courses.config.video_complete_pct tiada');

-- 7. akses tamat / refund menutup heartbeat
update enrollments set access_ends_at = timestamptz '2026-12-01 00:00:00+00' where id='eeeeeeee-0000-0000-0000-0000000000e1';
select pg_temp.fails('akses tamat = ditolak', $q$select pg_temp.hb('f3', 10, 2000)$q$, 'access_closed');
update enrollments set access_ends_at = timestamptz '2027-01-01', refunded_at = now() where id='eeeeeeee-0000-0000-0000-0000000000e1';
select pg_temp.fails('refunded = ditolak', $q$select pg_temp.hb('f3', 10, 2000)$q$, 'access_closed');

-- 8. klien tak boleh panggil, tak boleh baca bitmap orang lain
set local role authenticated;
select pg_temp.fails('authenticated tak boleh record_heartbeat', $q$select record_heartbeat(gen_random_uuid(), gen_random_uuid(), 1)$q$, 'permission denied for function record_heartbeat');
rollback;
