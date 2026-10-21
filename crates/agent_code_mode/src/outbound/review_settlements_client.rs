//! Tells the harness, from any service, that work a review started has ended.
//!
//! The call is safe to repeat: the harness settles a review once and answers
//! a repeat without prompting again, so transient failures are retried.

use std::time::Duration;

use macro_authorization::{INTERNAL_API_KEY_HEADER, INTERNAL_MACRO_USER_ID_HEADER};
use macro_user_id::user_id::MacroUserIdStr;
use reqwest::{Client, StatusCode, Url, header::HeaderValue};
use tracing::Instrument;
use uuid::Uuid;

const ATTEMPTS: u32 = 3;
const FIRST_BACKOFF: Duration = Duration::from_secs(1);
const TIMEOUT: Duration = Duration::from_secs(20);

/// Why a settlement was not confirmed.
#[derive(Debug, thiserror::Error)]
pub enum SettleError {
    /// The harness refused it: the review is unknown, someone else's, its
    /// session archived, or its work still running.
    #[error("the harness refused to settle the review ({0})")]
    Refused(StatusCode),
    /// No attempt reached a definite answer.
    #[error("the harness could not be reached to settle the review")]
    Unreachable,
}

/// Internal client for `POST /internal/agent-reviews/{id}/settled`.
#[derive(Clone)]
pub struct ReviewSettlementsClient {
    client: Client,
    base_url: Url,
    internal_key: HeaderValue,
}

impl ReviewSettlementsClient {
    /// Accept the harness service root.
    pub fn new(base_url: &str, internal_api_key: &str) -> rootcause::Result<Self> {
        let base_url = Url::parse(&format!("{}/", base_url.trim_end_matches('/')))?;
        let mut internal_key = HeaderValue::from_str(internal_api_key)?;
        internal_key.set_sensitive(true);
        let client = Client::builder()
            .timeout(TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        Ok(Self {
            client,
            base_url,
            internal_key,
        })
    }

    /// Settle review `id` for its session's owner, `owner`.
    pub async fn settle(
        &self,
        owner: &MacroUserIdStr<'static>,
        id: Uuid,
    ) -> Result<(), SettleError> {
        let span = tracing::info_span!(
            "agent_review.settle_request",
            review = %id,
            attempts = tracing::field::Empty,
            http.status_code = tracing::field::Empty,
        );
        async {
            let url = self
                .base_url
                .join(&format!("internal/agent-reviews/{id}/settled"))
                .map_err(|_| SettleError::Unreachable)?;
            let mut backoff = FIRST_BACKOFF;
            for attempt in 1..=ATTEMPTS {
                tracing::Span::current().record("attempts", attempt);
                let mut headers = reqwest::header::HeaderMap::new();
                macro_tower_layers::inject_trace_headers(&mut headers);
                let response = self
                    .client
                    .post(url.clone())
                    .headers(headers)
                    .header(INTERNAL_API_KEY_HEADER, self.internal_key.clone())
                    .header(INTERNAL_MACRO_USER_ID_HEADER, owner.as_ref())
                    .send()
                    .await;
                match response.map(|response| response.status()) {
                    Ok(status) if status.is_success() => {
                        tracing::Span::current().record("http.status_code", status.as_u16());
                        return Ok(());
                    }
                    // A conflict is a concurrent change to the review; the
                    // next attempt reads it again.
                    Ok(status) if status.is_client_error() && status != StatusCode::CONFLICT => {
                        tracing::Span::current().record("http.status_code", status.as_u16());
                        return Err(SettleError::Refused(status));
                    }
                    Ok(status) => {
                        tracing::warn!(
                            attempt,
                            status = status.as_u16(),
                            "review settlement not confirmed"
                        );
                    }
                    Err(error) => {
                        tracing::warn!(attempt, error = ?error, "review settlement request failed");
                    }
                }
                if attempt < ATTEMPTS {
                    tokio::time::sleep(backoff).await;
                    backoff *= 4;
                }
            }
            Err(SettleError::Unreachable)
        }
        .instrument(span)
        .await
    }
}
