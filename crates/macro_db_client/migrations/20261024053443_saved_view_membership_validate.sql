SET LOCAL lock_timeout = '2s';
ALTER TABLE team_user VALIDATE CONSTRAINT team_user_membership_id_not_null;
ALTER TABLE saved_view VALIDATE CONSTRAINT saved_view_share_pair;
ALTER TABLE saved_view VALIDATE CONSTRAINT saved_view_shared_team_id_fkey;
