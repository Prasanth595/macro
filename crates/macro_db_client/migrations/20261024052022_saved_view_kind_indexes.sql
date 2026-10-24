-- no-transaction
CREATE INDEX CONCURRENTLY saved_view_owner_kind_created_idx
    ON saved_view (user_id, (config->>'kind'), created_at, id);
