-- Who started the session: a person, or a routine's unattended run. Routine
-- runs stay out of Home and the default Agents list, and their finished turns
-- notify nobody.
SET LOCAL lock_timeout = '5s';
ALTER TABLE agent_session ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user';
