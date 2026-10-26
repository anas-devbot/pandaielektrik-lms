-- Slice 6: kuiz latihan per bab + MCQ akhir. SEMUA logik di fungsi security definer (service_role sahaja):
-- kunci jawapan (quiz_options.is_correct) tidak pernah dibaca atau dihantar ke klien; markah dikira di server.
-- Config (courses.config, wajib ada): mcq_count, pass_mark_mcq, max_mcq_attempts.

-- Gate MCQ akhir: setiap pelajaran kursus mesti selesai (video_complete_pct saat unik, sudah dikira record_heartbeat).
create function public.final_gate(p_enrollment uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'open', total > 0 and done = total,
    'videos_done', done, 'videos_total', total)
  from (
    select count(*)::int as total,
           count(lp.completed_at)::int as done
    from enrollments e
    join lessons l on l.course_id = e.course_id
    left join lesson_progress lp on lp.enrollment_id = e.id and lp.lesson_id = l.id
    where e.id = p_enrollment
  ) t
$$;

create function public.start_quiz(p_enrollment uuid, p_type text, p_chapter uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments; cfg jsonb; cnt integer; maxatt integer; att uuid; n integer; ids uuid[];
  cs uuid[]; av integer[]; qa integer[]; remaining integer; progressed boolean; i integer;
begin
  select * into e from enrollments where id = p_enrollment;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null or e.access_ends_at <= now() then raise exception 'access_closed'; end if;
  if p_type not in ('practice','final') then raise exception 'bad_type'; end if;
  select config into cfg from courses where id = e.course_id;

  -- satu percubaan terbuka pada satu masa: sambung yang sedia ada (soalan sama)
  select id into att from quiz_attempts
    where enrollment_id = p_enrollment and type = p_type and submitted_at is null
      and (p_type = 'final' or question_ids <@ array(select id from quiz_questions where chapter_id = p_chapter and type = 'practice'))
    order by started_at desc limit 1;
  if att is not null then return att; end if;

  if p_type = 'practice' then
    if p_chapter is null then raise exception 'chapter_required'; end if;
    select array_agg(id) into ids from quiz_questions where course_id = e.course_id and chapter_id = p_chapter and type = 'practice';
    if ids is null then raise exception 'no_questions'; end if;
  else
    cnt := (cfg->>'mcq_count')::int; maxatt := (cfg->>'max_mcq_attempts')::int;
    if cnt is null or maxatt is null or (cfg->>'pass_mark_mcq') is null then raise exception 'config_mcq_tiada'; end if;
    if not (final_gate(p_enrollment)->>'open')::boolean then raise exception 'gate_closed'; end if;
    if exists (select 1 from quiz_attempts where enrollment_id = p_enrollment and type = 'final' and passed) then raise exception 'already_passed'; end if;
    select count(*) into n from quiz_attempts where enrollment_id = p_enrollment and type = 'final' and submitted_at is not null;
    if n >= maxatt then raise exception 'attempts_exhausted'; end if;

    -- agihan seimbang ikut bab: bulat-bulat 1 soalan setiap bab sehingga cukup, bab yang kurang soalan beri baki kepada yang lain
    select array_agg(chapter_id), array_agg(c) into cs, av from (
      select chapter_id, count(*)::int c from quiz_questions where course_id = e.course_id and type = 'final' group by chapter_id order by random()) x;
    if cs is null or (select sum(a) from unnest(av) a) < cnt then raise exception 'bank_too_small'; end if;
    qa := array_fill(0, array[array_length(cs, 1)]); remaining := cnt;
    while remaining > 0 loop
      progressed := false;
      for i in 1..array_length(cs, 1) loop
        if remaining > 0 and qa[i] < av[i] then qa[i] := qa[i] + 1; remaining := remaining - 1; progressed := true; end if;
      end loop;
      exit when not progressed;
    end loop;
    -- elak soalan yang sudah dilihat dalam percubaan terdahulu (utamakan yang belum), rawak dalam bab
    select array_agg(qid) into ids from (
      select picked.id as qid from unnest(cs, qa) as w(ch, quota)
      cross join lateral (
        select q.id from quiz_questions q
        where q.course_id = e.course_id and q.type = 'final' and q.chapter_id = w.ch
        order by (q.id = any(coalesce((select array_agg(x) from quiz_attempts a, unnest(a.question_ids) x
                                        where a.enrollment_id = p_enrollment and a.type = 'final'), '{}'::uuid[]))) , random()
        limit w.quota) picked
    ) s;
    update enrollments set stage = 'final_mcq' where id = p_enrollment and stage in ('enrolled','learning');
  end if;

  select coalesce(max(attempt_no), 0) + 1 into n from quiz_attempts where enrollment_id = p_enrollment and type = p_type;
  insert into quiz_attempts (enrollment_id, type, attempt_no, question_ids) values (p_enrollment, p_type, n, ids) returning id into att;
  return att;
end $$;

-- Muatan untuk klien: soalan + pilihan TANPA is_correct. Susunan soalan dan pilihan diacak tetap (md5) per percubaan.
-- Selepas hantar: kuiz latihan menunjukkan jawapan + penjelasan; MCQ akhir TIDAK (elak bocor bank).
create function public.get_attempt(p_attempt uuid, p_enrollment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.quiz_attempts; reveal boolean; res jsonb;
begin
  select * into a from quiz_attempts where id = p_attempt and enrollment_id = p_enrollment;
  if a.id is null then raise exception 'not_found'; end if;
  reveal := a.submitted_at is not null and a.type = 'practice';
  if a.submitted_at is not null and a.type = 'final' then
    return jsonb_build_object('id', a.id, 'type', a.type, 'attempt_no', a.attempt_no, 'submitted', true,
      'score_pct', a.score_pct, 'passed', a.passed, 'questions', '[]'::jsonb);
  end if;
  select jsonb_build_object('id', a.id, 'type', a.type, 'attempt_no', a.attempt_no, 'submitted', a.submitted_at is not null,
    'score_pct', a.score_pct, 'passed', a.passed,
    'questions', coalesce(jsonb_agg(
      jsonb_build_object('id', q.id, 'chapter_id', q.chapter_id, 'body', q.body,
        'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'body', o.body) order by md5(a.id::text || o.id::text))
                    from quiz_options o where o.question_id = q.id))
      || case when reveal then jsonb_build_object(
           'explanation', q.explanation,
           'correct_option_id', (select o.id from quiz_options o where o.question_id = q.id and o.is_correct limit 1),
           'chosen_option_id', a.answers->>(q.id::text))
         else '{}'::jsonb end
      order by md5(a.id::text || q.id::text)), '[]'::jsonb))
  into res
  from quiz_questions q where q.id = any(a.question_ids);
  return res;
end $$;

create function public.submit_quiz(p_attempt uuid, p_enrollment uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.quiz_attempts; e public.enrollments; cfg jsonb; pass numeric; total integer; correct integer; score numeric; ok boolean; by_chapter jsonb;
begin
  select * into e from enrollments where id = p_enrollment;
  if e.id is null then raise exception 'no_enrollment'; end if;
  if e.refunded_at is not null or e.access_ends_at <= now() then raise exception 'access_closed'; end if;
  select * into a from quiz_attempts where id = p_attempt and enrollment_id = p_enrollment for update;
  if a.id is null then raise exception 'not_found'; end if;
  if a.submitted_at is not null then raise exception 'already_submitted'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'bad_answers'; end if;
  select config into cfg from courses where id = e.course_id;

  -- pilihan mesti milik soalan itu dan soalan mesti dalam percubaan ini; selain itu salah
  with graded as (
    select q.id as qid, q.chapter_id,
           coalesce((select o.is_correct from quiz_options o
                     where o.id::text = p_answers->>(q.id::text) and o.question_id = q.id), false) as is_right
    from quiz_questions q where q.id = any(a.question_ids))
  select count(*)::int, count(*) filter (where is_right)::int,
         jsonb_agg(jsonb_build_object('chapter_id', chapter_id, 'right', is_right))
  into total, correct, by_chapter from graded;

  score := round(100.0 * correct / total, 2);
  if a.type = 'final' then
    pass := (cfg->>'pass_mark_mcq')::numeric;
    if pass is null then raise exception 'config_mcq_tiada'; end if;
    ok := score >= pass;
  else ok := null; end if;

  update quiz_attempts set answers = p_answers, score_pct = score, passed = ok, submitted_at = now() where id = a.id;
  if a.type = 'final' and ok then
    update enrollments set stage = 'part2_review' where id = p_enrollment and stage in ('enrolled','learning','final_mcq');
  end if;
  return jsonb_build_object('type', a.type, 'score_pct', score, 'passed', ok, 'correct', correct, 'total', total,
    'by_chapter', (select jsonb_agg(jsonb_build_object('chapter_id', chapter_id, 'correct', cr, 'total', tt))
                   from (select (x->>'chapter_id')::uuid chapter_id, count(*) filter (where (x->>'right')::boolean) cr, count(*) tt
                         from jsonb_array_elements(by_chapter) x group by 1) z));
end $$;

do $$ declare f text; begin
  foreach f in array array['final_gate(uuid)','start_quiz(uuid,text,uuid)','get_attempt(uuid,uuid)','submit_quiz(uuid,uuid,jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
