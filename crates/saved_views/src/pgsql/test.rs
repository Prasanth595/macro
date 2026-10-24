use super::*;
use crate::domain::{Cursor, ViewChanges, ViewRepository};
use macro_db_migrator::MACRO_DB_MIGRATIONS;

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("users"))
)]
async fn conditional_writes_and_legacy_patch(pool: PgPool) -> Result<(), sqlx::Error> {
    let repo = PgViewStorage::new(pool);
    let view = View::new(
        "macro|owner@example.com".into(),
        "Original".into(),
        serde_json::json!({"kind":"tasks","a":1}),
    );
    repo.create(&view).await?;
    let old = repo
        .create(&View {
            name: "Retried".into(),
            ..view.clone()
        })
        .await?;
    assert_eq!(old.unwrap().name, "Original");
    assert!(
        !repo
            .legacy_patch(view.id, "macro|viewer@example.com", None, None)
            .await?
    );
    assert!(
        repo.update(
            view.id,
            "macro|viewer@example.com",
            1,
            ViewChanges {
                name: Some("Stolen"),
                config: None,
                shared_team_id: None,
                shared_owner_membership_id: None,
            }
        )
        .await?
        .is_none()
    );
    assert!(
        repo.legacy_patch(
            view.id,
            "macro|owner@example.com",
            None,
            Some(&serde_json::json!({"a":2}))
        )
        .await?
    );
    let updated = repo.get(view.id).await?.unwrap();
    assert_eq!(updated.revision, 2);
    assert_eq!(updated.config, serde_json::json!({"kind":"tasks","a":2}));
    assert!(
        repo.update(
            view.id,
            "macro|owner@example.com",
            1,
            ViewChanges {
                name: None,
                config: None,
                shared_team_id: None,
                shared_owner_membership_id: None,
            }
        )
        .await?
        .is_none()
    );
    assert!(
        repo.update(
            view.id,
            "macro|owner@example.com",
            2,
            ViewChanges {
                name: None,
                config: Some(&serde_json::json!({"kind":"tasks"})),
                shared_team_id: None,
                shared_owner_membership_id: None,
            }
        )
        .await?
        .is_some()
    );
    assert!(!repo.delete(view.id, "macro|viewer@example.com", 3).await?);
    assert!(!repo.delete(view.id, "macro|owner@example.com", 2).await?);
    assert!(repo.delete(view.id, "macro|owner@example.com", 3).await?);
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("users"))
)]
async fn kind_and_cursor_candidates(pool: PgPool) -> Result<(), sqlx::Error> {
    let repo = PgViewStorage::new(pool);
    let team = uuid::Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
    let first = View::new(
        "macro|owner@example.com".into(),
        "A".into(),
        serde_json::json!({"kind":"tasks"}),
    );
    repo.create(&first).await?;
    let second = View {
        id: uuid::Uuid::now_v7(),
        name: "B".into(),
        shared_team_id: Some(team),
        shared_owner_membership_id: Some(
            uuid::Uuid::parse_str("aaaaaaaa-aaaa-7aaa-aaaa-aaaaaaaaaaaa").unwrap(),
        ),
        ..first.clone()
    };
    repo.create(&second).await?;
    let other = View {
        id: uuid::Uuid::now_v7(),
        name: "C".into(),
        config: serde_json::json!({"kind":"crm"}),
        ..second.clone()
    };
    repo.create(&other).await?;
    let candidates = repo
        .candidates("macro|viewer@example.com", &[team], Some("tasks"), None, 1)
        .await?;
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].id, second.id);
    let after = Cursor {
        created_at: candidates[0].created_at,
        id: candidates[0].id,
    };
    assert!(
        repo.candidates(
            "macro|viewer@example.com",
            &[team],
            Some("tasks"),
            Some(after),
            1
        )
        .await?
        .is_empty()
    );
    assert!(
        repo.candidates("macro|viewer@example.com", &[], Some("tasks"), None, 10)
            .await?
            .is_empty()
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("users"))
)]
async fn deleting_shared_team_revokes_share_without_deleting_definition(
    pool: PgPool,
) -> Result<(), sqlx::Error> {
    let repo = PgViewStorage::new(pool.clone());
    let team = uuid::Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
    let membership = uuid::Uuid::parse_str("aaaaaaaa-aaaa-7aaa-aaaa-aaaaaaaaaaaa").unwrap();
    let view = View {
        shared_team_id: Some(team),
        shared_owner_membership_id: Some(membership),
        ..View::new(
            "macro|owner@example.com".into(),
            "Shared".into(),
            serde_json::json!({"kind":"tasks"}),
        )
    };
    repo.create(&view).await?;
    sqlx::query!("DELETE FROM team WHERE id = $1", team)
        .execute(&pool)
        .await?;

    let remaining = repo.get(view.id).await?.unwrap();
    assert_eq!(remaining.shared_team_id, None);
    assert_eq!(remaining.shared_owner_membership_id, Some(membership));
    assert!(
        repo.candidates("macro|viewer@example.com", &[team], None, None, 10)
            .await?
            .is_empty()
    );

    sqlx::query!(
        "INSERT INTO team (id, name, owner_id) VALUES ($1, 'Recreated', $2)",
        team,
        "macro|owner@example.com"
    )
    .execute(&pool)
    .await?;
    assert!(
        repo.candidates("macro|viewer@example.com", &[team], None, None, 10)
            .await?
            .is_empty()
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("users"))
)]
async fn deleted_ids_cannot_be_recreated_and_rejected_deletes_do_not_retire_ids(
    pool: PgPool,
) -> Result<(), sqlx::Error> {
    let repo = PgViewStorage::new(pool.clone());
    let view = View::new(
        "macro|owner@example.com".into(),
        "Original".into(),
        serde_json::json!({"kind":"tasks"}),
    );
    repo.create(&view).await?;
    assert!(!repo.delete(view.id, "macro|viewer@example.com", 1).await?);
    assert!(!repo.delete(view.id, "macro|owner@example.com", 2).await?);
    assert!(repo.create(&view).await?.is_some());
    assert!(repo.delete(view.id, "macro|owner@example.com", 1).await?);
    assert!(repo.get(view.id).await?.is_none());
    assert!(repo.create(&view).await?.is_none());
    assert!(
        repo.legacy_list("macro|owner@example.com")
            .await?
            .is_empty()
    );

    // Deployed REST writers and account cascades also run the deletion trigger.
    let legacy = View {
        id: Uuid::now_v7(),
        ..view.clone()
    };
    repo.create(&legacy).await?;
    sqlx::query!("DELETE FROM saved_view WHERE id = $1", legacy.id)
        .execute(&pool)
        .await?;
    assert!(repo.create(&legacy).await?.is_none());

    let unused = View {
        id: Uuid::now_v7(),
        ..view
    };
    assert!(!repo.delete(unused.id, "macro|owner@example.com", 1).await?);
    assert!(repo.create(&unused).await?.is_some());
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("users", "create_retry_gate"))
)]
async fn legacy_delete_during_create_neither_deadlocks_nor_revives_view(
    pool: PgPool,
) -> Result<(), sqlx::Error> {
    let repo = PgViewStorage::new(pool.clone());
    let original = View::new(
        "macro|owner@example.com".into(),
        "Original".into(),
        serde_json::json!({"kind":"tasks"}),
    );
    repo.create(&original).await?;

    let mut deletion = pool.begin().await?;
    sqlx::query!("SET LOCAL lock_timeout = '2s'")
        .execute(&mut *deletion)
        .await?;
    sqlx::query!(
        "SELECT id FROM saved_view WHERE id = $1 FOR UPDATE",
        original.id
    )
    .fetch_one(&mut *deletion)
    .await?;

    // The fixture pauses INSERT after the initial tombstone check. The arrival
    // lock confirms that the retry holds its per-ID lock before DELETE begins.
    let mut gate = pool.begin().await?;
    sqlx::query!("SET LOCAL lock_timeout = '5s'")
        .execute(&mut *gate)
        .await?;
    sqlx::query!("SELECT pg_advisory_xact_lock(804721)")
        .execute(&mut *gate)
        .await?;
    let writer_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect_with((*pool.connect_options()).clone())
        .await?;
    let mut writer_connection = writer_pool.acquire().await?;
    sqlx::query!("SELECT pg_advisory_lock(804722)")
        .execute(&mut *writer_connection)
        .await?;
    drop(writer_connection);
    let retry = View {
        name: "Racing retry".into(),
        ..original.clone()
    };
    let writer = tokio::spawn(async move { PgViewStorage::new(writer_pool).create(&retry).await });
    sqlx::query!("SELECT pg_advisory_xact_lock(804722)")
        .execute(&mut *gate)
        .await?;

    sqlx::query!("DELETE FROM saved_view WHERE id = $1", original.id)
        .execute(&mut *deletion)
        .await?;
    deletion.commit().await?;
    gate.commit().await?;

    assert!(writer.await.unwrap()?.is_none());
    assert!(repo.get(original.id).await?.is_none());
    assert!(repo.create(&original).await?.is_none());
    Ok(())
}
