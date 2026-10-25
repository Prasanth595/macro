//! Handler for reading a project page without changing it.

use axum::{Json, extract::State};
use entity_access::domain::models::ViewAccessLevel;
use entity_access::domain::ports::EntityAccessService;
use entity_access::inbound::axum_extractors::InitiativeAccessExtractor;
use macro_authorization::MacroAuthorizationService;
use model_error_response::ErrorResponse;

use super::{InitiativeIdParams, InitiativeRouterState};
use crate::domain::{models::InitiativeError, ports::InitiativeService, reads::InitiativeOverview};

/// Read a project page the caller can view, signed in or not.
#[utoipa::path(
    get,
    tag = "initiative",
    operation_id = "get_initiative_overview",
    path = "/initiatives/{initiative_id}/overview",
    params(InitiativeIdParams),
    responses(
        (status = 200, body = InitiativeOverview),
        (status = 400, body = ErrorResponse),
        (status = 401, description = "The caller may not view the initiative", body = ErrorResponse),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
#[tracing::instrument(err, skip_all)]
pub async fn get_initiative_overview_handler<S, Eas, Auth>(
    State(state): State<InitiativeRouterState<S, Eas, Auth>>,
    access: InitiativeAccessExtractor<ViewAccessLevel, Eas, Auth>,
) -> Result<Json<InitiativeOverview>, InitiativeError>
where
    S: InitiativeService,
    Eas: EntityAccessService,
    Auth: MacroAuthorizationService,
{
    let overview = state.service.overview(access.entity_access_receipt).await?;
    Ok(Json(overview))
}
