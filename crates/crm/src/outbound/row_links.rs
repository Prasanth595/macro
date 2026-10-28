//! Persistence for CRM-owned references. Source cells stay in the database domain.

use databases::domain::models::RowId;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::row_links::{LinkedRowReference, RowLinkTarget, RowLinksRepo};

/// Postgres identities-only link store.
pub struct PgRowLinksRepo {
    pool: PgPool,
}

impl PgRowLinksRepo {
    /// Use the primary for read-after-write consistency.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn target_columns(target: RowLinkTarget) -> (Option<Uuid>, Option<Uuid>, Option<Uuid>) {
    match target {
        RowLinkTarget::Company(company) => (Some(company), None, None),
        RowLinkTarget::Entry(pipeline, row) => (None, Some(pipeline), Some(row.into_uuid())),
    }
}

impl RowLinksRepo for PgRowLinksRepo {
    type Error = sqlx::Error;

    #[tracing::instrument(name = "crm.row_links.repo.list", skip_all, fields(?target), err)]
    async fn list(&self, target: RowLinkTarget) -> Result<Vec<LinkedRowReference>, Self::Error> {
        let (company, pipeline, entry) = target_columns(target);
        let rows = sqlx::query!(
            r#"SELECT source_database_id, source_table_id, source_row_id
               FROM crm_database_row_links
               WHERE company_id = $1 OR (pipeline_id = $2 AND entry_row_id = $3)
               ORDER BY source_database_id, source_table_id, source_row_id"#,
            company,
            pipeline,
            entry,
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| LinkedRowReference {
                database_id: row.source_database_id.into(),
                table_id: row.source_table_id.into(),
                row_id: row.source_row_id.into(),
            })
            .collect())
    }

    #[tracing::instrument(name = "crm.row_links.repo.link", skip_all, fields(?target, source_row_id = %source.row_id), err)]
    async fn link(
        &self,
        target: RowLinkTarget,
        source: LinkedRowReference,
    ) -> Result<bool, Self::Error> {
        let (company, pipeline, entry) = target_columns(target);
        let key = match target {
            RowLinkTarget::Company(id) => format!("crm-row-links:company:{id}"),
            RowLinkTarget::Entry(id, row) => format!("crm-row-links:entry:{id}:{row}"),
        };
        let mut transaction = self.pool.begin().await?;
        // Serialize the bounded collection, including concurrent inserts of different sources.
        sqlx::query!("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", key)
            .execute(&mut *transaction)
            .await?;
        let count = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM crm_database_row_links
               WHERE (company_id = $1 OR (pipeline_id = $2 AND entry_row_id = $3))
                 AND source_row_id != $4"#,
            company,
            pipeline,
            entry,
            source.row_id.into_uuid(),
        )
        .fetch_one(&mut *transaction)
        .await?
        .unwrap_or_default();
        if count >= 100 {
            return Ok(false);
        }
        sqlx::query!(
            r#"INSERT INTO crm_database_row_links
               (company_id, pipeline_id, entry_row_id, source_database_id, source_table_id, source_row_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING"#,
            company, pipeline, entry, source.database_id.into_uuid(), source.table_id.into_uuid(), source.row_id.into_uuid(),
        ).execute(&mut *transaction).await?;
        transaction.commit().await?;
        Ok(true)
    }

    #[tracing::instrument(name = "crm.row_links.repo.unlink", skip_all, fields(?target, source_row_id = %row), err)]
    async fn unlink(&self, target: RowLinkTarget, row: RowId) -> Result<(), Self::Error> {
        let (company, pipeline, entry) = target_columns(target);
        sqlx::query!(
            r#"DELETE FROM crm_database_row_links
               WHERE (company_id = $1 OR (pipeline_id = $2 AND entry_row_id = $3))
                 AND source_row_id = $4"#,
            company,
            pipeline,
            entry,
            row.into_uuid(),
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
