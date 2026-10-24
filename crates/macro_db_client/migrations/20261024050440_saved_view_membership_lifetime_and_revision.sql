-- Add the column without a volatile default to avoid rewriting team_user.
-- Install the default before releasing the lock so old writers can omit it.
SET LOCAL lock_timeout = '2s';
ALTER TABLE team_user ADD COLUMN membership_id uuid;
ALTER TABLE team_user ALTER COLUMN membership_id SET DEFAULT gen_random_uuid();

ALTER TABLE saved_view ADD COLUMN revision bigint NOT NULL DEFAULT 1;
ALTER TABLE saved_view ADD COLUMN shared_team_id uuid;
ALTER TABLE saved_view ADD COLUMN shared_owner_membership_id uuid;
ALTER TABLE saved_view ADD CONSTRAINT saved_view_shared_team_id_fkey
    FOREIGN KEY (shared_team_id) REFERENCES team(id) ON DELETE SET NULL NOT VALID;
-- Team deletion clears only shared_team_id. A null team never grants access,
-- even if the old lifetime ID remains after deletion.
ALTER TABLE saved_view ADD CONSTRAINT saved_view_share_pair CHECK (
    shared_team_id IS NULL OR shared_owner_membership_id IS NOT NULL
) NOT VALID;
