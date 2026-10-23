//! A person's own Anthropic and OpenAI API keys for in-app AI chat, and the
//! types they share with a team's (`team_ai_api_keys`).
//!
//! The owner is always the caller, never a path or body value. Like the
//! Cursor key, a registered key is never readable again through this API.

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, put},
};
use macro_authorization::{MacroAuthorizationExtractor, UserOnly};
use model_provider_keys::domain::{
    ModelProvider, ProviderKeyError, ProviderKeyList, ProviderKeyStatus,
};
use utoipa::ToSchema;

use crate::api::context::{ApiContext, AuthorizationService};

type Caller = MacroAuthorizationExtractor<AuthorizationService, UserOnly>;

/// Routes for the account settings' AI API keys section.
pub fn router() -> Router<ApiContext> {
    Router::new()
        .route("/", get(list_handler))
        .route("/{provider}", put(put_handler).delete(delete_handler))
}

/// A provider a person or team can bring its own key for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    /// Anthropic (`sk-ant-…` keys).
    Anthropic,
    /// OpenAI (`sk-…` keys).
    Openai,
}

impl From<AiProvider> for ModelProvider {
    fn from(provider: AiProvider) -> Self {
        match provider {
            AiProvider::Anthropic => Self::Anthropic,
            AiProvider::Openai => Self::OpenAi,
        }
    }
}

impl From<ModelProvider> for AiProvider {
    fn from(provider: ModelProvider) -> Self {
        match provider {
            ModelProvider::Anthropic => Self::Anthropic,
            ModelProvider::OpenAi => Self::Openai,
        }
    }
}

/// One provider there is a key for. Never includes the key.
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AiApiKey {
    /// The provider.
    pub provider: AiProvider,
    /// When the key was last replaced.
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<ProviderKeyStatus> for AiApiKey {
    fn from(status: ProviderKeyStatus) -> Self {
        Self {
            provider: status.provider.into(),
            updated_at: status.updated_at,
        }
    }
}

/// The providers there is a key for.
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AiApiKeys {
    /// One entry per provider with a key.
    pub keys: Vec<AiApiKey>,
    /// Whether the caller's plan lets them save keys and run AI chat on
    /// them. Keys saved before a downgrade are still listed when it doesn't.
    pub usable: bool,
}

impl From<ProviderKeyList> for AiApiKeys {
    fn from(list: ProviderKeyList) -> Self {
        Self {
            keys: list.keys.into_iter().map(Into::into).collect(),
            usable: list.usable,
        }
    }
}

/// The key someone pasted.
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PutAiApiKeyRequest {
    /// An Anthropic (`sk-ant-…`) or OpenAI (`sk-…`) API key.
    pub api_key: String,
}

/// Why an AI API key request failed.
#[derive(Debug, thiserror::Error)]
pub enum AiApiKeyError {
    /// The value is not a key for the provider.
    #[error("value does not look like an API key for this provider")]
    MalformedKey,
    /// The caller's plan does not include their own AI API keys.
    #[error("AI API keys are part of the Premium and Max plans")]
    PlanRequired,
    /// Encryption or storage failed.
    #[error("internal error")]
    Internal,
}

impl From<ProviderKeyError> for AiApiKeyError {
    fn from(error: ProviderKeyError) -> Self {
        match error {
            ProviderKeyError::MalformedKey => Self::MalformedKey,
            ProviderKeyError::PlanRequired => Self::PlanRequired,
            other => {
                tracing::error!(error = ?other, "ai api key operation failed");
                Self::Internal
            }
        }
    }
}

impl axum::response::IntoResponse for AiApiKeyError {
    fn into_response(self) -> axum::response::Response {
        use axum::http::StatusCode;
        let status = match self {
            Self::MalformedKey => StatusCode::BAD_REQUEST,
            Self::PlanRequired => StatusCode::FORBIDDEN,
            Self::Internal => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (
            status,
            Json(model::response::ErrorResponse {
                message: self.to_string().into(),
            }),
        )
            .into_response()
    }
}

/// The providers the caller has their own AI API key for.
#[utoipa::path(
    get,
    path = "/ai-api-keys",
    operation_id = "get_ai_api_keys",
    responses(
        (status = 200, body = AiApiKeys),
        (status = 401, body = String),
    )
)]
#[tracing::instrument(skip_all, err)]
pub async fn list_handler(
    State(ctx): State<ApiContext>,
    caller: Caller,
) -> Result<Json<AiApiKeys>, AiApiKeyError> {
    let keys = ctx
        .model_provider_keys
        .list_personal(&caller.authorization.macro_user_id)
        .await?;
    Ok(Json(AiApiKeys::from(keys)))
}

/// Registers or replaces the caller's own key for a provider. Needs a paid
/// plan.
#[utoipa::path(
    put,
    path = "/ai-api-keys/{provider}",
    operation_id = "put_ai_api_key",
    params(("provider" = AiProvider, Path)),
    request_body = PutAiApiKeyRequest,
    responses(
        (status = 200, body = AiApiKeys),
        (status = 400, body = model::response::ErrorResponse),
        (status = 401, body = String),
        (status = 403, body = model::response::ErrorResponse),
    )
)]
// The body is skipped: it is the key itself.
#[tracing::instrument(skip_all, err, fields(provider = ?provider))]
pub async fn put_handler(
    State(ctx): State<ApiContext>,
    caller: Caller,
    Path(provider): Path<AiProvider>,
    Json(req): Json<PutAiApiKeyRequest>,
) -> Result<Json<AiApiKeys>, AiApiKeyError> {
    let keys = ctx
        .model_provider_keys
        .register_personal(
            &caller.authorization.macro_user_id,
            provider.into(),
            &req.api_key,
        )
        .await?;
    Ok(Json(AiApiKeys::from(keys)))
}

/// Forgets the caller's own key for a provider.
///
/// Does not revoke the key at the provider; succeeds when there was none.
#[utoipa::path(
    delete,
    path = "/ai-api-keys/{provider}",
    operation_id = "delete_ai_api_key",
    params(("provider" = AiProvider, Path)),
    responses(
        (status = 200, body = AiApiKeys),
        (status = 401, body = String),
    )
)]
#[tracing::instrument(skip_all, err, fields(provider = ?provider))]
pub async fn delete_handler(
    State(ctx): State<ApiContext>,
    caller: Caller,
    Path(provider): Path<AiProvider>,
) -> Result<Json<AiApiKeys>, AiApiKeyError> {
    let keys = ctx
        .model_provider_keys
        .remove_personal(&caller.authorization.macro_user_id, provider.into())
        .await?;
    Ok(Json(AiApiKeys::from(keys)))
}
