-- People can bring their own Anthropic and OpenAI keys too, not just teams:
-- a provider row other than Cursor now belongs to either a user or a team.
--
-- `(user_id, provider)` becomes the per-user key. `cursor_configs_user_id_key`
-- stays for now: the deployed Cursor code upserts with `ON CONFLICT (user_id)`
-- and needs it. Until a later migration drops it, a user with a Cursor key
-- cannot also store a personal provider key.
SET LOCAL lock_timeout = '5s';

ALTER TABLE cursor_configs DROP CONSTRAINT cursor_configs_owner;
ALTER TABLE cursor_configs ADD CONSTRAINT cursor_configs_owner CHECK (
    CASE provider
        WHEN 'cursor' THEN user_id IS NOT NULL AND team_id IS NULL
        ELSE (user_id IS NULL) <> (team_id IS NULL)
    END
);

ALTER TABLE cursor_configs
    ADD CONSTRAINT cursor_configs_user_provider_key UNIQUE (user_id, provider);
