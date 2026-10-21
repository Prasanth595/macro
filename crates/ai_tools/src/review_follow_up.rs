//! Composes the import service's review follow-up with the harness's internal
//! review-settlement route, so a workspace import that ends in any process
//! continues the agent session that presented it.

use std::sync::Arc;

use agent_code_mode::outbound::review_settlements_client::ReviewSettlementsClient;
use macro_service_urls::AgentHarnessServiceUrl;

/// Settle an import's review through the harness once its write ends.
pub fn build_review_follow_up(
    url: AgentHarnessServiceUrl,
    internal_api_key: &str,
) -> anyhow::Result<import::domain::service::ReviewFollowUp> {
    let client = ReviewSettlementsClient::new(url.as_ref(), internal_api_key)
        .map_err(|error| anyhow::anyhow!("{error}"))?;
    Ok(Arc::new(move |owner, review| {
        let client = client.clone();
        Box::pin(async move {
            if let Err(error) = client.settle(&owner, review).await {
                tracing::warn!(error = ?error, %review, "could not follow up on the import's review");
            }
        })
    }))
}
