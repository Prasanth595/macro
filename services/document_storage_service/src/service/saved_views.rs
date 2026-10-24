//! Composition of saved-view storage with the Teams-owned membership reader.
use saved_views::{
    PgViewStorage,
    domain::{MembershipPort, SavedViewService},
};
use std::collections::HashMap;
use teams::{domain::membership::TeamMembershipEvidence, outbound::team_repo::TeamRepositoryImpl};
use uuid::Uuid;

/// Teams-backed membership port for saved-view policy.
pub struct Membership(pub TeamRepositoryImpl);
impl MembershipPort for Membership {
    type Err = sqlx::Error;

    async fn viewer_teams(&self, viewer: &str) -> Result<Vec<Uuid>, Self::Err> {
        self.0.viewer_teams(viewer).await
    }

    async fn lifetimes(
        &self,
        pairs: &[(Uuid, String)],
    ) -> Result<HashMap<(Uuid, String), Uuid>, Self::Err> {
        self.0.lifetimes(pairs).await
    }
}

/// Construct the domain service with primary-backed storage and membership evidence.
pub fn service(pool: sqlx::PgPool) -> SavedViewService<PgViewStorage, Membership> {
    SavedViewService::new(
        PgViewStorage::new(pool.clone()),
        Membership(TeamRepositoryImpl::new(pool)),
    )
}
