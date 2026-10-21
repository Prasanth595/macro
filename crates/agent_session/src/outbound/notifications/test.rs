use super::*;
use agent_runtime_protocol::domain::notification::NotificationEvent;
use macro_db_migrator::MACRO_DB_MIGRATIONS;

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn outbox_is_transactional_deduplicated_and_cascades(pool: PgPool) {
    sqlx::raw_sql("INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace) VALUES ('00000000-0000-0000-0000-000000000001','macro|owner@example.com','00000000-0000-0000-0000-00000000a9e7','test','macrod','/workspace')").execute(&pool).await.unwrap();
    let session = AgentSessionId::new_from_uuid(Uuid::from_u128(1));
    let store = PgNotificationStore(pool.clone());
    let pending = PendingNotification::new(ProduceNotification {
        session_id: session,
        subject_id: "connection".into(),
        event: NotificationEvent::AppConnected {
            app: "Calendar".into(),
        },
        dedupe_key: None,
        wake: true,
    })
    .unwrap();
    let mut transaction = pool.begin().await.unwrap();
    store.produce(&mut *transaction, &pending).await.unwrap();
    transaction.rollback().await.unwrap();
    assert!(store.pending_sessions().await.unwrap().is_empty());
    store.enqueue(pending.clone()).await.unwrap();
    store.enqueue(pending).await.unwrap();
    let batch = store.claim(session, false).await.unwrap().unwrap();
    assert_eq!(batch.notifications.len(), 1);
    assert!(store.claim(session, false).await.unwrap().is_none());
    store
        .complete(batch.lease_id, NotificationOutcome::Noop)
        .await
        .unwrap();
    assert!(store.claim(session, false).await.unwrap().is_none());
    let row = sqlx::query!("SELECT attempts, outcome, delivered_at FROM agent_session_notification WHERE session_id = $1", session.as_uuid()).fetch_one(&pool).await.unwrap();
    assert_eq!(row.attempts, 1);
    assert_eq!(row.outcome.as_deref(), Some("noop"));
    assert!(row.delivered_at.is_some());
    sqlx::query!("DELETE FROM agent_session WHERE id = $1", session.as_uuid())
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar!("SELECT COUNT(*) FROM agent_session_notification")
            .fetch_one(&pool)
            .await
            .unwrap(),
        Some(0)
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn quiet_events_coalesce_and_expired_leases_keep_their_action_identity(pool: PgPool) {
    sqlx::raw_sql("INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace) VALUES ('00000000-0000-0000-0000-000000000001','macro|owner@example.com','00000000-0000-0000-0000-00000000a9e7','test','macrod','/workspace')").execute(&pool).await.unwrap();
    let session = AgentSessionId::new_from_uuid(Uuid::from_u128(1));
    let store = PgNotificationStore(pool.clone());
    for subject in ["one", "two"] {
        store
            .enqueue(
                PendingNotification::new(ProduceNotification {
                    session_id: session,
                    subject_id: subject.into(),
                    event: NotificationEvent::AppConnected {
                        app: "Calendar".into(),
                    },
                    dedupe_key: None,
                    wake: false,
                })
                .unwrap(),
            )
            .await
            .unwrap();
    }
    assert!(store.pending_sessions().await.unwrap().is_empty());
    assert!(store.claim(session, false).await.unwrap().is_none());
    let first = store.claim(session, true).await.unwrap().unwrap();
    assert_eq!(first.notifications.len(), 2);
    sqlx::query!("UPDATE agent_session_notification SET lease_until = now() - interval '1 second'")
        .execute(&pool)
        .await
        .unwrap();
    store
        .enqueue(
            PendingNotification::new(ProduceNotification {
                session_id: session,
                subject_id: "new".into(),
                event: NotificationEvent::AppConnected {
                    app: "Calendar".into(),
                },
                dedupe_key: None,
                wake: true,
            })
            .unwrap(),
        )
        .await
        .unwrap();
    let retry = store.claim(session, true).await.unwrap().unwrap();
    assert_eq!(retry.action_id, first.action_id);
    assert_ne!(retry.lease_id, first.lease_id);
    assert_eq!(
        retry.notifications.len(),
        2,
        "new events must not reuse an accepted action id"
    );
    store
        .complete(first.lease_id, NotificationOutcome::Delivered)
        .await
        .unwrap();
    assert!(
        store.claim(session, true).await.unwrap().is_none(),
        "stale completion cannot consume a new lease"
    );
    store
        .complete(retry.lease_id, NotificationOutcome::Delivered)
        .await
        .unwrap();
    let next = store.claim(session, false).await.unwrap().unwrap();
    assert_eq!(next.notifications.len(), 1);
    assert_ne!(next.action_id, first.action_id);
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn waking_turn_leaves_quiet_events_for_a_real_prompt(pool: PgPool) {
    sqlx::raw_sql("INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace) VALUES ('00000000-0000-0000-0000-000000000001','macro|owner@example.com','00000000-0000-0000-0000-00000000a9e7','test','macrod','/workspace')").execute(&pool).await.unwrap();
    let session = AgentSessionId::new_from_uuid(Uuid::from_u128(1));
    let store = PgNotificationStore(pool);
    for (subject, wake) in [("quiet", false), ("wake", true)] {
        store
            .enqueue(
                PendingNotification::new(ProduceNotification {
                    session_id: session,
                    subject_id: subject.into(),
                    event: NotificationEvent::AppConnected {
                        app: "Calendar".into(),
                    },
                    dedupe_key: None,
                    wake,
                })
                .unwrap(),
            )
            .await
            .unwrap();
    }
    let waking = store.claim(session, false).await.unwrap().unwrap();
    assert_eq!(waking.notifications.len(), 1);
    assert_eq!(waking.notifications[0].subject_id, "wake");
    store
        .complete(waking.lease_id, NotificationOutcome::Delivered)
        .await
        .unwrap();
    assert!(store.claim(session, false).await.unwrap().is_none());
    let quiet = store.claim(session, true).await.unwrap().unwrap();
    assert_eq!(quiet.notifications.len(), 1);
    assert_eq!(quiet.notifications[0].subject_id, "quiet");
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn legacy_review_writes_during_rollout_enter_the_typed_outbox_once(pool: PgPool) {
    sqlx::raw_sql("INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace) VALUES ('00000000-0000-0000-0000-000000000001','macro|owner@example.com','00000000-0000-0000-0000-00000000a9e7','test','macrod','/workspace')").execute(&pool).await.unwrap();
    let session = AgentSessionId::new_from_uuid(Uuid::from_u128(1));
    let review = macro_uuid::generate_uuid_v7();
    let action = macro_uuid::generate_uuid_v7();
    let mut record = serde_json::json!({"notificationId":action,"items":[{"id": macro_uuid::generate_uuid_v7(),"status":"submitting"}]});
    sqlx::query!(
        "INSERT INTO agent_session_review (id, agent_session_id, record) VALUES ($1,$2,$3)",
        review,
        session.as_uuid(),
        record
    )
    .execute(&pool)
    .await
    .unwrap();
    let store = PgNotificationStore(pool.clone());
    assert!(store.pending_sessions().await.unwrap().is_empty());
    record["items"][0]["status"] = serde_json::json!("completed");
    for _ in 0..2 {
        sqlx::query!(
            "UPDATE agent_session_review SET record = $2 WHERE id = $1",
            review,
            record
        )
        .execute(&pool)
        .await
        .unwrap();
    }
    let batch = store.claim(session, false).await.unwrap().unwrap();
    assert_eq!(batch.action_id.as_uuid(), action);
    assert_eq!(batch.notifications.len(), 1);
    assert_eq!(batch.notifications[0].subject_id, review.to_string());
    assert!(matches!(
        batch.notifications[0].event,
        NotificationEvent::ReviewSettled(_)
    ));
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn prior_actions_reconcile_before_fresh_inputs_and_interrupted_quiet_events_defer(
    pool: PgPool,
) {
    sqlx::raw_sql("INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace) VALUES ('00000000-0000-0000-0000-000000000001','macro|owner@example.com','00000000-0000-0000-0000-00000000a9e7','test','macrod','/workspace')").execute(&pool).await.unwrap();
    let session = AgentSessionId::new_from_uuid(Uuid::from_u128(1));
    let store = PgNotificationStore(pool.clone());
    let pending = |subject: &str, wake| {
        PendingNotification::new(ProduceNotification {
            session_id: session,
            subject_id: subject.into(),
            event: NotificationEvent::AppConnected {
                app: "Calendar".into(),
            },
            dedupe_key: None,
            wake,
        })
        .unwrap()
    };
    store.enqueue(pending("older quiet", false)).await.unwrap();
    store.enqueue(pending("wake", true)).await.unwrap();
    let first = store.claim(session, false).await.unwrap().unwrap();
    sqlx::query!("UPDATE agent_session_notification SET lease_until = now() - interval '1 second'")
        .execute(&pool)
        .await
        .unwrap();
    let recovered = store.claim(session, true).await.unwrap().unwrap();
    assert_eq!(recovered.action_id, first.action_id);
    assert_eq!(recovered.notifications[0].subject_id, "wake");
    store
        .complete(recovered.lease_id, NotificationOutcome::Delivered)
        .await
        .unwrap();
    let quiet = store.claim(session, true).await.unwrap().unwrap();
    store.release(quiet.lease_id).await.unwrap();
    store.enqueue(pending("later wake", true)).await.unwrap();
    let recovered = store.claim(session, false).await.unwrap().unwrap();
    assert_eq!(recovered.action_id, quiet.action_id);
    assert!(!recovered.wake);
    store.defer_until_prompt(recovered.lease_id).await.unwrap();
    let waking = store.claim(session, false).await.unwrap().unwrap();
    assert_eq!(waking.notifications[0].subject_id, "later wake");
    store
        .complete(waking.lease_id, NotificationOutcome::Delivered)
        .await
        .unwrap();
    assert!(store.claim(session, false).await.unwrap().is_none());
    let next_prompt = store.claim(session, true).await.unwrap().unwrap();
    assert_eq!(next_prompt.notifications[0].id, quiet.notifications[0].id);
    assert_ne!(next_prompt.action_id, quiet.action_id);
}
