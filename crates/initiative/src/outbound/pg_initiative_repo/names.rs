use std::collections::HashMap;

use sqlx::PgPool;

use super::{AdapterError, map_sqlx};
use crate::domain::models::InitiativeError;
use crate::domain::reads::ProfileName;

pub(super) async fn task_names(
    pool: &PgPool,
    ids: &[String],
) -> Result<HashMap<String, String>, InitiativeError> {
    let rows = sqlx::query!(
        r#"SELECT d.id, d.name FROM "Document" d WHERE d.id = ANY($1)"#,
        ids,
    )
    .fetch_all(pool)
    .await
    .map_err(AdapterError::Sqlx)
    .map_err(map_sqlx)?;

    Ok(rows.into_iter().map(|row| (row.id, row.name)).collect())
}

/// Names the users set on their own profiles. `N/A` is the profile's unset placeholder.
pub(super) async fn profile_names(
    pool: &PgPool,
    ids: &[String],
) -> Result<Vec<ProfileName>, InitiativeError> {
    let rows = sqlx::query!(
        r#"
        SELECT
            u.id,
            NULLIF(mui.first_name, 'N/A') AS first_name,
            NULLIF(mui.last_name, 'N/A') AS last_name
        FROM "User" u
        JOIN macro_user_info mui ON mui.macro_user_id = u.macro_user_id
        WHERE u.id = ANY($1)
          AND (
            NULLIF(mui.first_name, 'N/A') IS NOT NULL
            OR NULLIF(mui.last_name, 'N/A') IS NOT NULL
          )
        ORDER BY u.id
        "#,
        ids,
    )
    .fetch_all(pool)
    .await
    .map_err(AdapterError::Sqlx)
    .map_err(map_sqlx)?;

    Ok(rows
        .into_iter()
        .map(|row| ProfileName {
            id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
        })
        .collect())
}
