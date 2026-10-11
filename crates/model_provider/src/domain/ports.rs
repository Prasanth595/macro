//! Configuration storage and endpoint ports.
use super::models::*;
use async_trait::async_trait;
use std::sync::Arc;

/// Atomic encrypted workspace persistence.
#[async_trait]
pub trait ProviderStore: Send + Sync + 'static {
    /// Load the workspace or its empty initial configuration.
    async fn load(&self, workspace: &Workspace) -> Result<Settings, ProviderError>;
    /// Compare-and-swap against `settings.revision`, returning the new revision.
    async fn save(&self, workspace: &Workspace, settings: &Settings) -> Result<i64, ProviderError>;
}

/// Validated, pinned connections to configured endpoints.
#[async_trait]
pub trait ProviderEndpoint: Send + Sync + 'static {
    /// Discover model names. Endpoints without discovery can be configured manually.
    async fn discover(&self, provider: &Provider) -> Result<Vec<ProviderModel>, ProviderError>;
    /// Prepare a metered router without requiring built-in cloud credentials.
    async fn router(
        &self,
        provider: &Provider,
    ) -> Result<Arc<agent::ModelRouter<agent::MeteredHttpClient>>, ProviderError>;
}

/// Workspace models exposed to execution hosts, independent of persistence adapters.
#[async_trait]
pub trait WorkspaceModelService: Send + Sync + 'static {
    /// Current models available to this user.
    async fn catalog(
        &self,
        user: &macro_user_id::user_id::MacroUserIdStr<'static>,
    ) -> Result<Catalog, ProviderError>;
    /// Resolve an authorized workspace model; built-in ids yield `None`.
    async fn resolve(
        &self,
        user: &macro_user_id::user_id::MacroUserIdStr<'static>,
        model: &str,
    ) -> Result<Option<Arc<agent::ModelRouter<agent::MeteredHttpClient>>>, ProviderError>;
}
