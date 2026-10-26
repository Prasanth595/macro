//! Handler for a read-only grant on a project description.

use axum::{Json, extract::State};
use entity_access::domain::models::ViewAccessLevel;
use entity_access::domain::ports::EntityAccessService;
use entity_access::inbound::axum_extractors::InitiativeAccessExtractor;
use macro_authorization::MacroAuthorizationService;
use model_error_response::ErrorResponse;

use super::{InitiativeIdParams, InitiativeRouterState};
use crate::domain::{models::InitiativeError, ports::InitiativeService, reads::DescriptionReader};

/// Grant the caller read-only access to the project description, signed in or
/// not. Never creates the description.
#[utoipa::path(
    post,
    tag = "initiative",
    operation_id = "create_initiative_description_token",
    path = "/initiatives/{initiative_id}/description/token",
    params(InitiativeIdParams),
    responses(
        (status = 200, body = DescriptionReader),
        (status = 400, body = ErrorResponse),
        (status = 401, description = "The caller may not view the initiative", body = ErrorResponse),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
#[tracing::instrument(err, skip_all)]
pub async fn create_initiative_description_token_handler<S, Eas, Auth>(
    State(state): State<InitiativeRouterState<S, Eas, Auth>>,
    access: InitiativeAccessExtractor<ViewAccessLevel, Eas, Auth>,
) -> Result<Json<DescriptionReader>, InitiativeError>
where
    S: InitiativeService,
    Eas: EntityAccessService,
    Auth: MacroAuthorizationService,
{
    let reader = state
        .service
        .description_reader(access.entity_access_receipt)
        .await?;
    Ok(Json(reader))
}
