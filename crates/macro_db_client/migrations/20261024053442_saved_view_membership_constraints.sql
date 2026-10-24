SET LOCAL lock_timeout = '2s';
ALTER TABLE team_user ADD CONSTRAINT team_user_membership_id_not_null
    CHECK (membership_id IS NOT NULL) NOT VALID;
