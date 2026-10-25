-- Backfill progress moves from Redis, which can restart empty, to Postgres.
-- completed_threads is NULL for jobs initialized before this change; those
-- keep counting in Redis until they finish.
ALTER TABLE email_backfill_jobs
    ADD COLUMN completed_threads integer,
    -- BackfillThread messages the priority pass adds on top of total_threads:
    -- the normal sweep counts those threads again.
    ADD COLUMN priority_threads integer NOT NULL DEFAULT 0;

-- One row per thread whose messages are still being backfilled. A row is
-- deleted when the thread's last message is counted; rows left by a failed or
-- cancelled job are deleted when its remaining operations are dropped.
CREATE TABLE email_backfill_thread_progress (
    backfill_job_id uuid NOT NULL REFERENCES email_backfill_jobs (id) ON DELETE CASCADE,
    thread_id uuid NOT NULL,
    total_messages integer NOT NULL,
    completed_messages integer NOT NULL DEFAULT 0,
    PRIMARY KEY (backfill_job_id, thread_id)
);
