//! Atomic, caller-scoped bindings survive lost acknowledgements and option deletion.
use super::property_option_queries::{
    get_property_option, get_property_options, insert_property_option,
};
use crate::domain::tag_replay::{CreateTagOptionOutcome, PropertyClientBindings};
use models_properties::service::property_option::PropertyOptionValue;
use sqlx::PgPool;
use uuid::Uuid;

pub(super) async fn bind_definition(
    pool: &PgPool,
    user: &str,
    client: Uuid,
    definition: Uuid,
) -> anyhow::Result<Uuid> {
    Ok(sqlx::query_scalar!(
        "INSERT INTO property_definition_client_ids (user_id, client_id, property_definition_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, client_id) DO UPDATE SET client_id = EXCLUDED.client_id RETURNING property_definition_id",
        user, client, definition).fetch_one(pool).await?)
}

pub(super) async fn bindings(
    pool: &PgPool,
    user: &str,
    definitions: &[Uuid],
    options: &[Uuid],
) -> anyhow::Result<PropertyClientBindings> {
    let definitions = sqlx::query!("SELECT client_id, property_definition_id FROM property_definition_client_ids WHERE user_id = $1 AND client_id = ANY($2)", user, definitions).fetch_all(pool).await?;
    let options = sqlx::query!("SELECT client_id, option_id FROM property_option_client_ids WHERE user_id = $1 AND client_id = ANY($2)", user, options).fetch_all(pool).await?;
    Ok(PropertyClientBindings {
        definitions: definitions
            .into_iter()
            .map(|r| (r.client_id, r.property_definition_id))
            .collect(),
        options: options
            .into_iter()
            .map(|r| (r.client_id, r.option_id))
            .collect(),
    })
}

pub(super) async fn create_option(
    pool: &PgPool,
    user: &str,
    client: Uuid,
    definition: Uuid,
    value: &str,
    color: Option<&str>,
) -> anyhow::Result<CreateTagOptionOutcome> {
    let mut tx = pool.begin().await?;
    // Serialize the same caller handle even when concurrent requests name different definitions.
    sqlx::query!(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        format!("tag:{user}:{client}")
    )
    .execute(&mut *tx)
    .await?;
    if let Some(binding) = sqlx::query!("SELECT property_definition_id, option_id FROM property_option_client_ids WHERE user_id = $1 AND client_id = $2", user, client).fetch_optional(&mut *tx).await? {
        if binding.property_definition_id != definition { return Ok(CreateTagOptionOutcome::DefinitionConflict); }
        let option = get_property_option(&mut *tx, binding.option_id).await?;
        tx.commit().await?;
        return Ok(match option {
            Some(option) if option.property_definition_id != definition => CreateTagOptionOutcome::DefinitionConflict,
            Some(option) => CreateTagOptionOutcome::Present { option, created: false },
            None => CreateTagOptionOutcome::Deleted,
        });
    }
    // Share option-set lock ordering with promotion/removal; a duplicate label keeps its metadata.
    sqlx::query_scalar!(
        "SELECT id FROM property_definitions WHERE id = $1 FOR UPDATE",
        definition
    )
    .fetch_one(&mut *tx)
    .await?;
    let options = get_property_options(&mut *tx, definition).await?;
    let existing = options
        .into_iter()
        .find(|o| matches!(&o.value, PropertyOptionValue::String(label) if label == value));
    let (option, created) = match existing {
        Some(option) => (option, false),
        None => (
            insert_property_option(
                &mut *tx,
                macro_uuid::generate_uuid_v7(),
                definition,
                0,
                PropertyOptionValue::String(value.to_owned()),
                color.map(str::to_owned),
            )
            .await?,
            true,
        ),
    };
    sqlx::query!("INSERT INTO property_option_client_ids (user_id, client_id, property_definition_id, option_id) VALUES ($1, $2, $3, $4)", user, client, definition, option.id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(CreateTagOptionOutcome::Present { option, created })
}
