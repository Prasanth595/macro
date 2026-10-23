//! Routine-template grants in `entity_access`.

use crate::{domain::models::AccessLevel, outbound::pg_access_repo::queries::SourceIds};
use sqlx::PgPool;

/// Highest grant the caller's sources hold on one routine template.
#[tracing::instrument(err, skip(pool, source_ids))]
pub async fn get_routine_template_access(
    pool: &PgPool,
    id: &uuid::Uuid,
    source_ids: &SourceIds,
) -> Result<Option<AccessLevel>, sqlx::Error> {
    let levels: Vec<AccessLevel> = sqlx::query_scalar!(
        r#"
        SELECT access_level AS "access_level!: AccessLevel"
        FROM entity_access
        WHERE entity_id = $1 AND entity_type = 'routine_template' AND source_id = ANY($2)
        "#,
        id,
        &source_ids.0,
    )
    .fetch_all(pool)
    .await?;

    Ok(levels.into_iter().max())
}
