//! Opens the delivery project when a deal is marked won.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crm::domain::deal_changes::DealDelivery;
use crm::outbound::deals::{delivery_facts, lock_deal_for_delivery, store_delivery};
use initiative::domain::models::CreateInitiativeRequest;
use initiative::domain::ports::InitiativeService;
use macro_user_id::user_id::MacroUserIdStr;
use models_properties::EntityType;
use system_properties::{CrmRecordLink, SystemPropertiesService};
use uuid::Uuid;

/// Creates the missing delivery project and links the deal's companies and people.
pub struct WonDelivery<I, S> {
    pool: sqlx::PgPool,
    initiatives: Arc<I>,
    properties: Arc<S>,
}

impl<I, S> WonDelivery<I, S> {
    /// `initiatives` and `properties` are the services the rest of the process uses.
    pub fn new(pool: sqlx::PgPool, initiatives: Arc<I>, properties: Arc<S>) -> Self {
        Self {
            pool,
            initiatives,
            properties,
        }
    }
}

impl<I, S> DealDelivery for WonDelivery<I, S>
where
    I: InitiativeService + 'static,
    S: SystemPropertiesService + 'static,
{
    fn open(
        &self,
        actor: MacroUserIdStr<'static>,
        deal_ids: Vec<Uuid>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send>> {
        let pool = self.pool.clone();
        let initiatives = Arc::clone(&self.initiatives);
        let properties = Arc::clone(&self.properties);
        Box::pin(async move {
            let mut seen = Vec::new();
            for deal_id in deal_ids {
                if seen.contains(&deal_id) {
                    continue;
                }
                seen.push(deal_id);
                if let Err(error) = open_one(
                    &pool,
                    initiatives.as_ref(),
                    properties.as_ref(),
                    &actor,
                    deal_id,
                )
                .await
                {
                    tracing::warn!(
                        %deal_id,
                        %error,
                        "the deal was marked won but its project was not created"
                    );
                }
            }
        })
    }
}

async fn open_one<I, S>(
    pool: &sqlx::PgPool,
    initiatives: &I,
    properties: &S,
    actor: &MacroUserIdStr<'static>,
    deal_id: Uuid,
) -> Result<(), String>
where
    I: InitiativeService,
    S: SystemPropertiesService,
{
    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
    let locked = lock_deal_for_delivery(&mut tx, deal_id)
        .await
        .map_err(|error| error.to_string())?;
    if !locked {
        tx.commit().await.map_err(|error| error.to_string())?;
        return Ok(());
    }
    let Some(deal) = delivery_facts(pool, deal_id)
        .await
        .map_err(|error| error.to_string())?
    else {
        tx.commit().await.map_err(|error| error.to_string())?;
        return Ok(());
    };
    if deal.delivery_initiative_id.is_some() {
        tx.commit().await.map_err(|error| error.to_string())?;
        return Ok(());
    }
    let name = deal.name.trim();
    let name = if name.is_empty() { "Delivery" } else { name };
    let created = initiatives
        .create(
            actor,
            CreateInitiativeRequest {
                name: name.to_owned(),
                share_with_team: Some(true),
                ..CreateInitiativeRequest::default()
            },
        )
        .await
        .map_err(|error| error.to_string())?;
    if !deal.company_ids.is_empty() || !deal.contact_ids.is_empty() {
        if let Err(error) = properties
            .link_crm_records(CrmRecordLink {
                entity_id: created.id.as_uuid().to_string(),
                entity_type: EntityType::Initiative,
                company_ids: deal.company_ids,
                contact_ids: deal.contact_ids,
            })
            .await
        {
            tracing::warn!(
                %deal_id,
                %error,
                "the delivery project was created but its companies were not linked"
            );
        }
    }
    let stored = store_delivery(&mut *tx, deal_id, created.id.as_uuid())
        .await
        .map_err(|error| error.to_string())?;
    tx.commit().await.map_err(|error| error.to_string())?;
    if !stored {
        tracing::warn!(
            %deal_id,
            initiative_id = %created.id.as_uuid(),
            "the deal already had a delivery project"
        );
    }
    Ok(())
}
