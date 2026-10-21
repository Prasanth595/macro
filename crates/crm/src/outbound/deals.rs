//! Persistence for CRM deals.

use crate::domain::{
    deals::{CompanyDeal, Deal},
    model::CrmError,
};
use sqlx::{PgPool, Row};
use std::collections::BTreeSet;
use uuid::Uuid;

const MAX_LINKS: usize = 100;

fn unique(ids: &[Uuid]) -> Result<Vec<Uuid>, CrmError> {
    if ids.len() > MAX_LINKS {
        return Err(CrmError::InvalidRequest(
            "a deal can link at most 100 records".into(),
        ));
    }
    Ok(ids
        .iter()
        .copied()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect())
}

/// Create a deal for the team and link the companies and people it names.
/// Every linked record must already belong to that team.
pub async fn create_deal(
    pool: &PgPool,
    team_id: Uuid,
    name: &str,
    description: &str,
    company_ids: &[Uuid],
    contact_ids: &[Uuid],
) -> Result<Deal, CrmError> {
    let company_ids = unique(company_ids)?;
    let contact_ids = unique(contact_ids)?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    let enabled = sqlx::query_scalar!(
        "SELECT crm_enabled FROM team_crm_settings WHERE team_id = $1",
        team_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?
    .unwrap_or(false);
    if !enabled {
        return Err(CrmError::CrmDisabledForTeam);
    }
    if !company_ids.is_empty() {
        let found = sqlx::query_scalar!(
            r#"SELECT COUNT(*) AS "count!" FROM crm_companies WHERE team_id = $1 AND id = ANY($2)"#,
            team_id,
            &company_ids
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| CrmError::StorageLayerError(error.into()))?;
        if found != i64::try_from(company_ids.len()).unwrap_or(i64::MAX) {
            return Err(CrmError::InvalidRequest(
                "choose companies from this team's CRM".into(),
            ));
        }
    }
    if !contact_ids.is_empty() {
        let found = sqlx::query_scalar!(
            r#"SELECT COUNT(*) AS "count!" FROM crm_contacts ct
               JOIN crm_companies c ON c.id = ct.company_id
               WHERE c.team_id = $1 AND ct.id = ANY($2)"#,
            team_id,
            &contact_ids
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| CrmError::StorageLayerError(error.into()))?;
        if found != i64::try_from(contact_ids.len()).unwrap_or(i64::MAX) {
            return Err(CrmError::InvalidRequest(
                "choose people from this team's CRM".into(),
            ));
        }
    }
    let id = macro_uuid::generate_uuid_v7();
    let description = description.trim();
    sqlx::query!(
        r#"INSERT INTO crm_deals (id, team_id, name, description) VALUES ($1, $2, $3, $4)"#,
        id,
        team_id,
        name,
        description
    )
    .execute(&mut *tx)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    if !company_ids.is_empty() {
        sqlx::query!(
            r#"INSERT INTO crm_deal_companies (deal_id, company_id)
               SELECT $1, company_id FROM unnest($2::uuid[]) AS company_id"#,
            id,
            &company_ids
        )
        .execute(&mut *tx)
        .await
        .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    }
    if !contact_ids.is_empty() {
        sqlx::query!(
            r#"INSERT INTO crm_deal_contacts (deal_id, contact_id)
               SELECT $1, contact_id FROM unnest($2::uuid[]) AS contact_id"#,
            id,
            &contact_ids
        )
        .execute(&mut *tx)
        .await
        .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    }
    tx.commit()
        .await
        .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    Ok(Deal {
        id,
        name: name.to_owned(),
        company_ids,
        contact_ids,
        description: description.to_owned(),
        delivery_initiative_id: None,
    })
}

async fn links(pool: &PgPool, deal_id: Uuid) -> Result<(Vec<Uuid>, Vec<Uuid>), CrmError> {
    let company_ids = sqlx::query_scalar!(
        "SELECT company_id FROM crm_deal_companies WHERE deal_id = $1 ORDER BY company_id",
        deal_id
    )
    .fetch_all(pool)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    let contact_ids = sqlx::query_scalar!(
        "SELECT contact_id FROM crm_deal_contacts WHERE deal_id = $1 ORDER BY contact_id",
        deal_id
    )
    .fetch_all(pool)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    Ok((company_ids, contact_ids))
}

/// The deal, when it belongs to the team.
pub async fn get_deal(
    pool: &PgPool,
    team_id: Uuid,
    deal_id: Uuid,
) -> Result<Option<Deal>, CrmError> {
    let row = sqlx::query!(
        "SELECT name, description, delivery_initiative_id FROM crm_deals WHERE id = $1 AND team_id = $2",
        deal_id,
        team_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    let Some(row) = row else {
        return Ok(None);
    };
    let (company_ids, contact_ids) = links(pool, deal_id).await?;
    Ok(Some(Deal {
        id: deal_id,
        name: row.name,
        company_ids,
        contact_ids,
        description: row.description,
        delivery_initiative_id: row.delivery_initiative_id,
    }))
}

/// Deals whose name contains `query`, most recently updated first.
/// An empty query returns the most recently updated deals. The match is
/// literal: a typed `%` is not a wildcard.
pub async fn search_deals(
    pool: &PgPool,
    team_id: Uuid,
    query: &str,
    limit: i64,
) -> Result<Vec<crate::domain::deals::DealMatch>, CrmError> {
    let rows = sqlx::query(
        r#"SELECT id, name
           FROM crm_deals
           WHERE team_id = $1
             AND ($2 = '' OR STRPOS(LOWER(name), LOWER($2)) > 0)
           ORDER BY updated_at DESC, id DESC
           LIMIT $3"#,
    )
    .bind(team_id)
    .bind(query)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    Ok(rows
        .into_iter()
        .map(|row| crate::domain::deals::DealMatch {
            id: row.get("id"),
            name: row.get("name"),
        })
        .collect())
}

/// The deals among `ids` that belong to the team. Missing ids are omitted.
pub async fn list_deals(pool: &PgPool, team_id: Uuid, ids: &[Uuid]) -> Result<Vec<Deal>, CrmError> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let rows = sqlx::query!(
        "SELECT id, name, description, delivery_initiative_id FROM crm_deals WHERE team_id = $1 AND id = ANY($2) ORDER BY id",
        team_id,
        ids
    )
    .fetch_all(pool)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    let mut deals = Vec::with_capacity(rows.len());
    for row in rows {
        let (company_ids, contact_ids) = links(pool, row.id).await?;
        deals.push(Deal {
            id: row.id,
            name: row.name,
            company_ids,
            contact_ids,
            description: row.description,
            delivery_initiative_id: row.delivery_initiative_id,
        });
    }
    Ok(deals)
}

/// The deal's name, links, and delivery project, for opening that project.
pub async fn delivery_facts(pool: &PgPool, deal_id: Uuid) -> Result<Option<Deal>, CrmError> {
    let row = sqlx::query!(
        "SELECT name, description, delivery_initiative_id FROM crm_deals WHERE id = $1",
        deal_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    let Some(row) = row else {
        return Ok(None);
    };
    let (company_ids, contact_ids) = links(pool, deal_id).await?;
    Ok(Some(Deal {
        id: deal_id,
        name: row.name,
        company_ids,
        contact_ids,
        description: row.description,
        delivery_initiative_id: row.delivery_initiative_id,
    }))
}

/// Lock the deal until the caller stores its delivery project and commits.
/// A second won waits here, then reads the project the first one stored.
pub async fn lock_deal_for_delivery(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    deal_id: Uuid,
) -> Result<bool, CrmError> {
    let locked = sqlx::query_scalar::<_, Uuid>("SELECT id FROM crm_deals WHERE id = $1 FOR UPDATE")
        .bind(deal_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    Ok(locked.is_some())
}

/// Store the delivery project when the deal does not have one yet.
/// The executor is the transaction that holds [`lock_deal_for_delivery`].
pub async fn store_delivery<'c, E>(
    executor: E,
    deal_id: Uuid,
    initiative_id: Uuid,
) -> Result<bool, CrmError>
where
    E: sqlx::Executor<'c, Database = sqlx::Postgres>,
{
    let stored = sqlx::query!(
        r#"UPDATE crm_deals
           SET delivery_initiative_id = $1, updated_at = now()
           WHERE id = $2 AND delivery_initiative_id IS NULL"#,
        initiative_id,
        deal_id
    )
    .execute(executor)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    Ok(stored.rows_affected() == 1)
}

/// Deals linked to the company, with the board facts beside each one.
pub async fn list_company_deals(
    pool: &PgPool,
    team_id: Uuid,
    company_id: Uuid,
) -> Result<Vec<CompanyDeal>, CrmError> {
    let rows = sqlx::query!(
        r#"
        SELECT d.id AS "id!",
               d.name AS "name!",
               d.delivery_initiative_id AS "delivery_initiative_id?",
               snap.pipeline_id AS "pipeline_id?",
               snap.pipeline_name AS "pipeline_name?",
               snap.stage AS "stage?",
               snap.outcome AS "outcome?",
               snap.when_on AS "when_on?",
               snap.revenue AS "revenue?"
        FROM crm_deals d
        JOIN crm_deal_companies dc ON dc.deal_id = d.id
        LEFT JOIN LATERAL (
            SELECT p.id AS pipeline_id,
                   p.name AS pipeline_name,
                   max(opt.string_value) FILTER (WHERE def.display_name = 'Stage') AS stage,
                   max(opt.string_value) FILTER (WHERE def.display_name = 'Outcome') AS outcome,
                   max(left(cell.values->>'value', 10)) FILTER (
                       WHERE def.display_name = 'When' AND cell.values->>'type' = 'Date'
                   ) AS when_on,
                   max(cell.values->>'value') FILTER (
                       WHERE def.display_name = 'Revenue' AND cell.values->>'type' = 'Number'
                   ) AS revenue
            FROM crm_pipeline_entities p
            JOIN database_columns col ON col.table_id = p.table_id
            JOIN property_definitions def ON def.id = col.property_definition_id
            JOIN entity_properties deal_cell ON deal_cell.property_definition_id = (
                    SELECT dc2.property_definition_id
                    FROM database_columns dc2
                    JOIN property_definitions dd ON dd.id = dc2.property_definition_id
                    WHERE dc2.table_id = p.table_id AND dd.display_name = 'Deal'
                    LIMIT 1
                )
                AND deal_cell.entity_type = 'DATABASE_ROW'
                AND deal_cell.values #>> '{value,0,entity_id}' = d.id::text
            LEFT JOIN entity_properties cell ON cell.entity_id = deal_cell.entity_id
                AND cell.entity_type = 'DATABASE_ROW'
                AND cell.property_definition_id = def.id
            LEFT JOIN property_options opt ON opt.id = CASE
                    WHEN cell.values->>'type' = 'SelectOption'
                     AND cell.values #>> '{value,0}' ~ '^[0-9a-fA-F-]{36}$'
                    THEN (cell.values #>> '{value,0}')::uuid
                END
            WHERE p.team_id = d.team_id
              AND p.record_type = 'deal'
              AND p.trashed_at IS NULL
              AND def.display_name IN ('Stage', 'Outcome', 'When', 'Revenue')
            GROUP BY p.id, p.name
        ) snap ON true
        WHERE dc.company_id = $1 AND d.team_id = $2
        ORDER BY d.name, snap.pipeline_name
        "#,
        company_id,
        team_id
    )
    .fetch_all(pool)
    .await
    .map_err(|error| CrmError::StorageLayerError(error.into()))?;
    Ok(rows
        .into_iter()
        .map(|row| CompanyDeal {
            id: row.id,
            name: row.name,
            pipeline_id: row.pipeline_id,
            pipeline_name: row.pipeline_name,
            stage: row.stage,
            outcome: row.outcome,
            when_on: row.when_on,
            revenue: row.revenue,
            delivery_initiative_id: row.delivery_initiative_id,
        })
        .collect())
}
