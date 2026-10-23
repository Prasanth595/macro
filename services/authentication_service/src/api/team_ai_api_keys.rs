//! A team's own Anthropic and OpenAI API keys for in-app AI chat.
//!
//! Members see which providers have a key; admins and the owner register or
//! remove one. The team is the caller's own team, resolved by the extractor,
//! never a path or body value. Like the Cursor key, a registered key is never
//! readable again through this API.

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, put},
};
use entity_access::{
    domain::models::{AdminTeamRole, MemberTeamRole},
    inbound::axum_extractors::MacroUserTeamExtractorV2,
};

use crate::api::ai_api_keys::{AiApiKeyError, AiApiKeys, AiProvider, PutAiApiKeyRequest};
use crate::api::context::{ApiContext, AuthorizationService, EntityAccessServiceType};

type MemberTeam =
    MacroUserTeamExtractorV2<MemberTeamRole, EntityAccessServiceType, AuthorizationService>;
type AdminTeam =
    MacroUserTeamExtractorV2<AdminTeamRole, EntityAccessServiceType, AuthorizationService>;

/// Routes for the team settings' AI API keys section.
pub fn router() -> Router<ApiContext> {
    Router::new()
        .route("/", get(list_handler))
        .route("/{provider}", put(put_handler).delete(delete_handler))
}

/// The providers the caller's team has its own AI API key for.
#[utoipa::path(
    get,
    path = "/team-ai-api-keys",
    operation_id = "get_team_ai_api_keys",
    responses(
        (status = 200, body = AiApiKeys),
        (status = 401, body = String),
        (status = 403, body = model::response::ErrorResponse),
    )
)]
#[tracing::instrument(skip_all, err)]
pub async fn list_handler(
    State(ctx): State<ApiContext>,
    team: MemberTeam,
) -> Result<Json<AiApiKeys>, AiApiKeyError> {
    let keys = ctx
        .model_provider_keys
        .list_team(&team.entity_access_receipt)
        .await?;
    Ok(Json(AiApiKeys::from(keys)))
}

/// Registers or replaces the team's key for a provider. Team admins on a
/// paid plan only.
#[utoipa::path(
    put,
    path = "/team-ai-api-keys/{provider}",
    operation_id = "put_team_ai_api_key",
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
    team: AdminTeam,
    Path(provider): Path<AiProvider>,
    Json(req): Json<PutAiApiKeyRequest>,
) -> Result<Json<AiApiKeys>, AiApiKeyError> {
    let keys = ctx
        .model_provider_keys
        .register_team(&team.entity_access_receipt, provider.into(), &req.api_key)
        .await?;
    Ok(Json(AiApiKeys::from(keys)))
}

/// Forgets the team's key for a provider. Team admins only.
///
/// Does not revoke the key at the provider; succeeds when there was none.
#[utoipa::path(
    delete,
    path = "/team-ai-api-keys/{provider}",
    operation_id = "delete_team_ai_api_key",
    params(("provider" = AiProvider, Path)),
    responses(
        (status = 200, body = AiApiKeys),
        (status = 401, body = String),
        (status = 403, body = model::response::ErrorResponse),
    )
)]
#[tracing::instrument(skip_all, err, fields(provider = ?provider))]
pub async fn delete_handler(
    State(ctx): State<ApiContext>,
    team: AdminTeam,
    Path(provider): Path<AiProvider>,
) -> Result<Json<AiApiKeys>, AiApiKeyError> {
    let keys = ctx
        .model_provider_keys
        .remove_team(&team.entity_access_receipt, provider.into())
        .await?;
    Ok(Json(AiApiKeys::from(keys)))
}
