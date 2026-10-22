-- Who started the session (a person, or a routine's unattended run), and
-- whether it is listed. Unlisted sessions stay out of Home and the default
-- Agents list; a routine's setting decides it for each of its runs.
SET LOCAL lock_timeout = '5s';
ALTER TABLE agent_session
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'listed';
