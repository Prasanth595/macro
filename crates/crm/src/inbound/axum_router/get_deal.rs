use axum::{
    Json,
    extract::{Path, State},
};
use entity_access::{
    domain::{models::MemberTeamRole, ports::EntityAccessService},
    inbound::axum_extractors::MacroUserTeamExtractorV2,
};
use macro_authorization::MacroAuthorizationService;
use model_error_response::ErrorResponse;
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::domain::{auth::CrmTeamReceipt, deals::Deal, model::CrmError, service::CrmService};

use super::CrmRouterState;

/// A deal and the companies and people it links.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DealResponse {
    /// Deal id.
    pub id: Uuid,
    /// Name shown on the card.
    pub name: String,
    /// Linked companies.
    pub company_ids: Vec<Uuid>,
    /// Linked people.
    pub contact_ids: Vec<Uuid>,
    /// The free paragraph. Empty when nobody has written it.
    pub description: String,
    /// The delivery project opened when the deal was won.
    pub delivery_initiative_id: Option<Uuid>,
}

impl From<Deal> for DealResponse {
    fn from(deal: Deal) -> Self {
        Self {
            id: deal.id,
            name: deal.name,
            company_ids: deal.company_ids,
            contact_ids: deal.contact_ids,
            description: deal.description,
            delivery_initiative_id: deal.delivery_initiative_id,
        }
    }
}

/// Fetch one deal owned by the caller's team.
#[utoipa::path(
    get,
    path = "/crm/deals/{deal_id}",
    operation_id = "get_crm_deal",
    params(("deal_id" = Uuid, Path, description = "Deal id")),
    responses(
        (status = 200, body = DealResponse),
        (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse),
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
    Path(deal_id): Path<Uuid>,
) -> Result<Json<DealResponse>, CrmError> {
    let receipt = CrmTeamReceipt::from_team_receipt(access.entity_access_receipt)?;
    let deal = state
        .service
        .get_deal(&receipt, &deal_id)
        .await?
        .ok_or(CrmError::DealNotFoundForTeam)?;
    Ok(Json(deal.into()))
}
