use super::*;
use macro_db_migrator::MACRO_DB_MIGRATIONS;

async fn insert_job(pool: &PgPool, completed_threads: Option<i32>) -> Uuid {
    let job_id = Uuid::now_v7();
    sqlx::query!(
        r#"
        INSERT INTO email_backfill_jobs (
            id, fusionauth_user_id, status, total_threads, completed_threads
        )
        VALUES ($1, 'fa-backfill-progress', 'InProgress', 1, $2)
        "#,
        job_id,
        completed_threads,
    )
    .execute(pool)
    .await
    .unwrap();
    job_id
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn jobs_initialized_before_postgres_counting_are_untracked(pool: PgPool) {
    let job_id = insert_job(&pool, None).await;
    let thread_id = Uuid::now_v7();

    assert!(!add_priority_threads(&pool, job_id, 1).await.unwrap());
    assert!(
        !init_thread_progress(&pool, job_id, thread_id, 1)
            .await
            .unwrap()
    );
    assert_eq!(
        incr_completed_messages(&pool, job_id, thread_id)
            .await
            .unwrap(),
        None
    );
    assert_eq!(incr_completed_threads(&pool, job_id).await.unwrap(), None);
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn concurrent_last_messages_complete_their_thread_once(pool: PgPool) {
    let job_id = insert_job(&pool, Some(0)).await;
    let thread_id = Uuid::now_v7();
    assert!(
        init_thread_progress(&pool, job_id, thread_id, 2)
            .await
            .unwrap()
    );

    let (first, second) = tokio::join!(
        incr_completed_messages(&pool, job_id, thread_id),
        incr_completed_messages(&pool, job_id, thread_id),
    );
    let mut outcomes = [first.unwrap(), second.unwrap()];
    outcomes.sort();

    assert_eq!(outcomes, [Some(false), Some(true)]);
    assert_eq!(
        incr_completed_messages(&pool, job_id, thread_id)
            .await
            .unwrap(),
        None,
        "a completed thread's row is deleted"
    );
}
