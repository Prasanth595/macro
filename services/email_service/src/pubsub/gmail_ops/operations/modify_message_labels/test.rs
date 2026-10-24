use super::*;
use macro_db_migrator::MACRO_DB_MIGRATIONS;
use models_email::gmail::gmail_ops::ModifyMessageLabelsPayload;

const THREAD: Uuid = Uuid::from_u128(0xb1);

async fn messages_with_label(pool: &PgPool, provider_label_id: &str) -> Vec<Uuid> {
    sqlx::query_scalar!(
        r#"
        SELECT ml.message_id FROM email_message_labels ml
        JOIN email_labels l ON l.id = ml.label_id
        WHERE l.provider_label_id = $1
        ORDER BY ml.message_id
        "#,
        provider_label_id
    )
    .fetch_all(pool)
    .await
    .unwrap()
}

async fn pending_markers(pool: &PgPool) -> Vec<(Uuid, Uuid)> {
    sqlx::query!(
        "SELECT message_id, write_id FROM email_gmail_pending_label_writes ORDER BY message_id"
    )
    .fetch_all(pool)
    .await
    .unwrap()
    .into_iter()
    .map(|marker| (marker.message_id, marker.write_id))
    .collect()
}

async fn thread_state(pool: &PgPool) -> (bool, bool) {
    let thread = sqlx::query!(
        "SELECT inbox_visible, is_read FROM email_threads WHERE id = $1",
        THREAD
    )
    .fetch_one(pool)
    .await
    .unwrap();
    (thread.inbox_visible, thread.is_read)
}

async fn link(pool: &PgPool) -> Link {
    email_db_client::links::get::fetch_link_by_id(pool, Uuid::from_u128(0xa1))
        .await
        .unwrap()
        .unwrap()
}

fn message(id: u128) -> GmailMessageRef {
    GmailMessageRef {
        db_message_id: Uuid::from_u128(id),
        provider_message_id: format!("msg-{}", char::from_digit(id as u32, 16).unwrap()),
    }
}

fn archive(
    write_id: Option<u128>,
    messages: Vec<GmailMessageRef>,
) -> ModifyMessageLabelsBatchPayload {
    ModifyMessageLabelsBatchPayload {
        messages,
        labels_to_add: vec![],
        labels_to_remove: vec!["INBOX".to_string()],
        pending_write_id: write_id.map(Uuid::from_u128),
    }
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../fixtures", scripts("gmail_ops_label_revert"))
)]
async fn a_write_sends_only_the_messages_no_newer_write_took_over(pool: PgPool) {
    let batch = archive(Some(0xf1), vec![message(0xa), message(0xb), message(0xc)]);
    let sent: Vec<Uuid> = messages_to_send(&pool, &batch)
        .await
        .unwrap()
        .into_iter()
        .map(|message| message.db_message_id)
        .collect();
    assert_eq!(sent, vec![Uuid::from_u128(0xa), Uuid::from_u128(0xc)]);

    // Queued before markers existed: nothing to check against.
    let legacy = archive(None, vec![message(0xa), message(0xb)]);
    assert_eq!(messages_to_send(&pool, &legacy).await.unwrap().len(), 2);
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../fixtures", scripts("gmail_ops_label_revert"))
)]
async fn rejected_batch_reverts_only_the_messages_its_write_still_owns(pool: PgPool) {
    let batch = archive(Some(0xf1), vec![message(0xa), message(0xb)]);

    revert_db_changes(
        &pool,
        &link(&pool).await,
        &batch,
        vec![Uuid::from_u128(0xa), Uuid::from_u128(0xb)],
    )
    .await
    .unwrap();

    // B's newer write keeps B archived; C was not in this batch.
    assert_eq!(
        messages_with_label(&pool, "INBOX").await,
        vec![Uuid::from_u128(0xa)]
    );
    assert_eq!(
        pending_markers(&pool).await,
        vec![
            (Uuid::from_u128(0xb), Uuid::from_u128(0xf2)),
            (Uuid::from_u128(0xc), Uuid::from_u128(0xf1)),
        ]
    );
    assert_eq!(thread_state(&pool).await, (true, true));
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../fixtures", scripts("gmail_ops_label_revert"))
)]
async fn rejected_write_hands_its_markers_back_to_the_write_it_took_over(pool: PgPool) {
    // B's newer write unarchived it after the write ...00f1 archived it.
    sqlx::query!(
        "INSERT INTO email_message_labels (message_id, label_id) VALUES ($1, $2)",
        Uuid::from_u128(0xb),
        Uuid::from_u128(0xc1),
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query!(
        r#"
        UPDATE email_gmail_pending_label_writes
        SET previous_write_id = $2, previous_expires_at = now() + interval '12 hours'
        WHERE message_id = $1
        "#,
        Uuid::from_u128(0xb),
        Uuid::from_u128(0xf1),
    )
    .execute(&pool)
    .await
    .unwrap();
    let unarchive = ModifyMessageLabelsBatchPayload {
        messages: vec![message(0xb)],
        labels_to_add: vec!["INBOX".to_string()],
        labels_to_remove: vec![],
        pending_write_id: Some(Uuid::from_u128(0xf2)),
    };

    revert_db_changes(
        &pool,
        &link(&pool).await,
        &unarchive,
        vec![Uuid::from_u128(0xb)],
    )
    .await
    .unwrap();

    assert!(messages_with_label(&pool, "INBOX").await.is_empty());
    assert_eq!(
        pending_markers(&pool).await,
        vec![
            (Uuid::from_u128(0xa), Uuid::from_u128(0xf1)),
            (Uuid::from_u128(0xb), Uuid::from_u128(0xf1)),
            (Uuid::from_u128(0xc), Uuid::from_u128(0xf1)),
        ]
    );
    assert_eq!(thread_state(&pool).await, (false, true));
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../fixtures", scripts("gmail_ops_label_revert"))
)]
async fn rejected_mark_read_restores_the_unread_message_and_thread(pool: PgPool) {
    sqlx::query!(
        r#"
        INSERT INTO email_labels (id, link_id, provider_label_id, name, message_list_visibility, label_list_visibility, type, created_at)
        VALUES ($1, $2, 'UNREAD', 'UNREAD', 'Show', 'LabelShow', 'System', NOW())
        "#,
        Uuid::from_u128(0xc2),
        Uuid::from_u128(0xa1),
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query!(
        r#"
        INSERT INTO email_gmail_pending_label_writes (message_id, provider_label_id, write_id, expires_at)
        VALUES ($1, 'UNREAD', $2, now() + interval '12 hours')
        "#,
        Uuid::from_u128(0xa),
        Uuid::from_u128(0xf3),
    )
    .execute(&pool)
    .await
    .unwrap();
    let mark_read = ModifyMessageLabelsBatchPayload {
        messages: vec![message(0xa)],
        labels_to_add: vec![],
        labels_to_remove: vec!["UNREAD".to_string()],
        pending_write_id: Some(Uuid::from_u128(0xf3)),
    };

    revert_db_changes(
        &pool,
        &link(&pool).await,
        &mark_read,
        vec![Uuid::from_u128(0xa)],
    )
    .await
    .unwrap();

    assert_eq!(
        messages_with_label(&pool, "UNREAD").await,
        vec![Uuid::from_u128(0xa)]
    );
    let is_read = sqlx::query_scalar!(
        "SELECT is_read FROM email_messages WHERE id = $1",
        Uuid::from_u128(0xa)
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(!is_read);
    assert_eq!(thread_state(&pool).await, (false, false));
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../fixtures", scripts("gmail_ops_label_revert"))
)]
async fn rejected_single_message_operation_clears_its_marker(pool: PgPool) {
    let batch = ModifyMessageLabelsBatchPayload::from(ModifyMessageLabelsPayload {
        db_message_id: Uuid::from_u128(0xc),
        provider_message_id: "msg-c".to_string(),
        labels_to_add: vec![],
        labels_to_remove: vec!["INBOX".to_string()],
        pending_write_id: Some(Uuid::from_u128(0xf1)),
    });

    revert_db_changes(
        &pool,
        &link(&pool).await,
        &batch,
        vec![Uuid::from_u128(0xc)],
    )
    .await
    .unwrap();

    assert_eq!(
        messages_with_label(&pool, "INBOX").await,
        vec![Uuid::from_u128(0xc)]
    );
    assert_eq!(
        pending_markers(&pool).await,
        vec![
            (Uuid::from_u128(0xa), Uuid::from_u128(0xf1)),
            (Uuid::from_u128(0xb), Uuid::from_u128(0xf2)),
        ]
    );
}
