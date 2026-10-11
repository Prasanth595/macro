-- Encrypted workspace configuration. Deleting its user/team removes credentials.
CREATE TABLE workspace_ai_providers (
    workspace_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,
    team_id UUID REFERENCES team(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL CHECK (revision > 0),
    configuration BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((user_id IS NOT NULL) <> (team_id IS NOT NULL)),
    CHECK (workspace_id = COALESCE(user_id, team_id::TEXT))
);
