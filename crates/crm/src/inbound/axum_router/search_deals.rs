//! Search the caller's team's deals by name.

use axum::{Json, extract::Query, extract::State};
use entity_access::{
    domain::{models::MemberTeamRole, ports::EntityAccessService},
    inbound::axum_extractors::MacroUserTeamExtractorV2,
};
use macro_authorization::MacroAuthorizationService;
use model_error_response::ErrorResponse;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::domain::{auth::CrmTeamReceipt, deals::DealMatch, model::CrmError, service::CrmService};

use super::CrmRouterState;

/// Deals returned when the request omits `limit`.
const DEFAULT_LIMIT: u16 = 20;

/// Query parameters for searching the caller's team's deals.
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct SearchDealsParams {
    /// Text the deal's name must contain. Empty lists the most recently
    /// updated deals.
    #[serde(default)]
    pub query: String,
    /// Maximum deals to return (1-50, default 20).
    pub limit: Option<u16>,
}

/// One deal a mention can point at.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DealMatchResponse {
    /// Deal id.
    pub id: Uuid,
    /// Name shown on the card.
    pub name: String,
}

impl From<DealMatch> for DealMatchResponse {
    fn from(deal: DealMatch) -> Self {
        Self {
            id: deal.id,
            name: deal.name,
        }
    }
}

/// Response from searching deals.
#[derive(Debug, Serialize, ToSchema)]
pub struct SearchDealsResponse {
    /// Matching deals, most recently updated first.
    pub deals: Vec<DealMatchResponse>,
}

/// Search the caller's team's deals by name.
#[utoipa::path(
    get,
    path = "/crm/deals",
    operation_id = "search_deals",
    params(SearchDealsParams),
    responses(
        (status = 200, body = SearchDealsResponse),
        (status = 401, body = ErrorResponse),
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
    Query(params): Query<SearchDealsParams>,
) -> Result<Json<SearchDealsResponse>, CrmError> {
    let receipt = CrmTeamReceipt::from_team_receipt(access.entity_access_receipt)?;
    let deals = state
        .service
        .search_deals(
            &receipt,
            &params.query,
            params.limit.unwrap_or(DEFAULT_LIMIT),
        )
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
    Ok(Json(SearchDealsResponse { deals }))
}
