use axum::body::to_bytes;

use super::*;
use crate::domain::templates::models::VariableKey;

async fn respond(error: anyhow::Error) -> (StatusCode, String) {
    let response = TemplateApiError::from(error).into_response();
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, String::from_utf8(body.to_vec()).unwrap())
}

#[tokio::test]
async fn template_errors_map_to_their_statuses() {
    for (error, status) in [
        (TemplatePolicyError::NotFound, StatusCode::NOT_FOUND),
        (TemplatePolicyError::RoutineNotFound, StatusCode::NOT_FOUND),
        (TemplatePolicyError::NotRebindable, StatusCode::CONFLICT),
        (
            TemplatePolicyError::UnsupportedSharing,
            StatusCode::BAD_REQUEST,
        ),
    ] {
        assert_eq!(respond(error.into()).await.0, status);
    }
}

#[tokio::test]
async fn binding_problems_name_each_variable() {
    let (status, body) = respond(
        TemplatePolicyError::InvalidBindings(vec![BindingProblem {
            key: VariableKey::agent(),
            problem: "Choose a value.".to_owned(),
        }])
        .into(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let body: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(body["problems"][0]["key"], "agent");
}

#[tokio::test]
async fn routine_errors_keep_the_routine_mapping() {
    let (status, _) =
        respond(crate::domain::models::ActionPolicyError::NoFutureFirings.into()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, body) = respond(anyhow::anyhow!("database exploded")).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(!body.contains("exploded"));
}
