#[cfg(test)]
mod test;

use sqlx::types::Uuid;
use sqlx::{Executor, PgConnection, Postgres};

/// Makes label writes that stage or undo a change on the same threads take
/// turns until the transaction ends, so each reads the state the one before
/// it left. Locks are taken in id order, so writers on several threads cannot
/// deadlock each other.
#[tracing::instrument(skip(tx, thread_ids), err)]
pub async fn lock_thread_label_writes(
    tx: &mut PgConnection,
    thread_ids: &[Uuid],
) -> Result<(), sqlx::Error> {
    let mut thread_ids = thread_ids.to_vec();
    thread_ids.sort_unstable();
    thread_ids.dedup();
    for thread_id in thread_ids {
        sqlx::query!(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            format!("email_thread_label_write:{thread_id}"),
        )
        .execute(&mut *tx)
        .await?;
    }
    Ok(())
}

/// Records that the Gmail operations sharing `write_id` will change
/// `provider_label_id` on `message_ids`, so inbox sync keeps the local label
/// state until Gmail confirms it. A newer change to the same label on the same
/// message takes over the row and remembers the write it took it from. Rows
/// stop applying after 12 hours, longer than an operation is redelivered
/// through the gmail_ops queues, so only operations that are dead-lettered or
/// lost fall back to Gmail's labels.
#[tracing::instrument(skip(executor, message_ids), err)]
pub async fn mark_pending_label_writes<'e, E>(
    executor: E,
    link_id: Uuid,
    message_ids: &[Uuid],
    provider_label_id: &str,
    write_id: Uuid,
) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    if message_ids.is_empty() {
        return Ok(());
    }

    sqlx::query!(
        r#"
        INSERT INTO email_gmail_pending_label_writes (message_id, provider_label_id, write_id, expires_at)
        SELECT m.id, $3, $4, now() + interval '12 hours'
        FROM email_messages m
        WHERE m.id = ANY($1) AND m.link_id = $2
        ON CONFLICT (message_id, provider_label_id) DO UPDATE
        SET previous_write_id = CASE
                WHEN email_gmail_pending_label_writes.write_id = EXCLUDED.write_id
                THEN email_gmail_pending_label_writes.previous_write_id
                ELSE email_gmail_pending_label_writes.write_id END,
            previous_expires_at = CASE
                WHEN email_gmail_pending_label_writes.write_id = EXCLUDED.write_id
                THEN email_gmail_pending_label_writes.previous_expires_at
                ELSE email_gmail_pending_label_writes.expires_at END,
            write_id = EXCLUDED.write_id,
            expires_at = EXCLUDED.expires_at
        "#,
        message_ids,
        link_id,
        provider_label_id,
        write_id,
    )
    .execute(executor)
    .await?;

    Ok(())
}

/// Removes `write_id`'s pending label changes on `message_ids` once Gmail has
/// accepted them. Rows a newer change took over stay; the write it took them
/// from is superseded either way.
#[tracing::instrument(skip(executor, message_ids), err)]
pub async fn clear_pending_label_writes<'e, E>(
    executor: E,
    message_ids: &[Uuid],
    write_id: Uuid,
) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    if message_ids.is_empty() {
        return Ok(());
    }

    sqlx::query!(
        r#"
        DELETE FROM email_gmail_pending_label_writes
        WHERE message_id = ANY($1) AND write_id = $2
        "#,
        message_ids,
        write_id,
    )
    .execute(executor)
    .await?;

    Ok(())
}

/// Gives up `write_id`'s pending label changes on `message_ids` because Gmail
/// will never apply them: each row goes back to the write it took over, which
/// may still be on its way to Gmail, or is removed when there was none.
/// Returns the messages whose rows `write_id` still held; rows a newer change
/// took over stay with it.
#[tracing::instrument(skip(executor, message_ids), err)]
pub async fn abandon_pending_label_writes<'e, E>(
    executor: E,
    message_ids: &[Uuid],
    write_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    if message_ids.is_empty() {
        return Ok(Vec::new());
    }

    sqlx::query_scalar!(
        r#"
        WITH handed_back AS (
            UPDATE email_gmail_pending_label_writes
            SET write_id = previous_write_id,
                expires_at = previous_expires_at,
                previous_write_id = NULL,
                previous_expires_at = NULL
            WHERE message_id = ANY($1) AND write_id = $2 AND previous_write_id IS NOT NULL
            RETURNING message_id
        ),
        removed AS (
            DELETE FROM email_gmail_pending_label_writes
            WHERE message_id = ANY($1) AND write_id = $2 AND previous_write_id IS NULL
            RETURNING message_id
        )
        SELECT message_id AS "message_id!" FROM handed_back
        UNION
        SELECT message_id FROM removed
        "#,
        message_ids,
        write_id,
    )
    .fetch_all(executor)
    .await
}

/// Messages among `message_ids` on which `write_id` still owns the pending
/// change of every label in `provider_label_ids`. On the others a newer write
/// took the change over, or already finished it.
#[tracing::instrument(skip(executor, message_ids), err)]
pub async fn messages_owned_by_write<'e, E>(
    executor: E,
    message_ids: &[Uuid],
    provider_label_ids: &[String],
    write_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    if message_ids.is_empty() || provider_label_ids.is_empty() {
        return Ok(Vec::new());
    }

    sqlx::query_scalar!(
        r#"
        SELECT message_id
        FROM email_gmail_pending_label_writes
        WHERE message_id = ANY($1) AND write_id = $2 AND provider_label_id = ANY($3)
        GROUP BY message_id
        HAVING count(*) = (SELECT count(DISTINCT label) FROM unnest($3::text[]) AS label)
        "#,
        message_ids,
        write_id,
        provider_label_ids,
    )
    .fetch_all(executor)
    .await
}

/// Provider label ids on the message with a local change Gmail has not
/// confirmed yet.
#[tracing::instrument(skip(executor), err)]
pub async fn pending_provider_label_ids<'e, E>(
    executor: E,
    message_id: Uuid,
) -> Result<Vec<String>, sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    sqlx::query_scalar!(
        r#"
        SELECT provider_label_id
        FROM email_gmail_pending_label_writes
        WHERE message_id = $1 AND expires_at > now()
        "#,
        message_id,
    )
    .fetch_all(executor)
    .await
}
