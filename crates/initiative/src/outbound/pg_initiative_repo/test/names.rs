use std::collections::HashMap;

use super::*;
use crate::domain::reads::ProfileName;

async fn set_profile_name(
    pool: &PgPool,
    user_id: &str,
    first_name: Option<&str>,
    last_name: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO macro_user_info (macro_user_id, first_name, last_name)
        SELECT macro_user_id, $2, $3 FROM "User" WHERE id = $1
        "#,
        user_id,
        first_name,
        last_name,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// A contact name `reader` keeps for `contact` in their connected mailbox.
async fn insert_contact_name(
    pool: &PgPool,
    reader: &str,
    contact: &str,
    name: &str,
) -> anyhow::Result<()> {
    let link_id = Uuid::now_v7();
    sqlx::query!(
        r#"
        INSERT INTO email_links (id, macro_id, fusionauth_user_id, email_address, provider)
        VALUES ($1, $2, $3, $4, 'GMAIL')
        "#,
        link_id,
        reader,
        format!("fusionauth-{link_id}"),
        reader.trim_start_matches("macro|"),
    )
    .execute(pool)
    .await?;
    sqlx::query!(
        r#"
        INSERT INTO email_contacts (id, link_id, email_address, name)
        VALUES ($1, $2, $3, $4)
        "#,
        Uuid::now_v7(),
        link_id,
        contact.trim_start_matches("macro|"),
        name,
    )
    .execute(pool)
    .await?;
    Ok(())
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn task_names_name_the_tasks_that_exist(pool: PgPool) -> anyhow::Result<()> {
    insert_user(&pool, OWNER).await?;
    for (id, name) in [("task-a", "Write the brief"), ("task-b", "Pick a date")] {
        sqlx::query!(
            r#"INSERT INTO "Document" (id, name, "fileType", owner) VALUES ($1, $2, 'md', $3)"#,
            id,
            name,
            OWNER,
        )
        .execute(&pool)
        .await?;
    }

    let names = repo(pool)
        .task_names(vec!["task-a".into(), "task-b".into(), "missing".into()])
        .await?;

    assert_eq!(
        names,
        HashMap::from([
            ("task-a".to_string(), "Write the brief".to_string()),
            ("task-b".to_string(), "Pick a date".to_string()),
        ])
    );
    Ok(())
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn profile_names_come_from_profiles_never_from_contacts(pool: PgPool) -> anyhow::Result<()> {
    for user_id in [OWNER, MEMBER, TEAMMATE, CHANNEL_USER, STRANGER] {
        insert_user(&pool, user_id).await?;
    }
    set_profile_name(&pool, OWNER, Some("Olive"), Some("Owner")).await?;
    set_profile_name(&pool, MEMBER, Some("Mo"), None).await?;
    set_profile_name(&pool, TEAMMATE, Some("N/A"), Some("N/A")).await?;
    insert_contact_name(&pool, STRANGER, CHANNEL_USER, "Contact Name").await?;

    let mut names = repo(pool)
        .profile_names(
            [OWNER, MEMBER, TEAMMATE, CHANNEL_USER, OTHER_OWNER]
                .map(String::from)
                .to_vec(),
        )
        .await?;
    names.sort_by(|left, right| left.id.cmp(&right.id));

    assert_eq!(
        names,
        [
            ProfileName {
                id: MEMBER.to_string(),
                first_name: Some("Mo".to_string()),
                last_name: None,
            },
            ProfileName {
                id: OWNER.to_string(),
                first_name: Some("Olive".to_string()),
                last_name: Some("Owner".to_string()),
            },
        ]
    );
    Ok(())
}
