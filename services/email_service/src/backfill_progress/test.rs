use super::*;
use email_db_client::backfill::job::update::{
    InitLeaseClaim, claim_init_lease, finalize_initialization, update_job_total_threads,
};
use macro_db_migrator::MACRO_DB_MIGRATIONS;
use redis::AsyncCommands;

fn redis_client() -> RedisClient {
    RedisClient::new(
        redis::Client::open("redis://127.0.0.1:6379/").unwrap(),
        0,
        0,
        60,
    )
}

async fn insert_job(pool: &PgPool, status: &str) -> Uuid {
    let job_id = Uuid::now_v7();
    sqlx::query!(
        r#"
        INSERT INTO email_backfill_jobs (id, fusionauth_user_id, status)
        VALUES ($1, 'fa-backfill-progress', $2::text::email_backfill_job_status)
        "#,
        job_id,
        status,
    )
    .execute(pool)
    .await
    .unwrap();
    job_id
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn progress_survives_redis_restarting_empty(pool: PgPool) {
    let redis = redis_client();
    let job_id = insert_job(&pool, "Init").await;
    let InitLeaseClaim::Claimed(lease) = claim_init_lease(&pool, job_id).await.unwrap() else {
        panic!("a new job's initialization should be claimable");
    };
    update_job_total_threads(&pool, job_id, 2).await.unwrap();
    assert!(finalize_initialization(&pool, job_id, lease).await.unwrap());
    let (thread_a, thread_b) = (Uuid::now_v7(), Uuid::now_v7());
    init_thread_progress(&pool, &redis, job_id, thread_a, "thread-a", 1)
        .await
        .unwrap();
    init_thread_progress(&pool, &redis, job_id, thread_b, "thread-b", 2)
        .await
        .unwrap();

    // Redis without persistence restarts with no keys.
    let mut connection = redis
        .inner
        .get_multiplexed_async_connection()
        .await
        .unwrap();
    connection
        .del::<_, ()>(&[
            format!("bf_job_status:{job_id}"),
            format!("bf_thread_status:{job_id}:thread-a"),
            format!("bf_thread_status:{job_id}:thread-b"),
        ])
        .await
        .unwrap();

    add_priority_threads(&pool, &redis, job_id, 1)
        .await
        .unwrap();
    assert!(
        incr_completed_messages(&pool, &redis, job_id, thread_a, "thread-a")
            .await
            .unwrap()
    );
    assert!(
        !incr_completed_messages(&pool, &redis, job_id, thread_b, "thread-b")
            .await
            .unwrap()
    );
    assert!(
        incr_completed_messages(&pool, &redis, job_id, thread_b, "thread-b")
            .await
            .unwrap()
    );
    assert!(
        !incr_completed_messages(&pool, &redis, job_id, thread_a, "thread-a")
            .await
            .unwrap(),
        "a message redelivered after its thread completed must not complete it again"
    );

    let mut completed = Vec::new();
    for _ in 0..3 {
        let progress = incr_completed_threads(&pool, &redis, job_id).await.unwrap();
        completed.push((
            progress.completed_threads,
            progress.total_threads,
            progress.job_complete,
        ));
    }
    assert_eq!(completed, [(1, 3, false), (2, 3, false), (3, 3, true)]);
}

#[tokio::test]
async fn fenced_jobs_reject_redis_counting() {
    let redis = redis_client();
    let job_id = Uuid::now_v7();

    fence_redis_counting(&redis, job_id).await;

    assert!(redis.add_to_total_threads(job_id, 1).await.is_err());
    assert!(redis.incr_completed_threads(job_id).await.is_err());
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn jobs_initialized_before_postgres_counting_keep_counting_in_redis(pool: PgPool) {
    let redis = redis_client();
    let job_id = insert_job(&pool, "InProgress").await;
    let thread_id = Uuid::now_v7();
    let mut connection = redis
        .inner
        .get_multiplexed_async_connection()
        .await
        .unwrap();
    connection
        .hset_multiple::<_, _, _, ()>(
            format!("bf_job_status:{job_id}"),
            &[("total_threads", 1), ("completed_threads", 0)],
        )
        .await
        .unwrap();

    init_thread_progress(&pool, &redis, job_id, thread_id, "legacy-thread", 1)
        .await
        .unwrap();
    assert!(
        incr_completed_messages(&pool, &redis, job_id, thread_id, "legacy-thread")
            .await
            .unwrap()
    );
    let progress = incr_completed_threads(&pool, &redis, job_id).await.unwrap();

    assert_eq!(
        (
            progress.completed_threads,
            progress.total_threads,
            progress.job_complete
        ),
        (1, 1, true)
    );
}
