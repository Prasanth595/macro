use crate::pubsub::gmail_ops::email_api_error::is_permanent_mutation_error;
use crate::pubsub::gmail_ops::operations::OperationError;
use crate::pubsub::gmail_ops::worker::GmailOpsContext;
use anyhow::Context;
use email_db_client::labels::pending_writes::{self, LabelWriteTurn};
use models_email::gmail::gmail_ops::{GmailMessageRef, ModifyMessageLabelsBatchPayload};
use models_email::service;
use models_email::service::link::Link;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

#[cfg(test)]
mod test;

/// Modifies labels for a batch of messages: one Gmail batch request from ten
/// messages up, one request per message below that. A message whose newer
/// write is still on its way makes the whole operation wait for it, and one
/// whose newer write was confirmed is left out. A permanent failure reverts
/// every message sent, and a message Gmail no longer has is skipped;
/// transient errors (5xx, network) and rate limits keep the optimistic DB
/// changes for the retry, which resends the whole batch.
#[tracing::instrument(
    skip(ctx, link, payload),
    fields(
        message_count = payload.messages.len(),
        labels_to_add = ?payload.labels_to_add,
        labels_to_remove = ?payload.labels_to_remove,
    ),
    err(Debug)
)]
pub async fn modify_message_labels(
    ctx: &GmailOpsContext,
    link: &Link,
    payload: &ModifyMessageLabelsBatchPayload,
) -> Result<(), OperationError> {
    let Some(write_id) = payload.pending_write_id else {
        // Queued before markers existed: nothing to coordinate with.
        let messages: Vec<&GmailMessageRef> = payload.messages.iter().collect();
        return send(ctx, link, payload, &messages).await;
    };

    let turns = label_write_turns(&ctx.db, payload, write_id)
        .await
        .context("Failed to read the label write's turn")
        .map_err(OperationError::Database)?;
    let ids_with = |turn: LabelWriteTurn| -> Vec<Uuid> {
        payload
            .messages
            .iter()
            .map(|message| message.db_message_id)
            .filter(|id| turns.get(id).copied().unwrap_or(LabelWriteTurn::Superseded) == turn)
            .collect()
    };
    let superseded = ids_with(LabelWriteTurn::Superseded);
    if !superseded.is_empty() {
        let mut tx = begin_locked(&ctx.db, link.id, &superseded).await?;
        pending_writes::abandon_pending_label_writes(&mut tx, link.id, &superseded, write_id)
            .await
            .context("Failed to drop superseded pending label writes")
            .map_err(OperationError::Database)?;
        commit(tx).await?;
    }

    let waiting = ids_with(LabelWriteTurn::Wait);
    if !waiting.is_empty() {
        tracing::info!(
            db_message_ids = ?waiting,
            "Newer label writes on these messages are still on their way, waiting for them"
        );
        return Err(OperationError::WaitingForNewerWrite);
    }

    let messages: Vec<&GmailMessageRef> = payload
        .messages
        .iter()
        .filter(|message| turns.get(&message.db_message_id) == Some(&LabelWriteTurn::Send))
        .collect();
    if messages.is_empty() {
        tracing::info!("Newer label writes took over every message, skipping Gmail");
        return Ok(());
    }
    send(ctx, link, payload, &messages).await
}

async fn label_write_turns(
    db: &PgPool,
    payload: &ModifyMessageLabelsBatchPayload,
    write_id: Uuid,
) -> Result<std::collections::HashMap<Uuid, LabelWriteTurn>, sqlx::Error> {
    let db_message_ids: Vec<Uuid> = payload
        .messages
        .iter()
        .map(|message| message.db_message_id)
        .collect();
    let provider_label_ids: Vec<String> = payload
        .labels_to_add
        .iter()
        .chain(&payload.labels_to_remove)
        .cloned()
        .collect();
    pending_writes::label_write_turns(db, &db_message_ids, &provider_label_ids, write_id).await
}

async fn send(
    ctx: &GmailOpsContext,
    link: &Link,
    payload: &ModifyMessageLabelsBatchPayload,
    messages: &[&GmailMessageRef],
) -> Result<(), OperationError> {
    let db_message_ids: Vec<Uuid> = messages
        .iter()
        .map(|message| message.db_message_id)
        .collect();
    let provider_message_ids: Vec<String> = messages
        .iter()
        .map(|message| message.provider_message_id.clone())
        .collect();
    let result = ctx
        .email_api
        .modify_message_labels(
            link.id,
            &provider_message_ids,
            &payload.labels_to_add,
            &payload.labels_to_remove,
        )
        .await;

    match result {
        Ok(()) => {
            // Inbox sync applies Gmail's labels to these messages again.
            // Failing here retries the operation rather than leaving sync off
            // those labels until the markers expire.
            if let Some(write_id) = payload.pending_write_id {
                let mut tx = begin_locked(&ctx.db, link.id, &db_message_ids).await?;
                pending_writes::confirm_pending_label_writes(&mut tx, &db_message_ids, write_id)
                    .await
                    .context("Failed to confirm pending label writes")
                    .map_err(OperationError::Database)?;
                commit(tx).await?;
            }
            Ok(())
        }
        Err(error) if is_permanent_mutation_error(&error) => {
            tracing::error!(
                error = ?error,
                ?db_message_ids,
                "Permanent Gmail error modifying labels, reverting database changes"
            );
            revert_db_changes(&ctx.db, link, payload, db_message_ids)
                .await
                .map_err(OperationError::Database)?;
            Err(OperationError::Gmail(error))
        }
        Err(error) => {
            tracing::warn!(
                error = ?error,
                ?db_message_ids,
                "Retryable Gmail error modifying labels, preserving optimistic database changes"
            );
            Err(OperationError::Gmail(error))
        }
    }
}

/// Starts a transaction holding the label-write lock of the messages' threads.
async fn begin_locked<'c>(
    db: &'c PgPool,
    link_id: Uuid,
    message_ids: &[Uuid],
) -> Result<Transaction<'c, Postgres>, OperationError> {
    async {
        let mut tx = db.begin().await?;
        let thread_ids =
            email_db_client::messages::get::thread_ids_of_messages(&mut *tx, link_id, message_ids)
                .await?;
        pending_writes::lock_thread_label_writes(&mut tx, &thread_ids).await?;
        Ok(tx)
    }
    .await
    .map_err(|e: sqlx::Error| {
        OperationError::Database(anyhow::Error::from(e).context("Failed to lock label writes"))
    })
}

async fn commit(tx: Transaction<'_, Postgres>) -> Result<(), OperationError> {
    tx.commit()
        .await
        .context("Failed to commit label write changes")
        .map_err(OperationError::Database)
}

/// Reverts the optimistic DB changes Gmail rejected. With a write id, only
/// labels the write was the newest on go back, to the state Gmail will end up
/// with; a newer write keeps its own. Each affected thread's state is derived
/// again from its messages.
async fn revert_db_changes(
    db: &PgPool,
    link: &Link,
    payload: &ModifyMessageLabelsBatchPayload,
    sent_ids: Vec<Uuid>,
) -> anyhow::Result<()> {
    let mut tx = db
        .begin()
        .await
        .context("Failed to begin transaction for reversion")?;
    let thread_ids =
        email_db_client::messages::get::thread_ids_of_messages(&mut *tx, link.id, &sent_ids)
            .await
            .context("Failed to read the threads of the reverted messages")?;
    pending_writes::lock_thread_label_writes(&mut tx, &thread_ids)
        .await
        .context("Failed to lock the threads of the reverted messages")?;
    let reverted_ids = match payload.pending_write_id {
        Some(write_id) => {
            pending_writes::abandon_pending_label_writes(&mut tx, link.id, &sent_ids, write_id)
                .await
                .context("Failed to abandon pending label writes")?
        }
        None => {
            invert_label_change(&mut tx, link, payload, &sent_ids).await?;
            sent_ids
        }
    };

    for thread_id in thread_ids {
        email_db_client::threads::update::update_thread_metadata(&mut tx, thread_id, link.id)
            .await
            .context("Failed to recompute thread state after revert")?;
    }

    tx.commit()
        .await
        .context("Unable to commit transaction for revert")?;
    tracing::info!(
        db_message_ids = ?reverted_ids,
        "Successfully reverted database changes after Gmail API failure"
    );
    Ok(())
}

/// Undoes the first label change of an operation queued before markers
/// existed on every message it sent.
async fn invert_label_change(
    tx: &mut sqlx::PgConnection,
    link: &Link,
    payload: &ModifyMessageLabelsBatchPayload,
    message_ids: &[Uuid],
) -> anyhow::Result<()> {
    let is_adding = !payload.labels_to_add.is_empty();
    let Some(provider_label_id) = (if is_adding {
        payload.labels_to_add.first()
    } else {
        payload.labels_to_remove.first()
    }) else {
        tracing::error!("No label IDs in payload, cannot revert");
        return Ok(());
    };
    let message_ids = message_ids.to_vec();

    if is_adding {
        email_db_client::labels::delete::delete_message_labels_batch(
            &mut *tx,
            &message_ids,
            provider_label_id,
            link.id,
        )
        .await
        .context("Failed to revert adding labels")?;
    } else {
        email_db_client::labels::insert::insert_message_labels_batch(
            &mut *tx,
            &message_ids,
            provider_label_id,
            link.id,
        )
        .await
        .context("Failed to revert removing labels")?;
    }

    if *provider_label_id == service::label::system_labels::UNREAD {
        email_db_client::messages::update::update_message_read_status_batch(
            &mut *tx,
            message_ids,
            link.id,
            is_adding,
        )
        .await
        .context("Failed to revert message read status")?;
    } else if *provider_label_id == service::label::system_labels::STARRED {
        email_db_client::messages::update::update_message_starred_status_batch(
            &mut *tx,
            message_ids,
            link.id,
            !is_adding,
        )
        .await
        .context("Failed to revert message starred status")?;
    }
    Ok(())
}
