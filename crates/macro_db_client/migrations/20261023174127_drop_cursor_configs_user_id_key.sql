-- Drop the per-user unique key the pre-personal-key Cursor code upserted on
-- (`ON CONFLICT (user_id)`). Every deployed writer now conflicts on
-- `(user_id, provider)`, so a user can hold a Cursor key and their own
-- Anthropic and OpenAI keys at once.
SET LOCAL lock_timeout = '5s';

ALTER TABLE cursor_configs DROP CONSTRAINT cursor_configs_user_id_key;
