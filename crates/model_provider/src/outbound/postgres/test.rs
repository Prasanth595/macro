use super::*;
use macro_user_id::user_id::MacroUserIdStr;

#[tokio::test]
async fn ciphertext_is_random_and_bound_to_its_workspace() {
    let store = PgProviderStore::new(PgPool::connect_lazy("postgres://unused").unwrap(), &[7; 32]);
    let settings = Settings::default();
    let first = store.encrypt("workspace-a", &settings).unwrap();
    let second = store.encrypt("workspace-a", &settings).unwrap();
    assert_ne!(first, second);
    assert!(store.decrypt("workspace-a", &first).is_ok());
    assert!(store.decrypt("workspace-b", &first).is_err());
    assert!(store.decrypt("workspace-a", &first[..5]).is_err());
}

#[sqlx::test(migrations = "../macro_db_client/migrations")]
async fn updates_are_atomic_and_user_deletion_cascades(pool: PgPool) {
    let user = MacroUserIdStr::try_from("macro|provider-test@example.com".to_owned()).unwrap();
    let macro_user = uuid::Uuid::now_v7();
    sqlx::query!(r#"INSERT INTO macro_user (id, username, email, stripe_customer_id) VALUES ($1, $2, $3, $4)"#,
        macro_user, "provider-test", "provider-test@example.com", "provider-test-customer")
        .execute(&pool).await.unwrap();
    sqlx::query!(
        r#"INSERT INTO "User" (id, email, macro_user_id) VALUES ($1, $2, $3)"#,
        user.as_ref(),
        "provider-test@example.com",
        macro_user
    )
    .execute(&pool)
    .await
    .unwrap();
    let workspace = Workspace::Personal(user.clone());
    let store = PgProviderStore::new(pool.clone(), &[9; 32]);
    let mut settings = Settings::default();
    assert_eq!(store.save(&workspace, &settings).await.unwrap(), 1);
    assert!(matches!(
        store.save(&workspace, &settings).await,
        Err(ProviderError::Conflict)
    ));
    settings.revision = 1;
    settings.providers.push(Provider {
        id: ProviderId(uuid::Uuid::now_v7()),
        name: "Endpoint".into(),
        base_url: "http://localhost:11434/v1".into(),
        api_key: Some(ApiKey("credential-do-not-store-in-plaintext".into())),
        enabled: false,
        models: vec![],
    });
    assert_eq!(store.save(&workspace, &settings).await.unwrap(), 2);
    let bytes = sqlx::query_scalar!(
        "SELECT configuration FROM workspace_ai_providers WHERE workspace_id = $1",
        user.as_ref()
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(!String::from_utf8_lossy(&bytes).contains("credential-do-not-store-in-plaintext"));
    assert_eq!(
        store.load(&workspace).await.unwrap().providers[0]
            .api_key
            .as_ref()
            .unwrap()
            .0,
        "credential-do-not-store-in-plaintext"
    );
    sqlx::query!(r#"DELETE FROM "User" WHERE id = $1"#, user.as_ref())
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(store.load(&workspace).await.unwrap().revision, 0);
}
