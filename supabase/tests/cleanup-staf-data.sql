-- LOCAL sahaja: buang data ujian modul Staf (sf-*@test.local). admin_actions append-only dilangkau melalui session_replication_role (hanya DB local).
begin;
set local session_replication_role = replica;
delete from admin_actions where actor_id in (select id from auth.users where email like 'sf-%@test.local') or detail::text like any (array['%sf-%@test.local%']);
delete from staff_invites where email like 'sf-%@test.local';
commit;
begin;
delete from auth.users where email like 'sf-%@test.local';
commit;
