use email_api_client::domain::models::EmailApiError;

/// Why a gmail_ops operation did not finish.
#[derive(Debug)]
pub enum OperationError {
    Gmail(EmailApiError),
    /// Recording the operation's outcome failed. Gmail writes are idempotent,
    /// so the operation runs again.
    Database(anyhow::Error),
}

impl From<EmailApiError> for OperationError {
    fn from(error: EmailApiError) -> Self {
        Self::Gmail(error)
    }
}
