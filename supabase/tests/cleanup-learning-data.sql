-- LOCAL sahaja: buang data ujian slice 5 (lr-*@test.local, bab LRBAB-*).
begin;
delete from material_access_log where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'lr-%@test.local');
delete from lesson_progress where enrollment_id in (select e.id from enrollments e join auth.users u on u.id=e.user_id where u.email like 'lr-%@test.local');
delete from enrollments where user_id in (select id from auth.users where email like 'lr-%@test.local');
delete from materials where chapter_id in (select id from chapters where title like 'LRBAB-%');
delete from lessons where chapter_id in (select id from chapters where title like 'LRBAB-%');
delete from chapters where title like 'LRBAB-%';
delete from auth.users where email like 'lr-%@test.local';  -- profil mengikut cascade
commit;
