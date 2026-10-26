-- LOCAL sahaja: buang data ujian slice 6 (qz-*@test.local, bab QZBAB-*) dan pulihkan mcq_count seed (40).
begin;
delete from quiz_attempts where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'qz-%@test.local');
delete from lesson_progress where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'qz-%@test.local');
delete from enrollments where user_id in (select id from auth.users where email like 'qz-%@test.local');
delete from quiz_options where question_id in (select id from quiz_questions where chapter_id in (select id from chapters where title like 'QZBAB-%'));
delete from quiz_questions where chapter_id in (select id from chapters where title like 'QZBAB-%');
delete from lessons where chapter_id in (select id from chapters where title like 'QZBAB-%') or title like 'QZL-%';
delete from chapters where title like 'QZBAB-%';
delete from auth.users where email like 'qz-%@test.local';
update courses set config = jsonb_set(config, '{mcq_count}', '40') where slug = 'kursus-elektrik';
commit;
