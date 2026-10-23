//! PostgreSQL routine-template store, and the provenance columns on the
//! routines activated from a template.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use entity_access_db_utils::{AccessLevel, EntityAccessSourceType, EntityType};
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use models_permissions::share_permission::channel_share_permission::{
    ChannelSharePermission, UpdateChannelSharePermission,
};
use serde_json::Value;
use sqlx::PgPool;

use crate::domain::templates::models::{
    Bindings, RoutineTemplate, TemplateDraft, TemplateProvenance,
};
use crate::domain::templates::ports::RoutineTemplateRepo;

#[cfg(test)]
mod test;

pub struct PgRoutineTemplateRepo {
    pool: PgPool,
}

impl PgRoutineTemplateRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

struct TemplateRow {
    id: Uuid,
    owner: String,
    source_action_id: Option<Uuid>,
    name: String,
    description: String,
    task: Value,
    trigger_config: Value,
    variables: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl TryFrom<TemplateRow> for RoutineTemplate {
    type Error = anyhow::Error;

    fn try_from(row: TemplateRow) -> Result<Self> {
        Ok(Self {
            id: row.id,
            owner: MacroUserIdStr::try_from(row.owner).context("template owner is not a user")?,
            source_action_id: row.source_action_id,
            draft: TemplateDraft {
                name: row.name,
                description: row.description,
                task: serde_json::from_value(row.task).context("template task")?,
                trigger: serde_json::from_value(row.trigger_config).context("template trigger")?,
                variables: serde_json::from_value(row.variables).context("template variables")?,
            },
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

impl RoutineTemplateRepo for PgRoutineTemplateRepo {
    async fn create_template(&self, template: &RoutineTemplate) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query!(
            r#"
            INSERT INTO routine_template
                (id, owner, source_action_id, name, description, task, trigger_config,
                 variables, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
            template.id,
            template.owner.as_ref(),
            template.source_action_id,
            template.draft.name,
            template.draft.description,
            serde_json::to_value(&template.draft.task)?,
            serde_json::to_value(&template.draft.trigger)?,
            serde_json::to_value(&template.draft.variables)?,
            template.created_at,
            template.updated_at,
        )
        .execute(&mut *tx)
        .await?;
        entity_access_db_utils::insert_entity_access_row(
            &mut tx,
            &template.id,
            EntityType::RoutineTemplate,
            template.owner.as_ref(),
            EntityAccessSourceType::User,
            AccessLevel::Owner,
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }

    async fn get_template(&self, id: Uuid) -> Result<Option<RoutineTemplate>> {
        sqlx::query_as!(
            TemplateRow,
            r#"
            SELECT id, owner, source_action_id, name, description, task, trigger_config,
                   variables, created_at, updated_at
            FROM routine_template
            WHERE id = $1
            "#,
            id,
        )
        .fetch_optional(&self.pool)
        .await?
        .map(RoutineTemplate::try_from)
        .transpose()
    }

    async fn update_template(
        &self,
        id: Uuid,
        draft: &TemplateDraft,
        updated_at: DateTime<Utc>,
    ) -> Result<Option<RoutineTemplate>> {
        sqlx::query_as!(
            TemplateRow,
            r#"
            UPDATE routine_template
            SET name = $2, description = $3, task = $4, trigger_config = $5, variables = $6,
                updated_at = $7
            WHERE id = $1
            RETURNING id, owner, source_action_id, name, description, task, trigger_config,
                      variables, created_at, updated_at
            "#,
            id,
            draft.name,
            draft.description,
            serde_json::to_value(&draft.task)?,
            serde_json::to_value(&draft.trigger)?,
            serde_json::to_value(&draft.variables)?,
            updated_at,
        )
        .fetch_optional(&self.pool)
        .await?
        .map(RoutineTemplate::try_from)
        .transpose()
    }

    async fn delete_template(&self, id: Uuid) -> Result<()> {
        sqlx::query!("DELETE FROM routine_template WHERE id = $1", id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn owned_template_for_action(
        &self,
        owner: &MacroUserIdStr<'static>,
        action_id: Uuid,
    ) -> Result<Option<RoutineTemplate>> {
        sqlx::query_as!(
            TemplateRow,
            r#"
            SELECT id, owner, source_action_id, name, description, task, trigger_config,
                   variables, created_at, updated_at
            FROM routine_template
            WHERE owner = $1 AND source_action_id = $2
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            owner.as_ref(),
            action_id,
        )
        .fetch_optional(&self.pool)
        .await?
        .map(RoutineTemplate::try_from)
        .transpose()
    }

    async fn activations_by(
        &self,
        template_id: Uuid,
        owner: &MacroUserIdStr<'static>,
    ) -> Result<Vec<Uuid>> {
        Ok(sqlx::query_scalar!(
            r#"
            SELECT id
            FROM scheduled_action
            WHERE source_template_id = $1 AND owner = $2
            ORDER BY created_at, id
            "#,
            template_id,
            owner.as_ref(),
        )
        .fetch_all(&self.pool)
        .await?)
    }

    async fn activation_count(&self, template_id: Uuid) -> Result<u64> {
        let count = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) AS "count!"
            FROM scheduled_action
            WHERE source_template_id = $1
            "#,
            template_id,
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(u64::try_from(count)?)
    }

    async fn provenance(&self, action_id: Uuid) -> Result<Option<TemplateProvenance>> {
        let Some(row) = sqlx::query!(
            r#"
            SELECT source_template_id, template_bindings
            FROM scheduled_action
            WHERE id = $1
            "#,
            action_id,
        )
        .fetch_optional(&self.pool)
        .await?
        else {
            return Ok(None);
        };
        let Some(template_id) = row.source_template_id else {
            return Ok(None);
        };
        let bindings: Bindings = match row.template_bindings {
            Some(bindings) => serde_json::from_value(bindings).context("template bindings")?,
            None => Bindings::new(),
        };
        Ok(Some(TemplateProvenance {
            template_id,
            bindings,
        }))
    }

    async fn set_bindings(&self, action_id: Uuid, bindings: &Bindings) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE scheduled_action
            SET template_bindings = $2
            WHERE id = $1 AND source_template_id IS NOT NULL
            "#,
            action_id,
            serde_json::to_value(bindings)?,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn channel_grants(&self, template_id: Uuid) -> Result<Vec<ChannelSharePermission>> {
        Ok(entity_access_db_utils::get_direct_channel_grants(
            &self.pool,
            &template_id,
            EntityType::RoutineTemplate,
        )
        .await?)
    }

    async fn update_channel_grants(
        &self,
        template_id: Uuid,
        grants: &[UpdateChannelSharePermission],
    ) -> Result<bool> {
        let mut tx = self.pool.begin().await?;
        let live = sqlx::query_scalar!(
            "SELECT id FROM routine_template WHERE id = $1 FOR SHARE",
            template_id,
        )
        .fetch_optional(&mut *tx)
        .await?;
        if live.is_none() {
            tx.rollback().await?;
            return Ok(false);
        }
        entity_access_db_utils::update_entity_access_channel_share_permissions(
            &mut tx,
            &template_id,
            EntityType::RoutineTemplate,
            grants,
        )
        .await?;
        tx.commit().await?;
        Ok(true)
    }
}
