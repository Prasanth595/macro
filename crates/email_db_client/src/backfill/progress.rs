//! Gmail backfill progress counters. A job counts here once
//! `finalize_initialization` sets its `completed_threads`; jobs initialized
//! before that count in Redis, and these functions report them as untracked.

use sqlx::PgPool;
use sqlx::types::Uuid;

/// A job's thread progress after counting one more completed thread.
#[derive(Debug, PartialEq, Eq)]
pub struct JobThreadProgress {
    pub completed_threads: i32,
    /// `total_threads` plus the threads the priority pass added.
    pub total_threads: i32,
}

/// Counts one completed thread. Returns `None` when the job doesn't count in
/// Postgres.
#[tracing::instrument(skip(pool), err)]
pub async fn incr_completed_threads(
    pool: &PgPool,
    job_id: Uuid,
) -> anyhow::Result<Option<JobThreadProgress>> {
    let progress = sqlx::query_as!(
        JobThreadProgress,
        r#"
        UPDATE email_backfill_jobs
        SET completed_threads = completed_threads + 1, updated_at = now()
        WHERE id = $1
          AND completed_threads IS NOT NULL
        RETURNING
            completed_threads AS "completed_threads!",
            total_threads + priority_threads AS "total_threads!"
        "#,
        job_id,
    )
    .fetch_optional(pool)
    .await?;
    Ok(progress)
}

/// Adds the priority pass's extra BackfillThread messages to the job's total.
/// Returns `false` when the job doesn't count in Postgres.
#[tracing::instrument(skip(pool), err)]
pub async fn add_priority_threads(pool: &PgPool, job_id: Uuid, count: i32) -> anyhow::Result<bool> {
    let updated = sqlx::query!(
        r#"
        UPDATE email_backfill_jobs
        SET priority_threads = priority_threads + $2, updated_at = now()
        WHERE id = $1
          AND completed_threads IS NOT NULL
        "#,
        job_id,
        count,
    )
    .execute(pool)
    .await?;
    Ok(updated.rows_affected() == 1)
}

/// Starts counting a thread's messages, restarting the count if the thread was
/// already started. Returns `false` when the job doesn't count in Postgres.
#[tracing::instrument(skip(pool), err)]
pub async fn init_thread_progress(
    pool: &PgPool,
    job_id: Uuid,
    thread_id: Uuid,
    total_messages: i32,
) -> anyhow::Result<bool> {
    let inserted = sqlx::query!(
        r#"
        INSERT INTO email_backfill_thread_progress (backfill_job_id, thread_id, total_messages)
        SELECT id, $2, $3
        FROM email_backfill_jobs
        WHERE id = $1
          AND completed_threads IS NOT NULL
        ON CONFLICT (backfill_job_id, thread_id)
        DO UPDATE SET total_messages = EXCLUDED.total_messages, completed_messages = 0
        "#,
        job_id,
        thread_id,
        total_messages,
    )
    .execute(pool)
    .await?;
    Ok(inserted.rows_affected() == 1)
}

/// Counts one processed message of a thread and returns whether it was the
/// thread's last, deleting the thread's row when it was. Returns `None` when
/// no row tracks the thread.
#[tracing::instrument(skip(pool), err)]
pub async fn incr_completed_messages(
    pool: &PgPool,
    job_id: Uuid,
    thread_id: Uuid,
) -> anyhow::Result<Option<bool>> {
    let mut tx = pool.begin().await?;
    let thread_complete = sqlx::query_scalar!(
        r#"
        UPDATE email_backfill_thread_progress
        SET completed_messages = completed_messages + 1
        WHERE backfill_job_id = $1
          AND thread_id = $2
        RETURNING completed_messages >= total_messages AS "thread_complete!"
        "#,
        job_id,
        thread_id,
    )
    .fetch_optional(&mut *tx)
    .await?;
    if thread_complete == Some(true) {
        sqlx::query!(
            r#"
            DELETE FROM email_backfill_thread_progress
            WHERE backfill_job_id = $1
              AND thread_id = $2
            "#,
            job_id,
            thread_id,
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(thread_complete)
}

/// Deletes the message counts of a job's unfinished threads.
#[tracing::instrument(skip(pool), err)]
pub async fn delete_thread_progress(pool: &PgPool, job_id: Uuid) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        DELETE FROM email_backfill_thread_progress
        WHERE backfill_job_id = $1
        "#,
        job_id,
    )
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod test;
