//! Thin adapters for company and pipeline-entry links to database rows.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    http::StatusCode,
    routing::{delete, get},
};
use databases::domain::models::RowId;
use entity_access::domain::{
    models::{EditAccessLevel, EntityType, RequiredPermission, ViewAccessLevel},
    ports::EntityAccessService,
};
use macro_authorization::{
    MacroAuthorizationExtractor, MacroAuthorizationService, MacroAuthorizationState, UserOrInternal,
};
use uuid::Uuid;

use super::axum_extractors::CrmCompanyAccessLevelExtractor;
use crate::domain::{
    pipelines::PipelineError,
    row_links::{CrmRowLinks, LinkedRowReference, LinkedRows, RowLinkAccess},
};

/// Services used by CRM linked-row routes.
pub struct RowLinksRouterState<L, E, A> {
    /// CRM row-link domain service.
    pub service: Arc<L>,
    /// Receipt issuer.
    pub access: Arc<E>,
    /// Authentication state.
    pub authorization: MacroAuthorizationState<A>,
}

impl<L, E, A> Clone for RowLinksRouterState<L, E, A> {
    fn clone(&self) -> Self {
        Self {
            service: self.service.clone(),
            access: self.access.clone(),
            authorization: self.authorization.clone(),
        }
    }
}
impl<L, E, A> FromRef<RowLinksRouterState<L, E, A>> for Arc<E> {
    fn from_ref(state: &RowLinksRouterState<L, E, A>) -> Self {
        state.access.clone()
    }
}
impl<L, E, A> FromRef<RowLinksRouterState<L, E, A>> for MacroAuthorizationState<A> {
    fn from_ref(state: &RowLinksRouterState<L, E, A>) -> Self {
        state.authorization.clone()
    }
}

/// Merge under `/crm`; pipeline entry paths use the same `id` parameter as its router.
pub fn router<
    L: CrmRowLinks,
    E: EntityAccessService,
    A: MacroAuthorizationService,
    S: Send + Sync + 'static,
>(
    state: RowLinksRouterState<L, E, A>,
) -> Router<S> {
    Router::new()
        .route(
            "/companies/{company_id}/linked-rows",
            get(company_rows::<L, E, A>).put(link_company_row::<L, E, A>),
        )
        .route(
            "/companies/{company_id}/linked-rows/{source_row_id}",
            delete(unlink_company_row::<L, E, A>),
        )
        .route(
            "/pipelines/{id}/entries/{row_id}/linked-rows",
            get(entry_rows::<L, E, A>).put(link_entry_row::<L, E, A>),
        )
        .route(
            "/pipelines/{id}/entries/{row_id}/linked-rows/{source_row_id}",
            delete(unlink_entry_row::<L, E, A>),
        )
        .with_state(state)
}

/// Read authorized live previews of a company's linked database rows.
#[utoipa::path(get, path = "/crm/companies/{company_id}/linked-rows", operation_id = "get_crm_company_linked_rows",
    params(("company_id" = Uuid, Path)), responses((status = 200, body = LinkedRows)))]
pub async fn company_rows<L: CrmRowLinks, E: EntityAccessService, A: MacroAuthorizationService>(
    access: CrmCompanyAccessLevelExtractor<ViewAccessLevel, E, A>,
    State(state): State<RowLinksRouterState<L, E, A>>,
) -> Result<Json<LinkedRows>, PipelineError> {
    Ok(Json(
        state
            .service
            .list(RowLinkAccess::Company(access.receipt))
            .await?,
    ))
}

/// Link a readable database row to an editable company.
#[utoipa::path(put, path = "/crm/companies/{company_id}/linked-rows", operation_id = "link_crm_company_row",
    params(("company_id" = Uuid, Path)), request_body = LinkedRowReference, responses((status = 204)))]
pub async fn link_company_row<
    L: CrmRowLinks,
    E: EntityAccessService,
    A: MacroAuthorizationService,
>(
    access: CrmCompanyAccessLevelExtractor<EditAccessLevel, E, A>,
    State(state): State<RowLinksRouterState<L, E, A>>,
    Json(source): Json<LinkedRowReference>,
) -> Result<StatusCode, PipelineError> {
    state
        .service
        .link(RowLinkAccess::Company(access.receipt), source)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Unlink a source without changing its cells or sharing.
#[utoipa::path(delete, path = "/crm/companies/{company_id}/linked-rows/{source_row_id}", operation_id = "unlink_crm_company_row",
    params(("company_id" = Uuid, Path), ("source_row_id" = Uuid, Path)), responses((status = 204)))]
pub async fn unlink_company_row<
    L: CrmRowLinks,
    E: EntityAccessService,
    A: MacroAuthorizationService,
>(
    access: CrmCompanyAccessLevelExtractor<EditAccessLevel, E, A>,
    State(state): State<RowLinksRouterState<L, E, A>>,
    Path((_company_id, row)): Path<(Uuid, RowId)>,
) -> Result<StatusCode, PipelineError> {
    state
        .service
        .unlink(RowLinkAccess::Company(access.receipt), row)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Receipt-minting seam shared by the entry route adapters.
async fn entry_access<
    T: RequiredPermission,
    E: EntityAccessService,
    A: MacroAuthorizationService,
>(
    access: &E,
    auth: MacroAuthorizationExtractor<A, UserOrInternal>,
    id: Uuid,
    row: RowId,
) -> Result<RowLinkAccess<T>, PipelineError> {
    Ok(RowLinkAccess::Entry(
        access
            .generate_entity_access_receipt::<T>(
                &auth.authorization.user.macro_user_id,
                None,
                &id.to_string(),
                EntityType::CrmPipeline,
            )
            .await?,
        row,
    ))
}

/// Read the rows linked to this entry, independently of its company and stage.
#[utoipa::path(get, path = "/crm/pipelines/{id}/entries/{row_id}/linked-rows", operation_id = "get_crm_entry_linked_rows",
    params(("id" = Uuid, Path), ("row_id" = Uuid, Path)), responses((status = 200, body = LinkedRows)))]
pub async fn entry_rows<L: CrmRowLinks, E: EntityAccessService, A: MacroAuthorizationService>(
    auth: MacroAuthorizationExtractor<A, UserOrInternal>,
    State(state): State<RowLinksRouterState<L, E, A>>,
    Path((id, row)): Path<(Uuid, RowId)>,
) -> Result<Json<LinkedRows>, PipelineError> {
    Ok(Json(
        state
            .service
            .list(entry_access(state.access.as_ref(), auth, id, row).await?)
            .await?,
    ))
}

/// Link a readable database row to an editable entry.
#[utoipa::path(put, path = "/crm/pipelines/{id}/entries/{row_id}/linked-rows", operation_id = "link_crm_entry_row",
    params(("id" = Uuid, Path), ("row_id" = Uuid, Path)), request_body = LinkedRowReference, responses((status = 204)))]
pub async fn link_entry_row<
    L: CrmRowLinks,
    E: EntityAccessService,
    A: MacroAuthorizationService,
>(
    auth: MacroAuthorizationExtractor<A, UserOrInternal>,
    State(state): State<RowLinksRouterState<L, E, A>>,
    Path((id, row)): Path<(Uuid, RowId)>,
    Json(source): Json<LinkedRowReference>,
) -> Result<StatusCode, PipelineError> {
    state
        .service
        .link(
            entry_access(state.access.as_ref(), auth, id, row).await?,
            source,
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Remove this entry's link only, retaining every other target's references.
#[utoipa::path(delete, path = "/crm/pipelines/{id}/entries/{row_id}/linked-rows/{source_row_id}", operation_id = "unlink_crm_entry_row",
    params(("id" = Uuid, Path), ("row_id" = Uuid, Path), ("source_row_id" = Uuid, Path)), responses((status = 204)))]
pub async fn unlink_entry_row<
    L: CrmRowLinks,
    E: EntityAccessService,
    A: MacroAuthorizationService,
>(
    auth: MacroAuthorizationExtractor<A, UserOrInternal>,
    State(state): State<RowLinksRouterState<L, E, A>>,
    Path((id, row, source)): Path<(Uuid, RowId, RowId)>,
) -> Result<StatusCode, PipelineError> {
    state
        .service
        .unlink(
            entry_access(state.access.as_ref(), auth, id, row).await?,
            source,
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
