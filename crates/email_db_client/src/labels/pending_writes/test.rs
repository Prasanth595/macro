use super::*;
use anyhow::Result;
use macro_db_migrator::MACRO_DB_MIGRATIONS;
use sqlx::{Pool, Postgres};

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../fixtures", scripts("fetch_message_labels_in_bulk"))
)]
async fn marks_only_messages_of_the_link(pool: Pool<Postgres>) -> Result<()> {
    let link_id = Uuid::parse_str("00000000-0000-0000-0000-000000000801")?;
    let other_link_id = Uuid::parse_str("00000000-0000-0000-0000-000000000802")?;
    let first = Uuid::parse_str("00000000-0000-0000-0000-000000008501")?;
    let second = Uuid::parse_str("00000000-0000-0000-0000-000000008502")?;
    let write_id = Uuid::parse_str("00000000-0000-0000-0000-00000000aa01")?;

    mark_pending_label_writes(&pool, link_id, &[first], "INBOX", write_id).await?;
    mark_pending_label_writes(&pool, other_link_id, &[second], "INBOX", write_id).await?;

    assert_eq!(pending_provider_label_ids(&pool, first).await?, ["INBOX"]);
    assert!(pending_provider_label_ids(&pool, second).await?.is_empty());
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../fixtures", scripts("fetch_message_labels_in_bulk"))
)]
async fn an_older_write_does_not_clear_a_newer_change(pool: Pool<Postgres>) -> Result<()> {
    let link_id = Uuid::parse_str("00000000-0000-0000-0000-000000000801")?;
    let message_id = Uuid::parse_str("00000000-0000-0000-0000-000000008501")?;
    let archive = Uuid::parse_str("00000000-0000-0000-0000-00000000aa01")?;
    let unarchive = Uuid::parse_str("00000000-0000-0000-0000-00000000aa02")?;

    mark_pending_label_writes(&pool, link_id, &[message_id], "INBOX", archive).await?;
    mark_pending_label_writes(&pool, link_id, &[message_id], "INBOX", unarchive).await?;
    clear_pending_label_writes(&pool, &[message_id], archive).await?;
    assert_eq!(
        pending_provider_label_ids(&pool, message_id).await?,
        ["INBOX"]
    );

    clear_pending_label_writes(&pool, &[message_id], unarchive).await?;
    assert!(
        pending_provider_label_ids(&pool, message_id)
            .await?
            .is_empty()
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../fixtures", scripts("fetch_message_labels_in_bulk"))
)]
async fn expired_changes_no_longer_apply(pool: Pool<Postgres>) -> Result<()> {
    let link_id = Uuid::parse_str("00000000-0000-0000-0000-000000000801")?;
    let message_id = Uuid::parse_str("00000000-0000-0000-0000-000000008501")?;
    let write_id = Uuid::parse_str("00000000-0000-0000-0000-00000000aa01")?;

    mark_pending_label_writes(&pool, link_id, &[message_id], "TRASH", write_id).await?;
    mark_pending_label_writes(&pool, link_id, &[message_id], "UNREAD", write_id).await?;
    sqlx::query!(
        "UPDATE email_gmail_pending_label_writes SET expires_at = now() - interval '1 second' WHERE provider_label_id = 'TRASH'"
    )
    .execute(&pool)
    .await?;

    assert_eq!(
        pending_provider_label_ids(&pool, message_id).await?,
        ["UNREAD"]
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../fixtures", scripts("fetch_message_labels_in_bulk"))
)]
async fn an_abandoned_write_hands_the_label_back_to_the_write_it_took_over(
    pool: Pool<Postgres>,
) -> Result<()> {
    let link_id = Uuid::parse_str("00000000-0000-0000-0000-000000000801")?;
    let message_id = Uuid::parse_str("00000000-0000-0000-0000-000000008501")?;
    let archive = Uuid::parse_str("00000000-0000-0000-0000-00000000aa01")?;
    let unarchive = Uuid::parse_str("00000000-0000-0000-0000-00000000aa02")?;

    mark_pending_label_writes(&pool, link_id, &[message_id], "INBOX", archive).await?;
    let archive_expiry = sqlx::query_scalar!(
        "SELECT expires_at FROM email_gmail_pending_label_writes WHERE message_id = $1",
        message_id
    )
    .fetch_one(&pool)
    .await?;
    mark_pending_label_writes(&pool, link_id, &[message_id], "INBOX", unarchive).await?;

    assert_eq!(
        abandon_pending_label_writes(&pool, &[message_id], unarchive).await?,
        [message_id]
    );
    let row = sqlx::query!(
        "SELECT write_id, expires_at, previous_write_id FROM email_gmail_pending_label_writes WHERE message_id = $1",
        message_id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(row.write_id, archive);
    assert_eq!(row.expires_at, archive_expiry);
    assert_eq!(row.previous_write_id, None);

    // With nothing left to hand back to, giving up the write removes the row.
    assert_eq!(
        abandon_pending_label_writes(&pool, &[message_id], archive).await?,
        [message_id]
    );
    assert!(
        pending_provider_label_ids(&pool, message_id)
            .await?
            .is_empty()
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../fixtures", scripts("fetch_message_labels_in_bulk"))
)]
async fn a_write_owns_only_the_labels_no_newer_write_took_over(pool: Pool<Postgres>) -> Result<()> {
    let link_id = Uuid::parse_str("00000000-0000-0000-0000-000000000801")?;
    let first = Uuid::parse_str("00000000-0000-0000-0000-000000008501")?;
    let second = Uuid::parse_str("00000000-0000-0000-0000-000000008502")?;
    let archive = Uuid::parse_str("00000000-0000-0000-0000-00000000aa01")?;
    let unarchive = Uuid::parse_str("00000000-0000-0000-0000-00000000aa02")?;
    let inbox = ["INBOX".to_string()];

    mark_pending_label_writes(&pool, link_id, &[first, second], "INBOX", archive).await?;
    mark_pending_label_writes(&pool, link_id, &[second], "INBOX", unarchive).await?;
    assert_eq!(
        messages_owned_by_write(&pool, &[first, second], &inbox, archive).await?,
        [first]
    );

    // The newer write finishing does not give the label back.
    clear_pending_label_writes(&pool, &[second], unarchive).await?;
    assert_eq!(
        messages_owned_by_write(&pool, &[first, second], &inbox, archive).await?,
        [first]
    );
    assert!(
        messages_owned_by_write(&pool, &[first], &["TRASH".to_string()], archive)
            .await?
            .is_empty()
    );

    // Giving up the older write only touches the rows it still holds.
    assert_eq!(
        abandon_pending_label_writes(&pool, &[first, second], archive).await?,
        [first]
    );
    Ok(())
}
