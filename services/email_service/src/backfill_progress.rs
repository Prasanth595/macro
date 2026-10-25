//! Counts a Gmail backfill job's progress: the messages backfilled in each
//! thread and the threads completed in the job.

use crate::util::redis::RedisClient;
use sqlx::PgPool;
use uuid::Uuid;


/// Snapshot of a backfill job's thread progress after an increment.
pub struct BackfillJobProgress {
    /// Number of threads completed so far, including this increment.
    pub completed_threads: i32,
    /// The job's target thread total — the denominator for progress. Includes
    /// the threads the priority pass added, which the normal sweep counts again;
    /// `completed_threads` is inflated to match, so the ratio holds.
    pub total_threads: i32,
    /// Whether every thread in the job has now been processed.
    pub job_complete: bool,
}

/// Adds the priority pass's extra BackfillThread messages to the job's total.
pub async fn add_priority_threads(
    _db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
    count: i32,
) -> anyhow::Result<()> {
    redis.add_to_total_threads(job_id, count).await
}

/// Counts one completed thread.
pub async fn incr_completed_threads(
    _db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
) -> anyhow::Result<BackfillJobProgress> {
    redis.incr_completed_threads(job_id).await
}

/// Starts counting the messages being backfilled for one thread.
pub async fn init_thread_progress(
    _db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
    _thread_id: Uuid,
    thread_provider_id: &str,
    total_messages: i32,
) -> anyhow::Result<()> {
    redis
        .init_backfill_thread_progress(job_id, thread_provider_id, total_messages)
        .await
}

/// Counts one processed message and returns whether it completed its thread.
pub async fn incr_completed_messages(
    _db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
    _thread_id: Uuid,
    thread_provider_id: &str,
) -> anyhow::Result<bool> {
    redis
        .incr_completed_messages(job_id, thread_provider_id)
        .await
}

/// Drops the progress of a job that failed, was cancelled or completed.
pub async fn clear_job(_db: &PgPool, redis: &RedisClient, job_id: Uuid) {
    let _ = redis.delete_backfill_job_progress(job_id).await;
}
