use std::borrow::Cow;

use crate::{
    AuthedClient, Result,
    error::{FusionAuthClientError, GenericErrorResponse},
};

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct RevokeRefreshTokenRequest<'a> {
    /// The refresh token to revoke. Sent in the body rather than the query so
    /// the token stays out of request logs.
    pub token: Cow<'a, str>,
}

/// Revokes a single refresh token. A token FusionAuth does not know (already
/// revoked or expired) counts as revoked, so callers can retry.
/// https://fusionauth.io/docs/apis/jwt#revoke-refresh-tokens
/// Valid respones: 200, 400, 401, 404, 500, 503
pub(crate) async fn revoke_refresh_token(
    client: &AuthedClient,
    base_url: &str,
    refresh_token: &str,
) -> Result<()> {
    let res = client
        .client()
        .delete(format!("{base_url}/api/jwt/refresh"))
        .json(&RevokeRefreshTokenRequest {
            token: Cow::Borrowed(refresh_token),
        })
        .send()
        .await
        .map_err(|e| {
            FusionAuthClientError::Generic(GenericErrorResponse {
                message: e.to_string(),
            })
        })?;

    match res.status() {
        reqwest::StatusCode::OK | reqwest::StatusCode::NOT_FOUND => {
            tracing::trace!("refresh token revoked");
            Ok(())
        }
        status => {
            let body = res.text().await.map_err(|e| {
                FusionAuthClientError::Generic(GenericErrorResponse {
                    message: e.to_string(),
                })
            })?;

            tracing::error!(body=%body, %status, "unexpected response from fusionauth");

            Err(FusionAuthClientError::Generic(GenericErrorResponse {
                message: body,
            }))
        }
    }
}
