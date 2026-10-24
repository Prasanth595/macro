-- no-transaction
-- Copies of one meeting are paired by `calendar_meeting_uid(ical_uid)`, which an
-- index on the raw UID cannot serve.
CREATE INDEX CONCURRENTLY IF NOT EXISTS calendar_events_meeting_uid_idx
    ON calendar_events (calendar_meeting_uid(ical_uid));
