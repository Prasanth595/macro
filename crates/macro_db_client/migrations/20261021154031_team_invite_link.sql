-- A team's shareable invite link. Anyone signed in who holds the token can
-- join the team; a team has at most one link, and resetting it replaces the
-- token so links already shared stop working.
CREATE TABLE team_invite_link (
    team_id UUID PRIMARY KEY REFERENCES team (id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
