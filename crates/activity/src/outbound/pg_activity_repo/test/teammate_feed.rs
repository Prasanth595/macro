use super::*;

const VIEWER: &str = "macro|viewer@example.com";
const ALICE: &str = "macro|alice@example.com";
const BOB: &str = "macro|bob@example.com";
const OUTSIDER: &str = "macro|outsider@example.com";
const LONER: &str = "macro|loner@example.com";

async fn insert_user(pool: &PgPool, id: &str) {
    let macro_user_id = Uuid::now_v7();
    sqlx::query!(
        r#"INSERT INTO macro_user (id, username, email, stripe_customer_id) VALUES ($1, $2, $2, $2)"#,
        macro_user_id,
        id,
    )
    .execute(pool)
    .await
    .expect("macro_user should insert");
    sqlx::query!(
        r#"INSERT INTO "User" (id, email, macro_user_id) VALUES ($1, $1, $2)"#,
        id,
        macro_user_id,
    )
    .execute(pool)
    .await
    .expect("user should insert");
}

async fn insert_team(pool: &PgPool, members: &[&str]) {
    let team_id = Uuid::now_v7();
    sqlx::query!(
        r#"INSERT INTO team (id, owner_id, name) VALUES ($1, $2, 'team')"#,
        team_id,
        members[0],
    )
    .execute(pool)
    .await
    .expect("team should insert");
    for member in members {
        sqlx::query!(
            r#"INSERT INTO team_user (user_id, team_id, team_role) VALUES ($1, $2, 'member')"#,
            *member,
            team_id,
        )
        .execute(pool)
        .await
        .expect("team member should insert");
    }
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn teammate_feed_merges_teammates_newest_first_without_the_viewer(pool: PgPool) {
    for id in [VIEWER, ALICE, BOB, OUTSIDER, LONER] {
        insert_user(&pool, id).await;
    }
    insert_team(&pool, &[VIEWER, ALICE, BOB]).await;
    insert_team(&pool, &[OUTSIDER]).await;
    let repo = PgActivityRepo::new(pool);
    let t = base_time();
    let at = |seconds: i64| t + chrono::Duration::seconds(seconds);
    repo.insert_activities(&[
        seed_for_subject_at(1, ALICE, "alice-0", at(0)),
        seed_for_subject_at(2, BOB, "bob-1", at(1)),
        seed_for_subject_at(3, ALICE, "alice-2", at(2)),
        seed_for_subject_at(4, VIEWER, "viewer-3", at(3)),
        seed_for_subject_at(5, OUTSIDER, "outsider-4", at(4)),
        seed_for_subject_at(6, BOB, "bob-5", at(5)),
        seed_for_subject_at(7, ALICE, "alice-6", at(6)),
    ])
    .await
    .unwrap();

    let first = repo.teammate_feed(VIEWER, None, nz(2)).await.unwrap();
    let second = repo.teammate_feed(VIEWER, first.next, nz(2)).await.unwrap();
    let last = repo
        .teammate_feed(VIEWER, second.next, nz(2))
        .await
        .unwrap();

    let entity_ids = |page: &ActivityFeedPage| {
        page.records
            .iter()
            .map(|record| record.entity_id.clone())
            .collect::<Vec<_>>()
    };
    assert_eq!(entity_ids(&first), ["alice-6", "bob-5"]);
    assert_eq!(entity_ids(&second), ["alice-2", "bob-1"]);
    assert_eq!(entity_ids(&last), ["alice-0"]);
    assert_eq!(last.next, None, "exhausted feed carries no cursor");

    let alone = repo.teammate_feed(OUTSIDER, None, nz(10)).await.unwrap();
    assert!(alone.records.is_empty(), "a team of one has no teammates");
    let teamless = repo.teammate_feed(LONER, None, nz(10)).await.unwrap();
    assert!(teamless.records.is_empty());
    assert_eq!(teamless.next, None);
}
