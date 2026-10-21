use axum::{Json, extract::State};
use entity_access::{
    domain::{models::MemberTeamRole, ports::EntityAccessService},
    inbound::axum_extractors::MacroUserTeamExtractorV2,
};
use macro_authorization::MacroAuthorizationService;
use model_error_response::ErrorResponse;
use serde::Deserialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::domain::{auth::CrmTeamReceipt, model::CrmError, service::CrmService};

use super::{CrmRouterState, get_deal::DealResponse};

/// Request body for `POST /crm/deals`.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDealRequest {
    /// The name shown on the deal card.
    pub name: String,
    /// Companies this deal involves. Each must already belong to the team.
    #[serde(default)]
    pub company_ids: Vec<Uuid>,
    /// People this deal involves. Each must already belong to the team.
    #[serde(default)]
    pub contact_ids: Vec<Uuid>,
    /// The free paragraph on the deal. Empty when omitted.
    #[serde(default)]
    pub description: String,
}

/// Create a deal for the caller's team. Any team member may create one.
/// The team's CRM killswitch must be on.
#[utoipa::path(
    post,
    path = "/crm/deals",
    operation_id = "create_crm_deal",
    request_body = CreateDealRequest,
    responses(
        (status = 200, body = DealResponse),
        (status = 400, body = ErrorResponse),
        (status = 401, body = ErrorResponse),
        (status = 403, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    ),
)]
#[tracing::instrument(skip_all, err)]
pub async fn handler<
    C: CrmService,
    St,
    Eas: EntityAccessService,
    Auth: MacroAuthorizationService,
>(
    access: MacroUserTeamExtractorV2<MemberTeamRole, Eas, Auth>,
    State(state): State<CrmRouterState<C, St, Eas, Auth>>,
    Json(req): Json<CreateDealRequest>,
) -> Result<Json<DealResponse>, CrmError> {
    let receipt = CrmTeamReceipt::from_team_receipt(access.entity_access_receipt)?;
    let deal = state
        .service
        .create_deal(
            &receipt,
            &req.name,
            &req.description,
            &req.company_ids,
            &req.contact_ids,
        )
        .await?;
    Ok(Json(deal.into()))
}
