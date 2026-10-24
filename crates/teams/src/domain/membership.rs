//! Primary-backed batched membership evidence for dependent domain services.
use std::{collections::HashMap, future::Future};
use uuid::Uuid;

/// Internal team membership lifetime reader; never exposes tokens in public team DTOs.
pub trait TeamMembershipEvidence: Send + Sync {
    /// Error returned by the Teams adapter.
    type Err: std::error::Error + Send + Sync + 'static;
    /// Teams containing a current viewer membership.
    fn viewer_teams(
        &self,
        viewer: &str,
    ) -> impl Future<Output = Result<Vec<Uuid>, Self::Err>> + Send;
    /// Current lifetimes keyed by team and user, in one primary-backed batch.
    fn lifetimes(
        &self,
        pairs: &[(Uuid, String)],
    ) -> impl Future<Output = Result<HashMap<(Uuid, String), Uuid>, Self::Err>> + Send;
}
