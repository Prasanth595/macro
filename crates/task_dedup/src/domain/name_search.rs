//! Bounded name lookup run alongside task creation, so the creator learns
//! about likely duplicates without creation waiting on, or failing with, the
//! lookup.

use std::time::{Duration, Instant};

use tracing::field::Empty;
use uuid::Uuid;

use super::models::TaskNameMatch;
use super::ports::TaskNameSearch;

/// The longest task creation waits for the lookup. Creation itself takes
/// longer, so a lookup within this bound adds no latency.
pub const NAME_LOOKUP_TIMEOUT: Duration = Duration::from_millis(500);

/// Open tasks whose names closely match `name`, or none when the lookup fails
/// or exceeds [`NAME_LOOKUP_TIMEOUT`].
#[tracing::instrument(
    name = "task.similar_name_lookup",
    skip_all,
    fields(owner = %owner, team_id = ?team_id, similar_task_count = Empty, lookup_ms = Empty, outcome = Empty)
)]
pub async fn similar_open_tasks_within_timeout(
    search: &dyn TaskNameSearch,
    owner: &str,
    team_id: Option<Uuid>,
    name: &str,
) -> Vec<TaskNameMatch> {
    let started = Instant::now();
    let result = tokio::time::timeout(
        NAME_LOOKUP_TIMEOUT,
        search.similar_open_tasks(owner, team_id, name),
    )
    .await;
    let span = tracing::Span::current();
    span.record("lookup_ms", started.elapsed().as_millis() as u64);
    let matches = match result {
        Ok(Ok(matches)) => {
            span.record("outcome", "ok");
            matches
        }
        Ok(Err(error)) => {
            span.record("outcome", "error");
            tracing::warn!(error = ?error, "similar task name lookup failed");
            Vec::new()
        }
        Err(_) => {
            span.record("outcome", "timeout");
            tracing::warn!("similar task name lookup timed out");
            Vec::new()
        }
    };
    span.record("similar_task_count", matches.len());
    matches
}

#[cfg(test)]
mod test;
