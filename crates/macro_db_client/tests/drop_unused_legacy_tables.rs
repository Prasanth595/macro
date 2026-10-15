//! Regression coverage for retiring populated legacy storage without cascading
//! into active tables or silently removing unexpected dependents.

use sqlx::PgPool;

const LEGACY_MIGRATION: &str =
    include_str!("../migrations/20261015155830_drop_unused_legacy_tables.sql");
const MACRO_MIGRATION: &str =
    include_str!("../migrations/20261015160030_drop_unused_macro_prompts.sql");

const LEGACY_TABLES: &[&str] = &[
    "WebsocketConnectionPermissions",
    "MacroPromptAttachment",
    "Artifact",
    "EmailInsightsBackfillBatch",
    "EmailInsightsBackfillJob",
    "DocumentSummary",
    "UserInsightBatch",
    "UserInsights",
    "InsightContext",
];
const MACRO_TABLES: &[&str] = &["MacroPromptPermission", "MacroPrompt"];
const RETAINED_TABLES: &[&str] = &[
    "User",
    "Document",
    "Chat",
    "ChatMessage",
    "SharePermission",
    "Organization",
    "OrganizationItJob",
    "EnterpriseRules",
    "EnterpriseIManageTenants",
    "EnterpriseEmailContacts",
    "OrganizationDefaultSharePermission",
    "Experiment",
    "ExperimentLog",
];

async fn populate_legacy_schema(pool: &PgPool) -> Result<(), sqlx::Error> {
    // CI may clone a pre-migrated template. Only this isolated test database is
    // reset; the migrations themselves must never use CASCADE.
    sqlx::raw_sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        .execute(pool)
        .await?;
    sqlx::raw_sql(include_str!("../migrations/0001_baseline.sql"))
        .execute(pool)
        .await?;
    sqlx::raw_sql(include_str!("fixtures/unused_legacy_tables.sql"))
        .execute(pool)
        .await?;
    Ok(())
}

async fn table_exists(pool: &PgPool, table: &str) -> Result<bool, sqlx::Error> {
    let name = format!(r#"public."{table}""#);
    sqlx::query_scalar!(
        r#"SELECT to_regclass($1::text) IS NOT NULL AS "exists!""#,
        name,
    )
    .fetch_one(pool)
    .await
}

async fn assert_populated(pool: &PgPool, tables: &[&str]) -> Result<(), sqlx::Error> {
    for table in tables {
        assert!(
            LEGACY_TABLES.contains(table)
                || MACRO_TABLES.contains(table)
                || RETAINED_TABLES.contains(table)
        );
        // Table identifiers cannot be bound. They come exclusively from the
        // allowlisted test constants above, never external input.
        let count: i64 = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM \"")
            .push(*table)
            .push("\"")
            .build_query_scalar()
            .fetch_one(pool)
            .await?;
        assert_eq!(count, 1, "expected the fixture row in {table}");
    }
    Ok(())
}

async fn apply_migration(pool: &PgPool, migration: &str) -> Result<(), sqlx::Error> {
    // Match SQLx's transactional migration execution, including SET LOCAL.
    let mut transaction = pool.begin().await?;
    sqlx::raw_sql(migration).execute(&mut *transaction).await?;
    transaction.commit().await
}

#[sqlx::test(migrations = false)]
async fn drops_populated_legacy_tables_and_preserves_active_data(
    pool: PgPool,
) -> Result<(), sqlx::Error> {
    populate_legacy_schema(&pool).await?;
    assert_populated(&pool, LEGACY_TABLES).await?;
    assert_populated(&pool, MACRO_TABLES).await?;

    apply_migration(&pool, LEGACY_MIGRATION).await?;
    for table in LEGACY_TABLES {
        assert!(
            !table_exists(&pool, table).await?,
            "{table} was not dropped"
        );
    }
    assert_populated(&pool, MACRO_TABLES).await?;
    assert_populated(&pool, RETAINED_TABLES).await?;

    apply_migration(&pool, MACRO_MIGRATION).await?;
    for table in MACRO_TABLES {
        assert!(
            !table_exists(&pool, table).await?,
            "{table} was not dropped"
        );
    }
    assert_populated(&pool, RETAINED_TABLES).await?;
    Ok(())
}

#[sqlx::test(migrations = false)]
async fn unexpected_legacy_dependency_blocks_drop_without_cascading(
    pool: PgPool,
) -> Result<(), sqlx::Error> {
    populate_legacy_schema(&pool).await?;
    sqlx::raw_sql(
        r#"CREATE TABLE unexpected_reference (
            attachment_id TEXT REFERENCES "MacroPromptAttachment" (id)
        );"#,
    )
    .execute(&pool)
    .await?;

    let mut transaction = pool.begin().await?;
    let error = sqlx::raw_sql(LEGACY_MIGRATION)
        .execute(&mut *transaction)
        .await
        .expect_err("an unexpected FK must block the drop");
    transaction.rollback().await?;
    assert_eq!(
        error
            .as_database_error()
            .and_then(|error| error.code())
            .as_deref(),
        Some("2BP01")
    );
    assert!(table_exists(&pool, "unexpected_reference").await?);
    assert_populated(&pool, LEGACY_TABLES).await?;
    assert_populated(&pool, MACRO_TABLES).await?;
    assert_populated(&pool, RETAINED_TABLES).await?;
    Ok(())
}

#[sqlx::test(migrations = false)]
async fn unexpected_macro_dependency_rolls_back_the_permission_drop(
    pool: PgPool,
) -> Result<(), sqlx::Error> {
    populate_legacy_schema(&pool).await?;
    apply_migration(&pool, LEGACY_MIGRATION).await?;
    sqlx::raw_sql(
        r#"CREATE TABLE unexpected_reference (
            macro_prompt_id TEXT REFERENCES "MacroPrompt" (id)
        );"#,
    )
    .execute(&pool)
    .await?;

    let mut transaction = pool.begin().await?;
    let error = sqlx::raw_sql(MACRO_MIGRATION)
        .execute(&mut *transaction)
        .await
        .expect_err("an unexpected FK must block the drop");
    transaction.rollback().await?;
    assert_eq!(
        error
            .as_database_error()
            .and_then(|error| error.code())
            .as_deref(),
        Some("2BP01")
    );
    assert!(table_exists(&pool, "unexpected_reference").await?);
    assert_populated(&pool, MACRO_TABLES).await?;
    assert_populated(&pool, RETAINED_TABLES).await?;
    Ok(())
}
