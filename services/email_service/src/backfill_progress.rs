//! Counts a Gmail backfill job's progress: the messages backfilled in each
//! thread and the threads completed in the job.
//!
//! Progress lives in Postgres so a Redis restart can't strand a job. Jobs
//! initialized before that keep counting in Redis until they finish, and so do
//! workers still running a build from before it; the Redis paths below exist
//! only for them.

use crate::util::redis::RedisClient;
use email_db_client::backfill::progress;
use sqlx::PgPool;
use uuid::Uuid;

#[cfg(test)]
mod test;

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

/// Makes workers from before the move to Postgres fail this job's operations
/// retryably instead of counting them in Redis. Call before the job is
/// initialized; best effort, since it only matters while such workers run.
pub async fn fence_redis_counting(redis: &RedisClient, job_id: Uuid) {
    if let Err(error) = redis.fence_backfill_job_progress(job_id).await {
        tracing::warn!(error = ?error, %job_id, "failed to fence Redis backfill progress");
    }
}

/// Adds the priority pass's extra BackfillThread messages to the job's total.
pub async fn add_priority_threads(
    db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
    count: i32,
) -> anyhow::Result<()> {
    if progress::add_priority_threads(db, job_id, count).await? {
        return Ok(());
    }
    redis.add_to_total_threads(job_id, count).await
}

/// Counts one completed thread.
pub async fn incr_completed_threads(
    db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
) -> anyhow::Result<BackfillJobProgress> {
    match progress::incr_completed_threads(db, job_id).await? {
        Some(progress) => Ok(BackfillJobProgress {
            completed_threads: progress.completed_threads,
            total_threads: progress.total_threads,
            job_complete: progress.completed_threads >= progress.total_threads,
        }),
        None => redis.incr_completed_threads(job_id).await,
    }
}

/// Starts counting the messages being backfilled for one thread.
pub async fn init_thread_progress(
    db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
    thread_id: Uuid,
    thread_provider_id: &str,
    total_messages: i32,
) -> anyhow::Result<()> {
    if progress::init_thread_progress(db, job_id, thread_id, total_messages).await? {
        return Ok(());
    }
    redis
        .init_backfill_thread_progress(job_id, thread_provider_id, total_messages)
        .await
}

/// Counts one processed message and returns whether it completed its thread.
/// A message whose thread is tracked nowhere completed earlier and was
/// redelivered, so it doesn't complete the thread again.
pub async fn incr_completed_messages(
    db: &PgPool,
    redis: &RedisClient,
    job_id: Uuid,
    thread_id: Uuid,
    thread_provider_id: &str,
) -> anyhow::Result<bool> {
    match progress::incr_completed_messages(db, job_id, thread_id).await? {
        Some(thread_complete) => Ok(thread_complete),
        None => {
            redis
                .incr_completed_messages(job_id, thread_provider_id)
                .await
        }
    }
}

/// Drops the progress of a job that failed, was cancelled or completed.
pub async fn clear_job(db: &PgPool, redis: &RedisClient, job_id: Uuid) {
    if let Err(error) = progress::delete_thread_progress(db, job_id).await {
        tracing::warn!(error = ?error, %job_id, "failed to delete backfill thread progress");
    }
    let _ = redis.delete_backfill_job_progress(job_id).await;
}
