use crate::pubsub::gmail_ops::email_api_error::is_permanent_mutation_error;
use crate::pubsub::gmail_ops::operations::OperationError;
use crate::pubsub::gmail_ops::worker::GmailOpsContext;
use anyhow::Context;
use email_db_client::labels::pending_writes;
use models_email::gmail::gmail_ops::{GmailMessageRef, ModifyMessageLabelsBatchPayload};
use models_email::service;
use models_email::service::link::Link;
use sqlx::PgPool;
use std::collections::HashSet;
use uuid::Uuid;

#[cfg(test)]
mod test;

/// Modifies labels for a batch of messages, sending only the messages on
/// which no newer write has taken the change over: one Gmail batch request
/// from ten messages up, one request per message below that. A permanent
/// failure reverts every message sent, and a message Gmail no longer has is
/// skipped; transient errors (5xx, network) and rate limits keep the
/// optimistic DB changes for the retry, which resends the whole batch.
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
    let messages = messages_to_send(&ctx.db, payload)
        .await
        .context("Failed to read which messages the label write still owns")
        .map_err(OperationError::Database)?;
    let db_message_ids: Vec<Uuid> = messages
        .iter()
        .map(|message| message.db_message_id)
        .collect();
    if messages.is_empty() {
        tracing::info!("Newer label writes took over every message, skipping Gmail");
        return clear_pending_write(&ctx.db, payload).await;
    }

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
        Ok(()) => clear_pending_write(&ctx.db, payload).await,
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

/// The batch's messages on which its write still owns the change of every
/// label. A write queued before markers existed has no id and sends them all.
async fn messages_to_send<'a>(
    db: &PgPool,
    payload: &'a ModifyMessageLabelsBatchPayload,
) -> Result<Vec<&'a GmailMessageRef>, sqlx::Error> {
    let Some(write_id) = payload.pending_write_id else {
        return Ok(payload.messages.iter().collect());
    };
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
    let owned: HashSet<Uuid> =
        pending_writes::messages_owned_by_write(db, &db_message_ids, &provider_label_ids, write_id)
            .await?
            .into_iter()
            .collect();
    Ok(payload
        .messages
        .iter()
        .filter(|message| owned.contains(&message.db_message_id))
        .collect())
}

/// Gmail confirmed the batch, so inbox sync applies Gmail's labels to its
/// messages again. Failing here retries the operation rather than leaving
/// sync off those labels until the markers expire.
async fn clear_pending_write(
    db: &PgPool,
    payload: &ModifyMessageLabelsBatchPayload,
) -> Result<(), OperationError> {
    let Some(write_id) = payload.pending_write_id else {
        return Ok(());
    };
    let db_message_ids: Vec<Uuid> = payload
        .messages
        .iter()
        .map(|message| message.db_message_id)
        .collect();
    pending_writes::clear_pending_label_writes(db, &db_message_ids, write_id)
        .await
        .context("Failed to clear pending label write markers")
        .map_err(OperationError::Database)
}

/// Reverts the optimistic DB changes Gmail rejected, on the messages whose
/// change the write still owns: a newer write keeps its own. Each affected
/// thread's state is derived again from its messages.
async fn revert_db_changes(
    db: &PgPool,
    link: &Link,
    payload: &ModifyMessageLabelsBatchPayload,
    sent_ids: Vec<Uuid>,
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
            pending_writes::abandon_pending_label_writes(&mut *tx, &sent_ids, write_id)
                .await
                .context("Failed to abandon pending label write markers")?
        }
        None => sent_ids,
    };

    if is_adding {
        email_db_client::labels::delete::delete_message_labels_batch(
            &mut *tx,
            &reverted_ids,
            provider_label_id,
            link.id,
        )
        .await
        .context("Failed to revert adding labels")?;
    } else {
        email_db_client::labels::insert::insert_message_labels_batch(
            &mut *tx,
            &reverted_ids,
            provider_label_id,
            link.id,
        )
        .await
        .context("Failed to revert removing labels")?;
    }

    if *provider_label_id == service::label::system_labels::UNREAD {
        email_db_client::messages::update::update_message_read_status_batch(
            &mut *tx,
            reverted_ids.clone(),
            link.id,
            is_adding,
        )
        .await
        .context("Failed to revert message read status")?;
    } else if *provider_label_id == service::label::system_labels::STARRED {
        email_db_client::messages::update::update_message_starred_status_batch(
            &mut *tx,
            reverted_ids.clone(),
            link.id,
            !is_adding,
        )
        .await
        .context("Failed to revert message starred status")?;
    }

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
