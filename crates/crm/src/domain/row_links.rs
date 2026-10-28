//! CRM owns the references; databases retain row identity, cells and permissions.

use std::sync::Arc;

use databases::domain::{
    models::{DatabaseError, DatabaseId, RowId, TableDetail, TableId},
    ports::{DatabaseRowReads, DatabasesService},
    storage::StorageRow,
};
use entity_access::domain::{
    models::{
        AccessError, EditAccessLevel, EntityAccessReceipt, EntityType, RequiredPermission,
        ViewAccessLevel,
    },
    ports::EntityAccessService,
};
use macro_user_id::user_id::MacroUserIdStr;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{
    auth::CrmCompanyReceipt,
    pipelines::{PipelineError, PipelineService},
};

/// An authorized company or one particular entry, independent of stage/outcome.
pub enum RowLinkAccess<T: RequiredPermission> {
    /// Company-level links do not implicitly belong to any deal.
    Company(CrmCompanyReceipt<T>),
    /// The pipeline grant authorizes the entry; the service verifies membership.
    Entry(EntityAccessReceipt<T>, RowId),
}

/// The stable CRM destination persisted by the repository.
#[derive(Debug, Clone, Copy)]
pub enum RowLinkTarget {
    /// Company identity.
    Company(Uuid),
    /// Pipeline and its own row identity (not the primary company/contact).
    Entry(Uuid, RowId),
}

impl RowLinkTarget {
    fn record_span(self) {
        let span = tracing::Span::current();
        match self {
            Self::Company(id) => {
                span.record("company_id", tracing::field::display(id));
            }
            Self::Entry(pipeline, row) => {
                span.record("pipeline_id", tracing::field::display(pipeline));
                span.record("entry_row_id", tracing::field::display(row));
            }
        }
    }
}

/// An existing row in a Macro database app, never a CRM backing database.
#[derive(Debug, Clone, Copy, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinkedRowReference {
    /// Source database entity.
    pub database_id: DatabaseId,
    /// Source table.
    pub table_id: TableId,
    /// Stable source identity.
    pub row_id: RowId,
}

/// Live source metadata and cells, emitted only after source authorization.
#[derive(Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkedRowTable {
    /// Current database name.
    pub database_name: String,
    /// Current table name and field definitions, including select labels.
    pub table: TableDetail,
    /// Only linked rows the viewer can currently read.
    pub rows: Vec<StorageRow>,
}

/// At most 100 references per target; missing/inaccessible sources are omitted.
#[derive(Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkedRows {
    /// Readable rows grouped by source table.
    pub tables: Vec<LinkedRowTable>,
}

/// Persistence of identities only. Implementations serialize the per-target limit.
pub trait RowLinksRepo: Send + Sync + 'static {
    /// Storage failure.
    type Error: std::error::Error + Send + Sync + 'static;
    /// All references for a target, sorted by database/table/row.
    fn list(
        &self,
        target: RowLinkTarget,
    ) -> impl Future<Output = Result<Vec<LinkedRowReference>, Self::Error>> + Send;
    /// Idempotent insert; false when adding it would exceed 100 links.
    fn link(
        &self,
        target: RowLinkTarget,
        source: LinkedRowReference,
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send;
    /// Idempotent removal, scoped to both target and source.
    fn unlink(
        &self,
        target: RowLinkTarget,
        row: RowId,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

/// CRM policy, source authorization and live preview hydration.
pub struct RowLinksService<R, D, P, E> {
    repo: R,
    databases: Arc<D>,
    pipelines: Arc<P>,
    access: Arc<E>,
}

impl<R, D, P, E> RowLinksService<R, D, P, E> {
    /// Compose CRM references with the existing database and pipeline services.
    pub fn new(repo: R, databases: Arc<D>, pipelines: Arc<P>, access: Arc<E>) -> Self {
        Self {
            repo,
            databases,
            pipelines,
            access,
        }
    }
}

/// Authorized operations exposed to transports.
pub trait CrmRowLinks: Send + Sync + 'static {
    /// Read current source values without granting any additional access.
    fn list(
        &self,
        target: RowLinkAccess<ViewAccessLevel>,
    ) -> impl Future<Output = Result<LinkedRows, PipelineError>> + Send;
    /// Link a readable source to an editable target. Retrying has no extra effect.
    fn link(
        &self,
        target: RowLinkAccess<EditAccessLevel>,
        source: LinkedRowReference,
    ) -> impl Future<Output = Result<(), PipelineError>> + Send;
    /// Remove only the reference; does not require source access or edit cells.
    fn unlink(
        &self,
        target: RowLinkAccess<EditAccessLevel>,
        row: RowId,
    ) -> impl Future<Output = Result<(), PipelineError>> + Send;
}

impl<
    R: RowLinksRepo,
    D: DatabasesService + DatabaseRowReads,
    P: PipelineService,
    E: EntityAccessService,
> RowLinksService<R, D, P, E>
{
    async fn target<T: RequiredPermission>(
        &self,
        access: RowLinkAccess<T>,
    ) -> Result<(RowLinkTarget, MacroUserIdStr<'static>), PipelineError> {
        match access {
            RowLinkAccess::Company(company) => Ok((
                RowLinkTarget::Company(company.company_id()?),
                company.receipt().get_authenticated_user()?.clone(),
            )),
            RowLinkAccess::Entry(receipt, row) => {
                if receipt.entity().entity_type != EntityType::CrmPipeline {
                    return Err(PipelineError::NotFound);
                }
                let user = receipt.get_authenticated_user()?.clone();
                let pipeline_id = receipt
                    .entity()
                    .entity_id
                    .parse()
                    .map_err(|_| PipelineError::NotFound)?;
                let rows = self
                    .pipelines
                    .read_rows(receipt.try_into_requirement()?, &[row])
                    .await?;
                if rows.is_empty() {
                    return Err(PipelineError::NotFound);
                }
                Ok((RowLinkTarget::Entry(pipeline_id, row), user))
            }
        }
    }

    async fn source(
        &self,
        user: &MacroUserIdStr<'static>,
        database: DatabaseId,
        table: TableId,
        rows: &[RowId],
    ) -> Result<Option<LinkedRowTable>, PipelineError> {
        let receipt = match self
            .access
            .generate_entity_access_receipt::<ViewAccessLevel>(
                user,
                None,
                &database.to_string(),
                EntityType::Database,
            )
            .await
        {
            Ok(receipt) => receipt,
            Err(
                AccessError::Unauthorized
                | AccessError::UnauthorizedWithMessage(_)
                | AccessError::NotFound(_),
            ) => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        let detail = match self.databases.get_database(receipt.clone()).await {
            Ok(detail) if detail.database.trashed_at.is_none() => detail,
            Ok(_) | Err(DatabaseError::NotFound) => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        let Some(schema) = detail
            .tables
            .into_iter()
            .find(|candidate| candidate.table.id == table)
        else {
            return Ok(None);
        };
        // The database app owns its lifecycle checks as well as row-value reads.
        let rows = match self.databases.row_values(receipt, table, rows).await {
            Ok(rows) => rows,
            Err(DatabaseError::NotFound) => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        if rows.is_empty() {
            return Ok(None);
        }
        Ok(Some(LinkedRowTable {
            database_name: detail.database.name,
            table: schema,
            rows,
        }))
    }
}

impl<
    R: RowLinksRepo,
    D: DatabasesService + DatabaseRowReads,
    P: PipelineService,
    E: EntityAccessService,
> CrmRowLinks for RowLinksService<R, D, P, E>
{
    #[tracing::instrument(
        name = "crm.row_links.list",
        skip_all,
        fields(company_id, pipeline_id, entry_row_id),
        err
    )]
    async fn list(
        &self,
        access: RowLinkAccess<ViewAccessLevel>,
    ) -> Result<LinkedRows, PipelineError> {
        let (target, user) = self.target(access).await?;
        target.record_span();
        let references = self.repo.list(target).await.map_err(storage)?;
        let mut tables = Vec::new();
        for group in
            references.chunk_by(|a, b| a.database_id == b.database_id && a.table_id == b.table_id)
        {
            let first = group[0];
            let rows = group
                .iter()
                .map(|reference| reference.row_id)
                .collect::<Vec<_>>();
            if let Some(table) = self
                .source(&user, first.database_id, first.table_id, &rows)
                .await?
            {
                tables.push(table);
            }
        }
        Ok(LinkedRows { tables })
    }

    #[tracing::instrument(name = "crm.row_links.link", skip_all, fields(company_id, pipeline_id, entry_row_id, source_database_id = %source.database_id, source_row_id = %source.row_id), err)]
    async fn link(
        &self,
        access: RowLinkAccess<EditAccessLevel>,
        source: LinkedRowReference,
    ) -> Result<(), PipelineError> {
        let (target, user) = self.target(access).await?;
        target.record_span();
        self.source(&user, source.database_id, source.table_id, &[source.row_id])
            .await?
            .ok_or(PipelineError::NotFound)?;
        if !self.repo.link(target, source).await.map_err(storage)? {
            return Err(PipelineError::Invalid(
                "A record can link up to 100 database rows",
            ));
        }
        Ok(())
    }

    #[tracing::instrument(name = "crm.row_links.unlink", skip_all, fields(company_id, pipeline_id, entry_row_id, source_row_id = %row), err)]
    async fn unlink(
        &self,
        access: RowLinkAccess<EditAccessLevel>,
        row: RowId,
    ) -> Result<(), PipelineError> {
        let (target, _) = self.target(access).await?;
        target.record_span();
        self.repo.unlink(target, row).await.map_err(storage)
    }
}

fn storage(error: impl std::error::Error + Send + Sync + 'static) -> PipelineError {
    PipelineError::Storage(rootcause::Report::new(error).into_dynamic())
}
