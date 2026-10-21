use axum::{
    Json,
    extract::{Path, State},
};
use entity_access::domain::{models::ViewAccessLevel, ports::EntityAccessService};
use macro_authorization::MacroAuthorizationService;
use model_error_response::ErrorResponse;
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    domain::{deals::CompanyDeal, model::CrmError, service::CrmService},
    inbound::axum_extractors::CrmCompanyAccessLevelExtractor,
};

use super::CrmRouterState;

/// A deal linked to the company. The pipeline facts are display-only.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CompanyDealResponse {
    /// Deal id.
    pub id: Uuid,
    /// Name shown on the card.
    pub name: String,
    /// Deal pipeline that holds the row.
    pub pipeline_id: Option<Uuid>,
    /// That pipeline's name.
    pub pipeline_name: Option<String>,
    /// Stage label.
    pub stage: Option<String>,
    /// Outcome label.
    pub outcome: Option<String>,
    /// Date cell, as `YYYY-MM-DD`.
    pub when_on: Option<String>,
    /// Revenue, as stored.
    pub revenue: Option<String>,
    /// Delivery project opened when the deal was won.
    pub delivery_initiative_id: Option<Uuid>,
}

impl From<CompanyDeal> for CompanyDealResponse {
    fn from(deal: CompanyDeal) -> Self {
        Self {
            id: deal.id,
            name: deal.name,
            pipeline_id: deal.pipeline_id,
            pipeline_name: deal.pipeline_name,
            stage: deal.stage,
            outcome: deal.outcome,
            when_on: deal.when_on,
            revenue: deal.revenue,
            delivery_initiative_id: deal.delivery_initiative_id,
        }
    }
}

/// Deals linked to a company. Nothing here edits the deal.
#[utoipa::path(
    get,
    path = "/crm/companies/{company_id}/deals",
    operation_id = "list_company_deals",
    params(("company_id" = Uuid, Path, description = "Company id")),
    responses(
        (status = 200, body = [CompanyDealResponse]),
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
    access: CrmCompanyAccessLevelExtractor<ViewAccessLevel, Eas, Auth>,
    State(state): State<CrmRouterState<C, St, Eas, Auth>>,
    Path(_company_id): Path<Uuid>,
) -> Result<Json<Vec<CompanyDealResponse>>, CrmError> {
    let deals = state.service.list_company_deals(&access.receipt).await?;
    Ok(Json(deals.into_iter().map(Into::into).collect()))
}
