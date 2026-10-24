use super::*;
use macro_db_migrator::MACRO_DB_MIGRATIONS;

const MESSAGE: Uuid = Uuid::from_u128(0xa);

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../fixtures", scripts("gmail_ops_label_revert"))
)]
async fn a_write_gmail_confirms_during_the_read_is_not_trusted_from_it(pool: PgPool) {
    let read = read_around(&pool, MESSAGE, async {
        // gmail_ops applies the archive and clears its marker while Gmail's
        // answer, still showing INBOX, is on its way.
        sqlx::query!(
            "DELETE FROM email_gmail_pending_label_writes WHERE message_id = $1",
            MESSAGE
        )
        .execute(&pool)
        .await
        .unwrap();
        vec!["INBOX".to_string()]
    })
    .await
    .unwrap();

    assert_eq!(read.untrusted_labels(), vec!["INBOX".to_string()]);
    assert!(read.write_settled_during_read());
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../fixtures", scripts("gmail_ops_label_revert"))
)]
async fn a_write_staged_during_the_read_is_not_trusted_from_it(pool: PgPool) {
    let read = read_around(&pool, MESSAGE, async {
        sqlx::query!(
            r#"
            INSERT INTO email_gmail_pending_label_writes (message_id, provider_label_id, write_id, expires_at)
            VALUES ($1, 'STARRED', $2, now() + interval '12 hours')
            "#,
            MESSAGE,
            Uuid::from_u128(0xf9),
        )
        .execute(&pool)
        .await
        .unwrap();
    })
    .await
    .unwrap();

    assert_eq!(
        read.untrusted_labels(),
        vec!["INBOX".to_string(), "STARRED".to_string()]
    );
    assert!(!read.write_settled_during_read());
}
