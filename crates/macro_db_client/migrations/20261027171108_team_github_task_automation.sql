-- Per-team switches for GitHub pull request events that move task status.
-- Absent row means every switch is on, which is the behavior before this table.
CREATE TABLE team_github_task_automation (
    team_id UUID PRIMARY KEY REFERENCES team (id) ON DELETE CASCADE,
    review_on_open BOOLEAN NOT NULL DEFAULT TRUE,
    complete_on_merge BOOLEAN NOT NULL DEFAULT TRUE,
    reset_on_close BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
