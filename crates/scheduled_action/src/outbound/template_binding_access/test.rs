use chrono::Utc;
use entity_access::domain::service::EntityAccessServiceImpl;
use entity_access::outbound::PgAccessRepository;
use macro_db_migrator::MACRO_DB_MIGRATIONS;
use serde_json::json;
use sqlx::PgPool;

use super::*;
use crate::domain::target_validation::ModelOnlyTargets;
use crate::domain::templates::models::RoutineTemplate;
use crate::domain::templates::ports::RoutineTemplateRepo;
use crate::outbound::pg_routine_template_repo::PgRoutineTemplateRepo;

const CREATOR: &str = "macro|binding-creator@macro.com";
const VIEWER: &str = "macro|binding-viewer@macro.com";

fn user(id: &str) -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from(id.to_owned()).unwrap()
}

fn access(
    pool: PgPool,
) -> TemplateBindingAccess<EntityAccessServiceImpl<PgAccessRepository>, ModelOnlyTargets> {
    TemplateBindingAccess::new(
        EntityAccessServiceImpl::new(PgAccessRepository::new(pool)),
        ModelOnlyTargets,
    )
}

fn value(value: serde_json::Value) -> BoundValue {
    serde_json::from_value(value).unwrap()
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn template_grants_come_from_entity_access(pool: PgPool) {
    let now = Utc::now();
    let template = RoutineTemplate {
        id: Uuid::now_v7(),
        owner: user(CREATOR),
        source_action_id: None,
        draft: serde_json::from_value(json!({
            "name": "Digest",
            "task": {"target": {"$var": "agent"}, "user_prompt": "Hi"},
            "trigger": {"type": "events", "filters": [{"events": ["document.created"]}]},
            "variables": [{"key": "agent", "label": "Agent", "description": "",
                "kind": {"type": "agent"}, "mode": {"type": "variable"}}]
        }))
        .unwrap(),
        created_at: now,
        updated_at: now,
    };
    PgRoutineTemplateRepo::new(pool.clone())
        .create_template(&template)
        .await
        .unwrap();
    let access = access(pool);

    assert_eq!(
        access
            .access_level(&user(CREATOR), template.id)
            .await
            .unwrap(),
        Some(AccessLevel::Owner)
    );
    assert_eq!(
        access
            .access_level(&user(VIEWER), template.id)
            .await
            .unwrap(),
        None
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn values_are_checked_against_the_activators_access(pool: PgPool) {
    let access = access(pool);
    let viewer = user(VIEWER);
    let check = |kind, bound| {
        let access = &access;
        let viewer = &viewer;
        async move { access.check(viewer, kind, &bound).await.unwrap() }
    };

    assert_eq!(
        check(
            VariableKind::Agent,
            value(json!({"type": "agent", "target": {"kind": "model", "model": "openai/gpt-6"}}))
        )
        .await,
        None
    );
    assert!(
        check(
            VariableKind::Agent,
            value(json!({"type": "agent", "target": {"kind": "agent", "bot_id": "0199f000-0000-7000-8000-0000000000aa"}}))
        )
        .await
        .is_some()
    );
    assert_eq!(
        check(
            VariableKind::Schedule,
            value(json!({"type": "schedule", "cron": "0 0 9 * * *", "timezone": "UTC"}))
        )
        .await,
        None
    );
    assert!(
        check(
            VariableKind::Schedule,
            value(json!({"type": "schedule", "cron": "daily", "timezone": "UTC"}))
        )
        .await
        .is_some()
    );
    assert!(
        check(
            VariableKind::Text,
            value(json!({"type": "text", "text": "a <b>"}))
        )
        .await
        .is_some()
    );
    assert!(
        check(
            VariableKind::User,
            value(json!({"type": "user", "user_id": "nobody"}))
        )
        .await
        .is_some()
    );
    assert_eq!(
        check(
            VariableKind::Document,
            value(json!({"type": "entity", "id": "0199f000-0000-7000-8000-000000000002", "name": "Notes"}))
        )
        .await,
        Some("You don't have access to this document.".to_owned())
    );
    assert!(
        check(
            VariableKind::Channel,
            value(json!({"type": "text", "text": "general"}))
        )
        .await
        .is_some()
    );
}
