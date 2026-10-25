//! Primary-backed batched membership evidence for dependent domain services.
use std::{collections::HashSet, future::Future};
use uuid::Uuid;

/// Internal current team membership reader for dependent domains.
pub trait TeamMembershipEvidence: Send + Sync {
    /// Error returned by the Teams adapter.
    type Err: std::error::Error + Send + Sync + 'static;
    /// Teams containing a current viewer membership.
    fn viewer_teams(
        &self,
        viewer: &str,
    ) -> impl Future<Output = Result<Vec<Uuid>, Self::Err>> + Send;
    /// Current `(team, user)` pairs from one primary-backed batch.
    fn current_members(
        &self,
        pairs: &[(Uuid, String)],
    ) -> impl Future<Output = Result<HashSet<(Uuid, String)>, Self::Err>> + Send;
}
