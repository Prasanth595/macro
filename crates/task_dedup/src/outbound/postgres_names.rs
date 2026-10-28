//! Postgres trigram implementation of [`TaskNameSearch`].

#[cfg(test)]
mod test;

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use system_properties::SystemPropertyKey;

use super::postgres::closed_status_option_ids;
use crate::domain::models::{TaskDedupError, TaskNameMatch};
use crate::domain::ports::TaskNameSearch;

/// Only the most recently updated tasks in scope are compared, which bounds
/// the lookup for owners and teams with long task histories.
const RECENT_TASK_LIMIT: i64 = 500;

/// Names less similar than this are different tasks. Rewordings of one task
/// ("Fix login bug" / "Fix the login bug") score well above it; tasks sharing
/// a single word score below.
const MIN_NAME_SIMILARITY: f32 = 0.5;

/// The most matches returned for one name.
const MATCH_LIMIT: i64 = 5;

/// Compares task names with `pg_trgm` similarity.
#[derive(Clone)]
pub struct PgTaskNameSearch {
    pool: PgPool,
}

impl PgTaskNameSearch {
    /// Creates a name search over `pool`.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TaskNameSearch for PgTaskNameSearch {
    async fn similar_open_tasks(
        &self,
        owner: &str,
        team_id: Option<Uuid>,
        name: &str,
    ) -> Result<Vec<TaskNameMatch>, TaskDedupError> {
        let rows = sqlx::query!(
            r#"
            WITH recent AS (
                SELECT d.id, d.name
                FROM "Document" d
                JOIN document_sub_type dst ON dst.document_id = d.id AND dst.sub_type = 'task'
                LEFT JOIN team_task tt ON tt.document_id = d.id
                WHERE d."deletedAt" IS NULL
                  AND (
                    d.owner = $1
                    OR ($2::uuid IS NOT NULL AND tt.team_id = $2)
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM entity_properties ep
                    WHERE ep.entity_id = d.id
                      AND ep.entity_type = 'TASK'
                      AND ep.property_definition_id = $3
                      AND ep.values->'value' ?| $4::text[]
                  )
                ORDER BY d."updatedAt" DESC
                LIMIT $5
            ),
            scored AS (
                SELECT id, name, similarity(name, $6) AS name_similarity
                FROM recent
            )
            SELECT
                id AS "task_id!",
                name AS "task_name!",
                name_similarity AS "name_similarity!"
            FROM scored
            WHERE name_similarity >= $7
            ORDER BY name_similarity DESC, id
            LIMIT $8
            "#,
            owner,
            team_id,
            SystemPropertyKey::STATUS_UUID,
            &closed_status_option_ids(),
            RECENT_TASK_LIMIT,
            name,
            MIN_NAME_SIMILARITY,
            MATCH_LIMIT,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| TaskNameMatch {
                task_id: row.task_id,
                task_name: row.task_name,
                name_similarity: row.name_similarity,
            })
            .collect())
    }
}
