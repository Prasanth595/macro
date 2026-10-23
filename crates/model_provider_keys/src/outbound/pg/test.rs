use macro_db_migrator::MACRO_DB_MIGRATIONS;
use macro_uuid::Uuid;

use super::*;

const MEMBER: &str = "macro|member@example.com";
const OUTSIDER: &str = "macro|outsider@example.com";

fn encrypted() -> EncryptedProviderApiKey {
    EncryptedProviderApiKey {
        key_ciphertext: vec![1, 2, 3],
        encryption_version: 1,
        kms_key_id: "arn:aws:kms:us-east-1:123456789012:key/1".to_owned(),
    }
}

fn user(id: &str) -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from(id.to_owned()).expect("valid user id")
}

async fn insert_user(pool: &PgPool, user_id: &str) -> anyhow::Result<()> {
    let email = user_id.trim_start_matches("macro|");
    sqlx::query!(
        r#"
        WITH new_macro_user AS (
            INSERT INTO macro_user (id, username, email, stripe_customer_id)
            VALUES (gen_random_uuid(), $2, $2, $3)
            RETURNING id
        )
        INSERT INTO "User" ("id", "email", "macro_user_id")
        SELECT $1, $2, new_macro_user.id FROM new_macro_user
        "#,
        user_id,
        email,
        format!("stripe_{email}"),
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// A team owned by `MEMBER`, who is also its only member.
async fn insert_team(pool: &PgPool) -> anyhow::Result<Uuid> {
    insert_user(pool, MEMBER).await?;
    insert_user(pool, OUTSIDER).await?;
    let team_id = macro_uuid::generate_uuid_v7();
    sqlx::query!(
        "INSERT INTO team (id, name, owner_id) VALUES ($1, 'Team', $2)",
        team_id,
        MEMBER
    )
    .execute(pool)
    .await?;
    sqlx::query!(
        "INSERT INTO team_user (user_id, team_id, team_role) VALUES ($1, $2, 'owner')",
        MEMBER,
        team_id
    )
    .execute(pool)
    .await?;
    Ok(team_id)
}

fn team(team_id: Uuid) -> KeyOwner {
    KeyOwner::Team(team_id)
}

fn personal(id: &str) -> KeyOwner {
    KeyOwner::User(user(id))
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn only_current_members_find_the_teams_key(pool: PgPool) -> anyhow::Result<()> {
    let team_id = insert_team(&pool).await?;
    let repo = PgProviderKeyRepo::new(pool.clone());
    repo.upsert(
        &team(team_id),
        ModelProvider::Anthropic,
        &encrypted(),
        "sk-ant-",
    )
    .await?;

    let found = repo
        .usable(&user(MEMBER), ModelProvider::Anthropic, KeySource::Team)
        .await?
        .expect("a member finds the key");
    assert_eq!(found.owner, team(team_id));
    assert_eq!(found.encrypted, encrypted());
    assert!(
        repo.usable(&user(OUTSIDER), ModelProvider::Anthropic, KeySource::Team)
            .await?
            .is_none()
    );
    assert!(
        repo.usable(&user(MEMBER), ModelProvider::OpenAi, KeySource::Team)
            .await?
            .is_none()
    );
    assert!(
        repo.usable(&user(MEMBER), ModelProvider::Anthropic, KeySource::Personal)
            .await?
            .is_none(),
        "a team's key is never a member's own"
    );
    assert_eq!(
        repo.available(&user(MEMBER)).await?,
        AvailableKeys {
            personal: Vec::new(),
            team: vec![ModelProvider::Anthropic],
        }
    );

    sqlx::query!("DELETE FROM team_user WHERE user_id = $1", MEMBER)
        .execute(&pool)
        .await?;
    assert!(
        repo.usable(&user(MEMBER), ModelProvider::Anthropic, KeySource::Team)
            .await?
            .is_none(),
        "leaving the team ends access on the next lookup"
    );
    Ok(())
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn only_its_owner_finds_a_personal_key(pool: PgPool) -> anyhow::Result<()> {
    let team_id = insert_team(&pool).await?;
    let repo = PgProviderKeyRepo::new(pool);
    repo.upsert(
        &personal(MEMBER),
        ModelProvider::OpenAi,
        &encrypted(),
        "sk-",
    )
    .await?;
    repo.upsert(&team(team_id), ModelProvider::OpenAi, &encrypted(), "sk-")
        .await?;

    let found = repo
        .usable(&user(MEMBER), ModelProvider::OpenAi, KeySource::Personal)
        .await?
        .expect("the owner finds their key");
    assert_eq!(found.owner, personal(MEMBER));
    assert!(
        repo.usable(&user(OUTSIDER), ModelProvider::OpenAi, KeySource::Personal)
            .await?
            .is_none()
    );
    assert_eq!(
        repo.available(&user(MEMBER)).await?,
        AvailableKeys {
            personal: vec![ModelProvider::OpenAi],
            team: vec![ModelProvider::OpenAi],
        }
    );
    assert_eq!(
        repo.available(&user(OUTSIDER)).await?,
        AvailableKeys::default()
    );
    let listed = repo.list(&personal(MEMBER)).await?;
    assert_eq!(
        listed
            .iter()
            .map(|status| status.provider)
            .collect::<Vec<_>>(),
        vec![ModelProvider::OpenAi]
    );
    Ok(())
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn registering_again_replaces_the_key(pool: PgPool) -> anyhow::Result<()> {
    let team_id = insert_team(&pool).await?;
    let repo = PgProviderKeyRepo::new(pool);
    for owner in [team(team_id), personal(MEMBER)] {
        let first = repo
            .upsert(&owner, ModelProvider::OpenAi, &encrypted(), "sk-")
            .await?;
        let second = repo
            .upsert(&owner, ModelProvider::OpenAi, &encrypted(), "sk-")
            .await?;

        assert!(second.updated_at >= first.updated_at);
        assert_eq!(repo.list(&owner).await?, vec![second]);
        assert!(repo.delete(&owner, ModelProvider::OpenAi).await?);
        assert!(!repo.delete(&owner, ModelProvider::OpenAi).await?);
        assert!(repo.list(&owner).await?.is_empty());
    }
    Ok(())
}

/// Postgres cannot read the ciphertext, so the stored prefix is how it
/// refuses a key filed under the wrong provider.
#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn the_table_refuses_a_prefix_that_is_not_the_providers(pool: PgPool) -> anyhow::Result<()> {
    let team_id = insert_team(&pool).await?;
    let repo = PgProviderKeyRepo::new(pool);
    for owner in [team(team_id), personal(MEMBER)] {
        for (provider, prefix) in [
            (ModelProvider::OpenAi, "sk-ant-"),
            (ModelProvider::OpenAi, "grok_"),
            (ModelProvider::Anthropic, "sk-"),
            (ModelProvider::Anthropic, "crsr_"),
        ] {
            assert!(
                repo.upsert(&owner, provider, &encrypted(), prefix)
                    .await
                    .is_err(),
                "{prefix:?} must be refused for {provider:?}"
            );
        }
    }
    Ok(())
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn a_cursor_key_and_personal_keys_coexist(pool: PgPool) -> anyhow::Result<()> {
    insert_team(&pool).await?;
    sqlx::query!(
        r#"
        INSERT INTO cursor_configs (
            user_id, provider, key_ciphertext, encryption_version, kms_key_id, key_prefix
        )
        VALUES ($1, 'cursor', '\x01', 1, 'kms', 'crsr_')
        "#,
        MEMBER,
    )
    .execute(&pool)
    .await?;
    let repo = PgProviderKeyRepo::new(pool);

    repo.upsert(&personal(MEMBER), ModelProvider::Anthropic, &encrypted(), "sk-ant-")
        .await?;
    repo.upsert(&personal(MEMBER), ModelProvider::OpenAi, &encrypted(), "sk-")
        .await?;

    assert_eq!(
        repo.available(&user(MEMBER)).await?.personal,
        vec![ModelProvider::Anthropic, ModelProvider::OpenAi]
    );
    Ok(())
}
