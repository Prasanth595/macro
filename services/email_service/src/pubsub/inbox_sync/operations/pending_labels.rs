use email_db_client::labels::pending_writes::pending_provider_label_ids;
use sqlx::PgPool;
use uuid::Uuid;

#[cfg(test)]
mod test;

/// A read of Gmail's labels for a message, with the labels that had a
/// pending Macro write just before and just after it.
pub(super) struct PendingAroundRead<T> {
    pub value: T,
    before: Vec<String>,
    after: Vec<String>,
}

impl<T> PendingAroundRead<T> {
    /// Labels whose local state the read may not reflect: Gmail may have
    /// answered before applying a write pending at either point.
    pub fn untrusted_labels(&self) -> Vec<String> {
        let mut labels = self.before.clone();
        labels.extend(
            self.after
                .iter()
                .filter(|label| !self.before.contains(label))
                .cloned(),
        );
        labels
    }
}

/// Runs `read` between two reads of the message's pending label writes.
pub(super) async fn read_around<T>(
    db: &PgPool,
    message_id: Uuid,
    read: impl Future<Output = T>,
) -> Result<PendingAroundRead<T>, sqlx::Error> {
    let before = pending_provider_label_ids(db, message_id).await?;
    let value = read.await;
    let after = pending_provider_label_ids(db, message_id).await?;
    Ok(PendingAroundRead {
        value,
        before,
        after,
    })
}
