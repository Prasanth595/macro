use crate::api::ApiContext;
use axum::{Router, routing::get};
pub(crate) mod drive_copies;
pub(crate) mod get;
pub(crate) mod get_document_id;

pub fn router(_state: ApiContext) -> Router<ApiContext> {
    Router::new()
        .route(
            "/by_document/{document_id}",
            get(drive_copies::for_document),
        )
        .route("/{id}", get(get::handler))
        .route("/{id}/document_id", get(get_document_id::handler))
        .route(
            "/{id}/drive_copies",
            get(drive_copies::list).post(drive_copies::register),
        )
}
