SET LOCAL lock_timeout = '2s';
-- The validated check lets PostgreSQL skip a table scan while taking this lock.
ALTER TABLE team_user ALTER COLUMN membership_id SET NOT NULL;
ALTER TABLE team_user DROP CONSTRAINT team_user_membership_id_not_null;
