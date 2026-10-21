//! Writes a deal's field changes into the activity timeline its discussion reads.

use std::future::Future;
use std::pin::Pin;

use activity::domain::ports::ActivityRepo;
use activity::outbound::pg_activity_repo::PgActivityRepo;
use activity::{Activity, Actor, CommonAction, EntityType, PropertyChange};
use chrono::Utc;
use macro_user_id::user_id::MacroUserIdStr;
use serde_json::Value;

use crate::domain::deal_changes::{DealChangeLog, DealFieldChange};

/// Activity rows for deal field changes. The cell write has already committed.
#[derive(Clone)]
pub struct ActivityDealLog {
    repo: PgActivityRepo,
}

impl ActivityDealLog {
    /// Record against the same database the rest of activity uses.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self {
            repo: PgActivityRepo::new(pool),
        }
    }
}

impl DealChangeLog for ActivityDealLog {
    fn record(
        &self,
        actor: MacroUserIdStr<'static>,
        changes: Vec<DealFieldChange>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send>> {
        let repo = self.repo.clone();
        Box::pin(async move {
            if changes.is_empty() {
                return;
            }
            let occurred_at = Utc::now();
            let source = uuid::Uuid::now_v7();
            let actor = Actor::new_from_user(actor);
            let activities: Vec<_> = changes
                .iter()
                .enumerate()
                .map(|(ordinal, change)| {
                    Activity::common(
                        source,
                        u32::try_from(ordinal).unwrap_or(u32::MAX),
                        actor.clone(),
                        None,
                        EntityType::CrmDeal,
                        change.deal_id.to_string(),
                        CommonAction::PropertyChanged(PropertyChange {
                            property: change.field.clone(),
                            from: change.from.clone().map(Value::String),
                            to: change.to.clone().map(Value::String),
                        }),
                        occurred_at,
                    )
                })
                .collect();
            if let Err(error) = repo.insert_activities(&activities).await {
                tracing::warn!(%error, "the deal cell was saved but its activity line was not");
            }
        })
    }
}
