//! HTTP surface for routine templates. Mounted only while
//! `ROUTINE_TEMPLATES_ENABLED` is on.

use std::sync::Arc;

use axum::extract::{FromRef, Path, State, rejection::JsonRejection};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use macro_authorization::{
    MacroAuthorizationExtractor, MacroAuthorizationService, MacroAuthorizationState, UserOrInternal,
};
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use models_permissions::share_permission::{SharePermissionV2, UpdateSharePermissionRequestV2};
use serde::Serialize;
use utoipa::ToSchema;

use super::axum_router::{ScheduledActionApiError, ScheduledActionResponse};
use crate::domain::templates::models::RoutineTemplate;
use crate::domain::templates::ports::{
    ActivateTemplateRequest, BindingProblem, CreateTemplateRequest, ExtractTemplateRequest,
    ExtractedTemplate, FillTemplateRequest, FillTemplateResponse, RebindTemplateRequest,
    RoutineProvenance, RoutineTemplateService, TemplateView, UpdateTemplateRequest,
};
use crate::domain::templates::service::TemplatePolicyError;

#[cfg(test)]
mod test;

pub struct TemplateRouterState<S, Auth> {
    pub service: Arc<S>,
    pub authorization_state: MacroAuthorizationState<Auth>,
}

impl<S, Auth> Clone for TemplateRouterState<S, Auth> {
    fn clone(&self) -> Self {
        Self {
            service: Arc::clone(&self.service),
            authorization_state: self.authorization_state.clone(),
        }
    }
}

impl<S, Auth> FromRef<TemplateRouterState<S, Auth>> for MacroAuthorizationState<Auth> {
    fn from_ref(state: &TemplateRouterState<S, Auth>) -> Self {
        state.authorization_state.clone()
    }
}

type Caller<Auth> = MacroAuthorizationExtractor<Auth, UserOrInternal>;

fn caller<Auth>(caller: &Caller<Auth>) -> &MacroUserIdStr<'static> {
    &caller.authorization.user.macro_user_id
}

pub fn template_router<S, Auth, St>(state: TemplateRouterState<S, Auth>) -> Router<St>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
    St: Send + Sync,
{
    Router::new()
        .route(
            "/routine-templates/extract",
            post(extract_template::<S, Auth>),
        )
        .route("/routine-templates", post(create_template::<S, Auth>))
        .route(
            "/routine-templates/{id}",
            get(get_template::<S, Auth>)
                .put(update_template::<S, Auth>)
                .delete(delete_template::<S, Auth>),
        )
        .route(
            "/routine-templates/{id}/fill",
            post(fill_template::<S, Auth>),
        )
        .route(
            "/routine-templates/{id}/activate",
            post(activate_template::<S, Auth>),
        )
        .route(
            "/routine-templates/{id}/permissions",
            get(get_template_permissions::<S, Auth>).patch(update_template_permissions::<S, Auth>),
        )
        .route(
            "/scheduled-actions/{id}/template",
            get(get_routine_provenance::<S, Auth>),
        )
        .route(
            "/scheduled-actions/{id}/template/bindings",
            put(rebind_routine::<S, Auth>),
        )
        .with_state(state)
}

fn body<T>(body: Result<Json<T>, JsonRejection>) -> Result<T, TemplateApiError> {
    body.map(|Json(body)| body)
        .map_err(|rejection| TemplateApiError(ScheduledActionApiError::InvalidRequest(rejection)))
}

#[utoipa::path(
    post,
    path = "/routine-templates/extract",
    tag = "routine templates",
    operation_id = "extract_routine_template",
    request_body = ExtractTemplateRequest,
    responses(
        (status = 200, body = ExtractedTemplate),
        (status = 400, body = String),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn extract_template<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    request: Result<Json<ExtractTemplateRequest>, JsonRejection>,
) -> Result<Json<ExtractedTemplate>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    let request = body(request)?;
    Ok(Json(
        state
            .service
            .extract(caller(&user), request.source_action_id)
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/routine-templates",
    tag = "routine templates",
    operation_id = "create_routine_template",
    request_body = CreateTemplateRequest,
    responses(
        (status = 201, body = RoutineTemplate),
        (status = 400, body = String),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn create_template<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    request: Result<Json<CreateTemplateRequest>, JsonRejection>,
) -> Result<impl IntoResponse, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    let request = body(request)?;
    let template = state.service.create(caller(&user), request).await?;
    Ok((StatusCode::CREATED, Json(template)))
}

#[utoipa::path(
    get,
    path = "/routine-templates/{id}",
    tag = "routine templates",
    operation_id = "get_routine_template",
    params(("id" = String, Path, description = "Routine template id")),
    responses(
        (status = 200, body = TemplateView),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn get_template<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateView>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    Ok(Json(state.service.get(caller(&user), id).await?))
}

#[utoipa::path(
    put,
    path = "/routine-templates/{id}",
    tag = "routine templates",
    operation_id = "update_routine_template",
    params(("id" = String, Path, description = "Routine template id")),
    request_body = UpdateTemplateRequest,
    responses(
        (status = 200, body = RoutineTemplate),
        (status = 400, body = String),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn update_template<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
    request: Result<Json<UpdateTemplateRequest>, JsonRejection>,
) -> Result<Json<RoutineTemplate>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    let request = body(request)?;
    Ok(Json(
        state
            .service
            .update(caller(&user), id, request.draft)
            .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/routine-templates/{id}",
    tag = "routine templates",
    operation_id = "delete_routine_template",
    params(("id" = String, Path, description = "Routine template id")),
    responses(
        (status = 204),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn delete_template<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    state.service.delete(caller(&user), id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/routine-templates/{id}/fill",
    tag = "routine templates",
    operation_id = "fill_routine_template",
    params(("id" = String, Path, description = "Routine template id")),
    request_body = FillTemplateRequest,
    responses(
        (status = 200, body = FillTemplateResponse),
        (status = 400, body = String),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn fill_template<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
    request: Result<Json<FillTemplateRequest>, JsonRejection>,
) -> Result<Json<FillTemplateResponse>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    let request = body(request)?;
    Ok(Json(state.service.fill(caller(&user), id, request).await?))
}

#[utoipa::path(
    post,
    path = "/routine-templates/{id}/activate",
    tag = "routine templates",
    operation_id = "activate_routine_template",
    params(("id" = String, Path, description = "Routine template id")),
    request_body = ActivateTemplateRequest,
    responses(
        (status = 201, body = ScheduledActionResponse),
        (status = 400, body = TemplateBindingErrors),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn activate_template<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
    request: Result<Json<ActivateTemplateRequest>, JsonRejection>,
) -> Result<impl IntoResponse, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    let request = body(request)?;
    let action = state.service.activate(caller(&user), id, request).await?;
    Ok((
        StatusCode::CREATED,
        Json(ScheduledActionResponse::from(action)),
    ))
}

#[utoipa::path(
    get,
    path = "/routine-templates/{id}/permissions",
    tag = "routine templates",
    operation_id = "get_routine_template_permissions",
    params(("id" = String, Path, description = "Routine template id")),
    responses(
        (status = 200, body = SharePermissionV2),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn get_template_permissions<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
) -> Result<Json<SharePermissionV2>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    Ok(Json(
        state.service.share_permissions(caller(&user), id).await?,
    ))
}

#[utoipa::path(
    patch,
    path = "/routine-templates/{id}/permissions",
    tag = "routine templates",
    operation_id = "update_routine_template_permissions",
    params(("id" = String, Path, description = "Routine template id")),
    request_body = UpdateSharePermissionRequestV2,
    responses(
        (status = 200, body = SharePermissionV2),
        (status = 400, body = String),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn update_template_permissions<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
    request: Result<Json<UpdateSharePermissionRequestV2>, JsonRejection>,
) -> Result<Json<SharePermissionV2>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    let request = body(request)?;
    Ok(Json(
        state
            .service
            .update_share_permissions(caller(&user), id, request)
            .await?,
    ))
}

#[utoipa::path(
    get,
    path = "/scheduled-actions/{id}/template",
    tag = "routine templates",
    operation_id = "get_routine_template_provenance",
    params(("id" = String, Path, description = "ID of the scheduled action")),
    responses(
        (status = 200, body = RoutineProvenanceResponse),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 500, body = String),
    )
)]
pub async fn get_routine_provenance<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoutineProvenanceResponse>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    Ok(Json(RoutineProvenanceResponse {
        provenance: state.service.provenance(caller(&user), id).await?,
    }))
}

/// The template a routine came from; absent for a routine made by hand.
#[derive(Debug, Serialize, ToSchema)]
pub struct RoutineProvenanceResponse {
    pub provenance: Option<RoutineProvenance>,
}

#[utoipa::path(
    put,
    path = "/scheduled-actions/{id}/template/bindings",
    tag = "routine templates",
    operation_id = "rebind_routine_template",
    params(("id" = String, Path, description = "ID of the scheduled action")),
    request_body = RebindTemplateRequest,
    responses(
        (status = 200, body = ScheduledActionResponse),
        (status = 400, body = TemplateBindingErrors),
        (status = 401, body = String),
        (status = 404, body = String),
        (status = 409, body = String, description = "The routine was edited after activation"),
        (status = 500, body = String),
    )
)]
pub async fn rebind_routine<S, Auth>(
    State(state): State<TemplateRouterState<S, Auth>>,
    user: Caller<Auth>,
    Path(id): Path<Uuid>,
    request: Result<Json<RebindTemplateRequest>, JsonRejection>,
) -> Result<Json<ScheduledActionResponse>, TemplateApiError>
where
    S: RoutineTemplateService,
    Auth: MacroAuthorizationService,
{
    let request = body(request)?;
    let action = state.service.rebind(caller(&user), id, request).await?;
    Ok(Json(ScheduledActionResponse::from(action)))
}

/// Why the given bindings can't be used, per variable.
#[derive(Debug, Serialize, ToSchema)]
pub struct TemplateBindingErrors {
    pub message: String,
    pub problems: Vec<BindingProblem>,
}

/// Template errors, falling back to the routine API's mapping for the
/// routine create and update paths activation goes through.
pub struct TemplateApiError(ScheduledActionApiError);

impl From<anyhow::Error> for TemplateApiError {
    fn from(error: anyhow::Error) -> Self {
        Self(ScheduledActionApiError::Service(error))
    }
}

impl IntoResponse for TemplateApiError {
    fn into_response(self) -> axum::response::Response {
        let error = match self.0 {
            ScheduledActionApiError::Service(error) => error,
            other => return other.into_response(),
        };
        let Some(policy) = error.downcast_ref::<TemplatePolicyError>() else {
            return ScheduledActionApiError::Service(error).into_response();
        };
        let status = match policy {
            TemplatePolicyError::NotFound | TemplatePolicyError::RoutineNotFound => {
                StatusCode::NOT_FOUND
            }
            TemplatePolicyError::NotRebindable => StatusCode::CONFLICT,
            TemplatePolicyError::InvalidBindings(problems) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(TemplateBindingErrors {
                        message: policy.to_string(),
                        problems: problems.clone(),
                    }),
                )
                    .into_response();
            }
            TemplatePolicyError::Invalid(_)
            | TemplatePolicyError::Render(_)
            | TemplatePolicyError::UnsupportedSharing
            | TemplatePolicyError::InstructionTooLong => StatusCode::BAD_REQUEST,
        };
        (status, policy.to_string()).into_response()
    }
}
