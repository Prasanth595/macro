use sqlx::types::Uuid;
use sqlx::{PgPool, Postgres, Transaction};
use std::num::NonZeroU32;

#[cfg(test)]
mod test;

/// How many rows each [`purge_link`] transaction removes. Every batch commits on its own,
/// so no single transaction holds locks, WAL or the xmin horizon for a whole mailbox.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PurgeBatchSizes {
    /// Messages per transaction, deleted together with their labels, recipients,
    /// attachments and scheduled sends. Message bodies are most of a mailbox's bytes
    /// (TOAST), so this is the knob that bounds a transaction's WAL.
    pub messages: NonZeroU32,
    /// Threads per transaction, deleted with their user history once their messages are gone.
    pub threads: NonZeroU32,
    /// Contacts per transaction.
    pub contacts: NonZeroU32,
}

impl Default for PurgeBatchSizes {
    fn default() -> Self {
        Self {
            messages: NonZeroU32::new(1_000).expect("non-zero"),
            threads: NonZeroU32::new(2_000).expect("non-zero"),
            contacts: NonZeroU32::new(5_000).expect("non-zero"),
        }
    }
}

/// Rows removed by one [`purge_link`] call. A rerun reports only what it removed itself.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct PurgeSummary {
    /// Messages deleted.
    pub messages: u64,
    /// Threads deleted.
    pub threads: u64,
    /// Contacts deleted.
    pub contacts: u64,
    /// Whether this call deleted the `email_links` row; `false` when it was already gone.
    pub link_deleted: bool,
}

/// Marks a link as being deleted and stops its sync. A marked link never resumes syncing:
/// re-enabling sync and reconnecting the same mailbox both refuse it until the purge has
/// removed the row.
///
/// Idempotent and cheap to repeat: an already-marked link keeps its original `deleting_at`
/// and the row is not rewritten. A no-op for a missing link.
#[tracing::instrument(skip(pool), err)]
pub async fn mark_link_deleting(pool: &PgPool, link_id: Uuid) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        UPDATE email_links
        SET deleting_at = COALESCE(deleting_at, NOW()),
            is_sync_active = false,
            updated_at = NOW()
        WHERE id = $1 AND (deleting_at IS NULL OR is_sync_active)
        "#,
        link_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Deletes a link and all of its email data incrementally: messages (deepest children
/// first), then threads, then contacts, each in bounded short transactions, and finally
/// the `email_links` row, whose cascade only has small per-link tables left to clear.
///
/// Marks the link via [`mark_link_deleting`] first, so it can be called on its own. Safe to
/// rerun after a crash (it resumes from whatever is left) and to run concurrently for the
/// same link: batches for one link are serialized by an advisory lock.
#[tracing::instrument(skip(pool), err)]
pub async fn purge_link(
    pool: &PgPool,
    link_id: Uuid,
    batch_sizes: PurgeBatchSizes,
) -> anyhow::Result<PurgeSummary> {
    mark_link_deleting(pool, link_id).await?;

    let mut summary = PurgeSummary::default();

    loop {
        let deleted = purge_message_batch(pool, link_id, batch_sizes.messages).await?;
        summary.messages += deleted;
        if deleted < u64::from(batch_sizes.messages.get()) {
            break;
        }
    }

    loop {
        let deleted = purge_thread_batch(pool, link_id, batch_sizes.threads).await?;
        summary.threads += deleted;
        if deleted < u64::from(batch_sizes.threads.get()) {
            break;
        }
    }

    loop {
        let deleted = purge_contact_batch(pool, link_id, batch_sizes.contacts).await?;
        summary.contacts += deleted;
        if deleted < u64::from(batch_sizes.contacts.get()) {
            break;
        }
    }

    summary.link_deleted = delete_marked_link(pool, link_id).await?;

    tracing::info!(?summary, "Purged email link");
    Ok(summary)
}

/// Opens a purge batch transaction holding the link's purge lock until commit, so a
/// redelivered delete running alongside the original takes turns batch by batch instead
/// of deadlocking on the rows both are deleting.
async fn begin_purge_batch(
    pool: &PgPool,
    link_id: Uuid,
) -> anyhow::Result<Transaction<'static, Postgres>> {
    let mut tx = pool.begin().await?;
    sqlx::query!(
        "SELECT pg_advisory_xact_lock(hashtextextended('email_link_purge:' || $1::uuid::text, 0))",
        link_id
    )
    .execute(&mut *tx)
    .await?;
    Ok(tx)
}

/// Deletes up to `limit` of the link's messages with their children, deepest first.
/// Returns the number of messages deleted.
async fn purge_message_batch(
    pool: &PgPool,
    link_id: Uuid,
    limit: NonZeroU32,
) -> anyhow::Result<u64> {
    let mut tx = begin_purge_batch(pool, link_id).await?;

    let message_ids = sqlx::query_scalar!(
        "SELECT id FROM email_messages WHERE link_id = $1 LIMIT $2",
        link_id,
        i64::from(limit.get())
    )
    .fetch_all(&mut *tx)
    .await?;

    if message_ids.is_empty() {
        tx.commit().await?;
        return Ok(0);
    }

    sqlx::query!(
        "DELETE FROM email_message_labels WHERE message_id = ANY($1)",
        &message_ids
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "DELETE FROM email_message_recipients WHERE message_id = ANY($1)",
        &message_ids
    )
    .execute(&mut *tx)
    .await?;

    // Detached rather than deleted: email_sfs_delete_handler removes the stored file for
    // every row whose attachment_id is NULL, then deletes the row itself.
    sqlx::query!(
        r#"
        UPDATE email_attachments_sfs
        SET attachment_id = NULL
        WHERE attachment_id IN (SELECT id FROM email_attachments WHERE message_id = ANY($1))
        "#,
        &message_ids
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "DELETE FROM email_attachments WHERE message_id = ANY($1)",
        &message_ids
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "DELETE FROM email_scheduled_messages WHERE message_id = ANY($1)",
        &message_ids
    )
    .execute(&mut *tx)
    .await?;

    let deleted = sqlx::query!(
        "DELETE FROM email_messages WHERE id = ANY($1)",
        &message_ids
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(deleted)
}

/// Deletes up to `limit` of the link's threads with their user history. Runs after the
/// message phase, so the thread cascade only meets messages a straggling sync wrote since.
/// Returns the number of threads deleted.
async fn purge_thread_batch(
    pool: &PgPool,
    link_id: Uuid,
    limit: NonZeroU32,
) -> anyhow::Result<u64> {
    let mut tx = begin_purge_batch(pool, link_id).await?;

    let thread_ids = sqlx::query_scalar!(
        "SELECT id FROM email_threads WHERE link_id = $1 LIMIT $2",
        link_id,
        i64::from(limit.get())
    )
    .fetch_all(&mut *tx)
    .await?;

    if thread_ids.is_empty() {
        tx.commit().await?;
        return Ok(0);
    }

    sqlx::query!(
        "DELETE FROM email_user_history WHERE thread_id = ANY($1)",
        &thread_ids
    )
    .execute(&mut *tx)
    .await?;

    let deleted = sqlx::query!("DELETE FROM email_threads WHERE id = ANY($1)", &thread_ids)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    tx.commit().await?;
    Ok(deleted)
}

/// Deletes up to `limit` of the link's contacts. Returns the number deleted.
async fn purge_contact_batch(
    pool: &PgPool,
    link_id: Uuid,
    limit: NonZeroU32,
) -> anyhow::Result<u64> {
    let mut tx = begin_purge_batch(pool, link_id).await?;

    let deleted = sqlx::query!(
        r#"
        DELETE FROM email_contacts
        WHERE id IN (SELECT id FROM email_contacts WHERE link_id = $1 LIMIT $2)
        "#,
        link_id,
        i64::from(limit.get())
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(deleted)
}

/// Deletes the link row once its bulk data is gone. Only a link marked by
/// [`mark_link_deleting`] is deleted. Returns whether a row was deleted.
async fn delete_marked_link(pool: &PgPool, link_id: Uuid) -> anyhow::Result<bool> {
    let mut tx = begin_purge_batch(pool, link_id).await?;

    let deleted = sqlx::query!(
        "DELETE FROM email_links WHERE id = $1 AND deleting_at IS NOT NULL",
        link_id
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(deleted > 0)
}
