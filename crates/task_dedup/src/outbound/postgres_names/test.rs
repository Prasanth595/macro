use macro_db_migrator::MACRO_DB_MIGRATIONS;
use sqlx::PgPool;
use system_properties::StatusOption;

use super::*;

const OWNER: &str = "macro|user@user.com";
const TEAMMATE: &str = "macro|teammate1@user.com";
const OUTSIDER: &str = "macro|no-team@user.com";
const TEAM_ID: Uuid = uuid::uuid!("a0000000-0000-0000-0000-000000000001");

async fn insert_task(pool: &PgPool, id: &str, name: &str, owner: &str) {
    sqlx::query!(
        r#"
        INSERT INTO "Document" (id, name, "fileType", owner)
        VALUES ($1, $2, 'md', $3)
        "#,
        id,
        name,
        owner,
    )
    .execute(pool)
    .await
    .unwrap();

    sqlx::query!(
        r#"
        INSERT INTO document_sub_type (document_id, sub_type)
        VALUES ($1, 'task')
        "#,
        id,
    )
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(
        path = "../../../../documents/fixtures",
        scripts("documents_test_data")
    )
)]
async fn returns_open_tasks_with_a_near_identical_name(pool: PgPool) {
    insert_task(
        &pool,
        "e1000000-0000-0000-0000-000000000001",
        "Fix the login bug",
        OWNER,
    )
    .await;
    insert_task(
        &pool,
        "e1000000-0000-0000-0000-000000000002",
        "Plan the offsite agenda",
        OWNER,
    )
    .await;

    let matches = PgTaskNameSearch::new(pool)
        .similar_open_tasks(OWNER, None, "Fix login bug")
        .await
        .unwrap();

    assert_eq!(
        matches
            .iter()
            .map(|task| (task.task_id.as_str(), task.task_name.as_str()))
            .collect::<Vec<_>>(),
        vec![("e1000000-0000-0000-0000-000000000001", "Fix the login bug")]
    );
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(
        path = "../../../../documents/fixtures",
        scripts("documents_test_data")
    )
)]
async fn returns_nothing_for_a_distinct_name(pool: PgPool) {
    insert_task(
        &pool,
        "e1000000-0000-0000-0000-000000000001",
        "Fix the login bug",
        OWNER,
    )
    .await;

    let matches = PgTaskNameSearch::new(pool)
        .similar_open_tasks(OWNER, None, "Write the quarterly board update")
        .await
        .unwrap();

    assert_eq!(matches, Vec::new());
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(
        path = "../../../../documents/fixtures",
        scripts("documents_test_data")
    )
)]
async fn searches_team_tasks_but_not_other_peoples_tasks(pool: PgPool) {
    insert_task(
        &pool,
        "e1000000-0000-0000-0000-000000000001",
        "Fix the login bug",
        TEAMMATE,
    )
    .await;
    sqlx::query!(
        r#"
        INSERT INTO team_task (team_id, document_id, task_num)
        VALUES ($1, 'e1000000-0000-0000-0000-000000000001', 1)
        "#,
        TEAM_ID,
    )
    .execute(&pool)
    .await
    .unwrap();
    insert_task(
        &pool,
        "e1000000-0000-0000-0000-000000000002",
        "Fix login bug",
        OUTSIDER,
    )
    .await;

    let matches = PgTaskNameSearch::new(pool)
        .similar_open_tasks(OWNER, Some(TEAM_ID), "Fix login bug")
        .await
        .unwrap();

    assert_eq!(
        matches
            .iter()
            .map(|task| task.task_id.as_str())
            .collect::<Vec<_>>(),
        vec!["e1000000-0000-0000-0000-000000000001"]
    );
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(
        path = "../../../../documents/fixtures",
        scripts("documents_test_data")
    )
)]
async fn skips_completed_and_deleted_tasks(pool: PgPool) {
    insert_task(
        &pool,
        "e1000000-0000-0000-0000-000000000001",
        "Fix the login bug",
        OWNER,
    )
    .await;
    sqlx::query!(
        r#"
        INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values)
        VALUES (
            $1,
            'e1000000-0000-0000-0000-000000000001',
            'TASK',
            $2,
            jsonb_build_object('type', 'SelectOption', 'value', jsonb_build_array($3::text))
        )
        "#,
        Uuid::now_v7(),
        SystemPropertyKey::STATUS_UUID,
        StatusOption::COMPLETED_UUID.to_string(),
    )
    .execute(&pool)
    .await
    .unwrap();
    insert_task(
        &pool,
        "e1000000-0000-0000-0000-000000000002",
        "Fix the login bug",
        OWNER,
    )
    .await;
    sqlx::query!(
        r#"UPDATE "Document" SET "deletedAt" = NOW() WHERE id = 'e1000000-0000-0000-0000-000000000002'"#
    )
    .execute(&pool)
    .await
    .unwrap();

    let matches = PgTaskNameSearch::new(pool)
        .similar_open_tasks(OWNER, None, "Fix login bug")
        .await
        .unwrap();

    assert_eq!(matches, Vec::new());
}
