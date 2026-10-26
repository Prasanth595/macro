use crate::api::context::{ApiContext, AuthorizationService};
use crate::api::email::drafts::attachment_error::AttachmentApiError;
use axum::{
    Json,
    extract::{Path, State},
};
use macro_authorization::{MacroAuthorizationExtractor, UserOrInternal};
use model::response::ErrorResponse;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct AttachmentDriveCopyResponse {
    pub document_id: String,
    pub name: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct ListAttachmentDriveCopiesResponse {
    pub copies: Vec<AttachmentDriveCopyResponse>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct RegisterAttachmentDriveCopyRequest {
    pub document_id: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct RegisterAttachmentDriveCopyResponse {
    pub document_id: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct AttachmentForDocumentResponse {
    pub attachment_id: Option<Uuid>,
}

/// Drive documents the caller saved from this email attachment.
#[utoipa::path(
    get,
    tag = "Attachments",
    path = "/email/attachments/{id}/drive_copies",
    operation_id = "list_attachment_drive_copies",
    params(
        ("id" = Uuid, Path, description = "Attachment ID."),
    ),
    responses(
        (status = 200, body = ListAttachmentDriveCopiesResponse),
        (status = 401, body = ErrorResponse),
        (status = 403, body = ErrorResponse),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
#[tracing::instrument(skip(ctx, authorization), err)]
pub async fn list(
    State(ctx): State<ApiContext>,
    authorization: MacroAuthorizationExtractor<AuthorizationService, UserOrInternal>,
    Path(id): Path<Uuid>,
) -> Result<Json<ListAttachmentDriveCopiesResponse>, AttachmentApiError> {
    let copies = ctx
        .attachment_reads
        .list_drive_copies(&authorization.authorization.user.macro_user_id, id)
        .await?;
    Ok(Json(ListAttachmentDriveCopiesResponse {
        copies: copies
            .into_iter()
            .map(|copy| AttachmentDriveCopyResponse {
                document_id: copy.document_id,
                name: copy.name,
            })
            .collect(),
    }))
}

/// Record a Drive document as the caller's copy of this email attachment.
#[utoipa::path(
    post,
    tag = "Attachments",
    path = "/email/attachments/{id}/drive_copies",
    operation_id = "register_attachment_drive_copy",
    params(
        ("id" = Uuid, Path, description = "Attachment ID."),
    ),
    request_body = RegisterAttachmentDriveCopyRequest,
    responses(
        (status = 200, body = RegisterAttachmentDriveCopyResponse),
        (status = 400, body = ErrorResponse),
        (status = 401, body = ErrorResponse),
        (status = 403, body = ErrorResponse),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
#[tracing::instrument(skip(ctx, authorization), err)]
pub async fn register(
    State(ctx): State<ApiContext>,
    authorization: MacroAuthorizationExtractor<AuthorizationService, UserOrInternal>,
    Path(id): Path<Uuid>,
    Json(body): Json<RegisterAttachmentDriveCopyRequest>,
) -> Result<Json<RegisterAttachmentDriveCopyResponse>, AttachmentApiError> {
    ctx.attachment_reads
        .register_drive_copy(
            &authorization.authorization.user.macro_user_id,
            id,
            &body.document_id,
        )
        .await?;
    Ok(Json(RegisterAttachmentDriveCopyResponse {
        document_id: body.document_id,
    }))
}

/// The email attachment this document was created from, if it is one.
#[utoipa::path(
    get,
    tag = "Attachments",
    path = "/email/attachments/by_document/{document_id}",
    operation_id = "attachment_for_document",
    params(
        ("document_id" = String, Path, description = "Document ID."),
    ),
    responses(
        (status = 200, body = AttachmentForDocumentResponse),
        (status = 401, body = ErrorResponse),
        (status = 403, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
#[tracing::instrument(skip(ctx, authorization), err)]
pub async fn for_document(
    State(ctx): State<ApiContext>,
    authorization: MacroAuthorizationExtractor<AuthorizationService, UserOrInternal>,
    Path(document_id): Path<String>,
) -> Result<Json<AttachmentForDocumentResponse>, AttachmentApiError> {
    let attachment_id = ctx
        .attachment_reads
        .attachment_for_document(
            &authorization.authorization.user.macro_user_id,
            &document_id,
        )
        .await?;
    Ok(Json(AttachmentForDocumentResponse { attachment_id }))
}
