//! Provider configuration; public views never contain credentials.
use macro_user_id::user_id::MacroUserIdStr;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A personal or team workspace, derived from the authenticated caller.
#[derive(Clone)]
pub enum Workspace {
    /// The user's personal workspace.
    Personal(MacroUserIdStr<'static>),
    /// A team's shared workspace.
    Team(Uuid),
}
impl Workspace {
    /// Stable storage namespace.
    pub fn key(&self) -> String {
        match self {
            Self::Personal(user) => user.as_ref().to_owned(),
            Self::Team(id) => id.to_string(),
        }
    }
}

/// A configured provider's stable identifier.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ProviderId(pub Uuid);
impl ProviderId {
    /// Provider segment used for routing, independent of its editable name.
    pub fn segment(self) -> String {
        format!("workspace-{}", self.0)
    }
}

/// One model exposed by a configured endpoint.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProviderModel {
    /// Exact model name sent to the endpoint.
    pub id: String,
    /// Human-readable label.
    pub name: String,
    /// Whether this model accepts image input.
    #[serde(default)]
    pub supports_images: bool,
}

/// Secret persisted only in the encrypted repository payload.
#[derive(Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ApiKey(pub String);

/// Stored provider, including its credential. Intentionally has no Debug impl.
#[derive(Clone, Serialize, Deserialize)]
pub struct Provider {
    /// Stable configuration id.
    pub id: ProviderId,
    /// Workspace-visible name.
    pub name: String,
    /// OpenAI-compatible API root, including `/v1` where required.
    pub base_url: String,
    /// Optional for local endpoints.
    pub api_key: Option<ApiKey>,
    /// Whether to advertise and execute this provider's models.
    pub enabled: bool,
    /// Explicitly configured models; discovery is optional.
    pub models: Vec<ProviderModel>,
}

/// Versioned workspace configuration, encrypted as a whole at rest.
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Settings {
    /// Optimistic concurrency token.
    pub revision: i64,
    /// Configured endpoints.
    pub providers: Vec<Provider>,
    /// Qualified model id to use for new conversations.
    pub default_model: Option<String>,
}

/// Provider metadata returned to clients.
#[derive(Clone, Serialize, Deserialize)]
pub struct ProviderView {
    /// Stable configuration id.
    pub id: ProviderId,
    /// Workspace-visible name.
    pub name: String,
    /// OpenAI-compatible API root.
    pub base_url: String,
    /// Only credential presence is disclosed.
    pub has_api_key: bool,
    /// Whether the provider is enabled.
    pub enabled: bool,
    /// Models exposed by this provider.
    pub models: Vec<ProviderModel>,
}
impl From<&Provider> for ProviderView {
    fn from(provider: &Provider) -> Self {
        Self {
            id: provider.id,
            name: provider.name.clone(),
            base_url: provider.base_url.clone(),
            has_api_key: provider.api_key.is_some(),
            enabled: provider.enabled,
            models: provider.models.clone(),
        }
    }
}

/// Workspace settings response.
#[derive(Serialize)]
pub struct SettingsView {
    /// Revision to send with the next update.
    pub revision: i64,
    /// Whether this caller may edit this workspace.
    pub can_edit: bool,
    /// Redacted provider metadata.
    pub providers: Vec<ProviderView>,
    /// Qualified default model id.
    pub default_model: Option<String>,
}

/// Provider update; omitting the key preserves it, clearing requires an explicit flag.
#[derive(Deserialize)]
pub struct ProviderInput {
    /// Stable id generated once when adding the provider.
    pub id: ProviderId,
    /// Workspace-visible name.
    pub name: String,
    /// OpenAI-compatible API root.
    pub base_url: String,
    /// Replacement key, never returned by the API.
    pub api_key: Option<String>,
    /// Explicitly remove a stored key.
    #[serde(default)]
    pub clear_api_key: bool,
    /// Whether to expose this endpoint.
    pub enabled: bool,
    /// Models available for selection.
    pub models: Vec<ProviderModel>,
}

/// Replace configuration atomically, rejecting stale revisions.
#[derive(Deserialize)]
pub struct SettingsInput {
    /// Expected current revision.
    pub revision: i64,
    /// Full provider list.
    pub providers: Vec<ProviderInput>,
    /// Qualified default model id.
    pub default_model: Option<String>,
}

/// A selectable workspace model.
#[derive(Clone, Serialize)]
pub struct CatalogModel {
    /// `workspace-<provider-uuid>/<wire-model>`.
    pub id: String,
    /// Model label.
    pub name: String,
    /// Provider label.
    pub provider: String,
    /// Image capability configured by the administrator.
    pub supports_images: bool,
}

/// Available custom models across the caller's personal and team workspaces.
#[derive(Default, Serialize)]
pub struct Catalog {
    /// Enabled models.
    pub models: Vec<CatalogModel>,
    /// Personal default, or a team default when none is set personally.
    pub default_model: Option<String>,
}

/// Provider operation failures; external response bodies are never disclosed.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    /// Caller is not a member or lacks workspace edit privileges.
    #[error("You do not have access to these AI provider settings")]
    Forbidden,
    /// Concurrent update; reload before retrying.
    #[error("AI provider settings changed. Reload and try again")]
    Conflict,
    /// Invalid configuration.
    #[error("{0}")]
    Invalid(String),
    /// Removed, disabled, or inaccessible model.
    #[error("This workspace model is no longer available")]
    ModelUnavailable,
    /// Endpoint unreachable or incompatible.
    #[error("Could not connect to the model endpoint. Check its URL and API key")]
    Endpoint,
    /// Persistent storage failure.
    #[error("Unable to load or save AI provider settings")]
    Storage(#[source] Box<dyn std::error::Error + Send + Sync>),
    /// Credential encryption or decryption failed.
    #[error("Unable to protect AI provider credentials")]
    Encryption,
    /// Membership lookup failure.
    #[error("Unable to verify workspace membership")]
    Membership(#[from] teams::domain::model::TeamError),
}
