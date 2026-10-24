-- no-transaction
-- Use PGOPTIONS='-c lock_timeout=2s' when running migrations.
CREATE UNIQUE INDEX CONCURRENTLY team_user_membership_id_idx ON team_user (membership_id);
