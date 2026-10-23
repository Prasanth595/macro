use chrono::Utc;
use macro_db_migrator::MACRO_DB_MIGRATIONS;
use serde_json::json;

use super::*;
use crate::domain::ports::ScheduledActionRepo;
use crate::domain::templates::models::VariableKey;
use crate::outbound::pg_scheduled_action_repo::test::{
    insert_user, sample_action, test_repo, user, user_owner,
};

const CREATOR: &str = "macro|template-creator@macro.com";
const VIEWER: &str = "macro|template-viewer@macro.com";
const CHANNEL: &str = "0199f000-0000-7000-8000-000000000001";

fn draft(name: &str) -> TemplateDraft {
    serde_json::from_value(json!({
        "name": name,
        "description": "Posts a digest.",
        "task": {"target": {"$var": "agent"}, "prompt": "", "user_prompt": "Post a digest."},
        "trigger": {"type": "cron", "schedule": {"$var": "schedule"}},
        "variables": [
            {"key": "agent", "label": "Agent", "description": "", "kind": {"type": "agent"}, "mode": {"type": "variable"}},
            {"key": "schedule", "label": "Schedule", "description": "", "kind": {"type": "schedule"},
             "mode": {"type": "fixed", "value": {"type": "schedule", "cron": "0 0 9 * * *", "timezone": "UTC"}}}
        ]
    }))
    .unwrap()
}

fn template(source_action_id: Option<Uuid>) -> RoutineTemplate {
    let now = Utc::now();
    RoutineTemplate {
        id: Uuid::now_v7(),
        owner: user(CREATOR),
        source_action_id,
        draft: draft("Digest"),
        created_at: now,
        updated_at: now,
    }
}

async fn grants(pool: &PgPool, id: Uuid) -> Vec<(String, String)> {
    sqlx::query!(
        r#"
        SELECT source_id, access_level::text AS "access_level!"
        FROM entity_access
        WHERE entity_id = $1 AND entity_type = 'routine_template'
        ORDER BY source_id
        "#,
        id,
    )
    .fetch_all(pool)
    .await
    .unwrap()
    .into_iter()
    .map(|row| (row.source_id, row.access_level))
    .collect()
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn templates_round_trip_with_an_owner_grant(pool: PgPool) {
    insert_user(&pool, CREATOR).await;
    let actions = test_repo(pool.clone());
    let source = actions
        .create_action(sample_action(user_owner(CREATOR), "digest"))
        .await
        .unwrap();
    let repo = PgRoutineTemplateRepo::new(pool.clone());
    let created = template(source.id);

    repo.create_template(&created).await.unwrap();

    let stored = repo.get_template(created.id).await.unwrap().unwrap();
    assert_eq!(stored.draft, created.draft);
    assert_eq!(stored.owner, created.owner);
    assert_eq!(
        grants(&pool, created.id).await,
        [(CREATOR.to_owned(), "owner".to_owned())]
    );
    assert_eq!(
        repo.owned_template_for_action(&user(CREATOR), source.id.unwrap())
            .await
            .unwrap()
            .map(|template| template.id),
        Some(created.id)
    );

    let updated = repo
        .update_template(created.id, &draft("Renamed"), Utc::now())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(updated.draft.name, "Renamed");

    // Deleting the source routine keeps the template.
    actions.delete_action(&source.id.unwrap()).await.unwrap();
    let kept = repo.get_template(created.id).await.unwrap().unwrap();
    assert_eq!(kept.source_action_id, None);
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn deleting_a_template_removes_its_grants_but_not_activated_routines(pool: PgPool) {
    insert_user(&pool, CREATOR).await;
    insert_user(&pool, VIEWER).await;
    let actions = test_repo(pool.clone());
    let repo = PgRoutineTemplateRepo::new(pool.clone());
    let created = template(None);
    repo.create_template(&created).await.unwrap();
    assert!(
        repo.update_channel_grants(
            created.id,
            &[serde_json::from_value::<UpdateChannelSharePermission>(json!({
                "channelId": CHANNEL, "operation": "replace", "accessLevel": "view"
            }))
            .unwrap()],
        )
        .await
        .unwrap()
    );
    let channels = repo.channel_grants(created.id).await.unwrap();
    assert_eq!(channels.len(), 1);
    assert_eq!(channels[0].channel_id, CHANNEL);

    let bindings = Bindings::from([(
        VariableKey::agent(),
        serde_json::from_value(json!({
            "type": "agent", "target": {"kind": "model", "model": "m"}
        }))
        .unwrap(),
    )]);
    let activated = actions
        .create_templated_action(
            sample_action(user_owner(VIEWER), "mine"),
            &TemplateProvenance {
                template_id: created.id,
                bindings: bindings.clone(),
            },
        )
        .await
        .unwrap();
    let activated_id = activated.id.unwrap();
    assert_eq!(
        repo.activations_by(created.id, &user(VIEWER)).await.unwrap(),
        [activated_id]
    );
    assert!(repo.activations_by(created.id, &user(CREATOR)).await.unwrap().is_empty());
    assert_eq!(repo.activation_count(created.id).await.unwrap(), 1);
    let provenance = repo.provenance(activated_id).await.unwrap().unwrap();
    assert_eq!(provenance.template_id, created.id);
    assert_eq!(provenance.bindings, bindings);

    repo.set_bindings(activated_id, &Bindings::new()).await.unwrap();
    assert!(repo.provenance(activated_id).await.unwrap().unwrap().bindings.is_empty());

    repo.delete_template(created.id).await.unwrap();
    assert!(repo.get_template(created.id).await.unwrap().is_none());
    assert!(grants(&pool, created.id).await.is_empty());
    assert!(actions.get_action(&activated_id).await.unwrap().is_some());
    assert!(
        !repo
            .update_channel_grants(created.id, &[])
            .await
            .unwrap()
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn account_cleanup_deletes_only_that_owners_templates(pool: PgPool) {
    let actions = test_repo(pool.clone());
    let repo = PgRoutineTemplateRepo::new(pool.clone());
    let mine = template(None);
    let theirs = RoutineTemplate {
        id: Uuid::now_v7(),
        owner: user(VIEWER),
        ..template(None)
    };
    repo.create_template(&mine).await.unwrap();
    repo.create_template(&theirs).await.unwrap();

    actions.delete_owned_templates(&user(CREATOR)).await.unwrap();

    assert!(repo.get_template(mine.id).await.unwrap().is_none());
    assert!(repo.get_template(theirs.id).await.unwrap().is_some());
}
