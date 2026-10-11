//! Workspace membership facts for domains that configure team resources.

use super::{
    model::{TeamError, TeamRole},
    team_repo::TeamRepository,
};
use macro_user_id::user_id::MacroUserIdStr;

/// Membership facts, without prescribing the consuming domain's policy.
pub trait WorkspaceMembershipService: Send + Sync + 'static {
    /// Teams the user currently belongs to.
    fn teams(
        &self,
        user: &MacroUserIdStr<'static>,
    ) -> impl Future<Output = Result<Vec<uuid::Uuid>, TeamError>> + Send;
    /// Current role, or `None` when the user is not a member.
    fn role(
        &self,
        user: &MacroUserIdStr<'static>,
        team: uuid::Uuid,
    ) -> impl Future<Output = Result<Option<TeamRole>, TeamError>> + Send;
}

/// Membership service backed by the owning team's repository port.
#[derive(Clone)]
pub struct WorkspaceMembershipServiceImpl<R>(pub R);

impl<R: TeamRepository> WorkspaceMembershipService for WorkspaceMembershipServiceImpl<R> {
    async fn teams(&self, user: &MacroUserIdStr<'static>) -> Result<Vec<uuid::Uuid>, TeamError> {
        Ok(self
            .0
            .get_user_teams(user)
            .await?
            .iter()
            .map(|team| *team.id())
            .collect())
    }
    async fn role(
        &self,
        user: &MacroUserIdStr<'static>,
        team: uuid::Uuid,
    ) -> Result<Option<TeamRole>, TeamError> {
        self.0.get_team_role(&team, user).await
    }
}
