//! Thin authenticated workspace provider HTTP adapter.
use crate::domain::{models::*, service::ProviderService};
use axum::{
    Json, Router,
    extract::{FromRef, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use macro_authorization::{
    MacroAuthorizationExtractor, MacroAuthorizationService, MacroAuthorizationState, UserOrInternal,
};
use serde::Deserialize;
use std::sync::Arc;
use teams::domain::workspace_membership::WorkspaceMembershipService;

/// Provider settings state, constructed by the host service.
pub struct ProviderRouterState<T, A> {
    /// Workspace policy service.
    pub service: Arc<ProviderService<T>>,
    /// Host authentication state.
    pub authorization_state: MacroAuthorizationState<A>,
}
impl<T, A> Clone for ProviderRouterState<T, A> {
    fn clone(&self) -> Self {
        Self {
            service: self.service.clone(),
            authorization_state: self.authorization_state.clone(),
        }
    }
}
impl<T, A> FromRef<ProviderRouterState<T, A>> for MacroAuthorizationState<A> {
    fn from_ref(state: &ProviderRouterState<T, A>) -> Self {
        state.authorization_state.clone()
    }
}
/// Register workspace settings and model catalog endpoints.
pub fn provider_router<T, A, Global>(state: ProviderRouterState<T, A>) -> Router<Global>
where
    T: WorkspaceMembershipService + Clone,
    A: MacroAuthorizationService,
    Global: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/ai/providers", get(settings::<T, A>).put(save::<T, A>))
        .route("/ai/providers/discover", post(discover::<T, A>))
        .route("/ai/models", get(catalog::<T, A>))
        .with_state(state)
}
#[derive(Deserialize)]
struct Scope {
    team_id: Option<uuid::Uuid>,
}
impl IntoResponse for ProviderError {
    fn into_response(self) -> Response {
        let status = match &self {
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::Conflict => StatusCode::CONFLICT,
            Self::Invalid(_) => StatusCode::BAD_REQUEST,
            Self::ModelUnavailable => StatusCode::NOT_FOUND,
            Self::Endpoint => StatusCode::BAD_GATEWAY,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(serde_json::json!({"error": self.to_string()}))).into_response()
    }
}
async fn settings<T: WorkspaceMembershipService + Clone, A: MacroAuthorizationService>(
    State(state): State<ProviderRouterState<T, A>>,
    user: MacroAuthorizationExtractor<A, UserOrInternal>,
    Query(scope): Query<Scope>,
) -> Result<Json<SettingsView>, ProviderError> {
    state
        .service
        .settings(&user.authorization.user.macro_user_id, scope.team_id)
        .await
        .map(Json)
}
async fn save<T: WorkspaceMembershipService + Clone, A: MacroAuthorizationService>(
    State(state): State<ProviderRouterState<T, A>>,
    user: MacroAuthorizationExtractor<A, UserOrInternal>,
    Query(scope): Query<Scope>,
    Json(input): Json<SettingsInput>,
) -> Result<Json<SettingsView>, ProviderError> {
    state
        .service
        .save(&user.authorization.user.macro_user_id, scope.team_id, input)
        .await
        .map(Json)
}
async fn discover<T: WorkspaceMembershipService + Clone, A: MacroAuthorizationService>(
    State(state): State<ProviderRouterState<T, A>>,
    user: MacroAuthorizationExtractor<A, UserOrInternal>,
    Query(scope): Query<Scope>,
    Json(input): Json<ProviderInput>,
) -> Result<Json<serde_json::Value>, ProviderError> {
    state
        .service
        .discover(&user.authorization.user.macro_user_id, scope.team_id, input)
        .await
        .map(|models| Json(serde_json::json!({ "models": models })))
}
async fn catalog<T: WorkspaceMembershipService + Clone, A: MacroAuthorizationService>(
    State(state): State<ProviderRouterState<T, A>>,
    user: MacroAuthorizationExtractor<A, UserOrInternal>,
) -> Result<Json<Catalog>, ProviderError> {
    state
        .service
        .catalog(&user.authorization.user.macro_user_id)
        .await
        .map(Json)
}
