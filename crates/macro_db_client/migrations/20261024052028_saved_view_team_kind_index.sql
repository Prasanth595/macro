-- no-transaction
CREATE INDEX CONCURRENTLY saved_view_team_kind_created_idx
    ON saved_view (shared_team_id, (config->>'kind'), created_at, id)
    WHERE shared_team_id IS NOT NULL;
