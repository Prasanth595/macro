use super::*;
use sqlx::{Execute, Row};

/// Local cost probe: isolated database, 100,000 accessible mixed items, no hosted data.
#[sqlx::test(
    fixtures(
        path = "../../../../../../../../macro_db_client/fixtures",
        scripts("mixed_items_expanded")
    ),
    migrator = "MACRO_DB_MIGRATIONS"
)]
#[ignore = "local heavy-account EXPLAIN ANALYZE probe"]
async fn property_date_query_explain_local(db: PgPool) -> anyhow::Result<()> {
    let documents: Vec<String> = (0..50_000).map(|_| Uuid::now_v7().to_string()).collect();
    let chats: Vec<String> = (0..25_000).map(|_| Uuid::now_v7().to_string()).collect();
    let projects: Vec<String> = (0..25_000).map(|_| Uuid::now_v7().to_string()).collect();
    let definition = Uuid::now_v7();
    let viewer = MacroUserIdStr::parse_from_str("macro|user-1@test.com")?;
    let mut connection = db.acquire().await?;
    sqlx::query!("SET session_replication_role = replica")
        .execute(&mut *connection)
        .await?;
    sqlx::query!("INSERT INTO \"DocumentFamily\" (id, \"rootDocumentId\") SELECT 1000000 + ordinal, id FROM unnest($1::text[]) WITH ORDINALITY AS rows(id, ordinal)", &documents).execute(&mut *connection).await?;
    sqlx::query!("INSERT INTO \"Document\" (id, name, owner, \"documentFamilyId\", \"fileType\") SELECT id, 'Cost probe', 'macro|user-1@test.com', 1000000 + ordinal, 'md' FROM unnest($1::text[]) WITH ORDINALITY AS rows(id, ordinal)", &documents).execute(&mut *connection).await?;
    sqlx::query!("INSERT INTO document_sub_type (document_id, sub_type) SELECT id, 'task'::document_sub_type_value FROM unnest($1::text[]) WITH ORDINALITY AS rows(id, ordinal) WHERE ordinal % 2 = 0", &documents).execute(&mut *connection).await?;
    sqlx::query!("INSERT INTO \"Chat\" (id, name, \"userId\") SELECT id, 'Cost probe', 'macro|user-1@test.com' FROM unnest($1::text[]) id", &chats).execute(&mut *connection).await?;
    sqlx::query!("INSERT INTO \"Project\" (id, name, \"userId\") SELECT id, 'Cost probe', 'macro|user-1@test.com' FROM unnest($1::text[]) id", &projects).execute(&mut *connection).await?;
    for (ids, kind) in [
        (&documents, "document"),
        (&chats, "chat"),
        (&projects, "project"),
    ] {
        sqlx::query!("INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level) SELECT id::uuid, $2, 'macro|user-1@test.com', 'user', 'owner' FROM unnest($1::text[]) id", ids, kind).execute(&mut *connection).await?;
    }
    sqlx::query!("INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, 'macro|user-1@test.com', 'Cost probe date', 'DATE', false)", definition).execute(&mut *connection).await?;
    for (ids, kind) in [
        (&documents, "DOCUMENT"),
        (&chats, "CHAT"),
        (&projects, "PROJECT"),
    ] {
        let property_ids: Vec<Uuid> = ids.iter().map(|_| Uuid::now_v7()).collect();
        sqlx::query!("INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) SELECT property_id, entity_id, CASE WHEN $3 = 'DOCUMENT' AND ordinal % 2 = 0 THEN 'TASK'::property_entity_type ELSE $3::property_entity_type END, $4, jsonb_build_object('type', 'Date', 'value', '2026-10-' || lpad((1 + ordinal % 27)::text, 2, '0') || 'T00:00:00Z') FROM unnest($1::uuid[], $2::text[]) WITH ORDINALITY AS rows(property_id, entity_id, ordinal) WHERE ordinal % 3 != 0", &property_ids, ids, kind, definition).execute(&mut *connection).await?;
    }
    sqlx::query!("SET session_replication_role = origin")
        .execute(&mut *connection)
        .await?;
    sqlx::query!("SET random_page_cost = 1.1")
        .execute(&mut *connection)
        .await?;
    sqlx::query!("SET work_mem = '16MB'")
        .execute(&mut *connection)
        .await?;
    sqlx::query!("SET jit = off")
        .execute(&mut *connection)
        .await?;
    sqlx::query!("ANALYZE").execute(&mut *connection).await?;
    let definitions = Definitions::new(properties::PropertiesPgRepo::new(db.clone()), None, None);
    let mut selection = CandidateQuery {
        date_property_id: Some(definition),
        timestamp_sort: None,
        direction: CandidateDirection::Ascending,
        grouping: None,
        cursor: None,
        limit: 20,
    };
    for label in ["initial", "continuation", "grouped", "filtered_tasks"] {
        if label == "grouped" {
            selection.cursor = None;
            selection.grouping = Some(
                models_grouping::GroupingConfig::new(models_grouping::GroupByField::EntityType)
                    .with_limit(20),
            );
        }
        let mut filter = EntityFilterAst::default();
        if label == "filtered_tasks" {
            selection.cursor = None;
            selection.grouping = None;
            filter.document_filter = Some(Arc::new(Expr::val(DocumentLiteral::SubType(
                document_sub_type::DocumentSubType::Task,
            ))));
            filter.chat_filter = Some(Arc::new(Expr::val(ChatLiteral::ChatId(Uuid::nil()))));
            filter.project_filter = Some(Arc::new(Expr::val(ProjectLiteral::ProjectIdSelf(
                Uuid::nil(),
            ))));
        }
        let request = PropertyCandidateRequest {
            filter,
            selection: definitions
                .authorize_property_query(viewer.clone(), None, selection.clone())
                .await?,
        };
        let mut builder = build_query(&request)?;
        let mut query = builder.build();
        let explain = format!("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {}", query.sql());
        let arguments = query
            .take_arguments()
            .map_err(|error| anyhow::anyhow!(error.to_string()))?
            .expect("candidate query binds arguments");
        let row = sqlx::query_with(&explain, arguments)
            .fetch_one(&mut *connection)
            .await?;
        let plan: serde_json::Value = row.try_get(0)?;
        println!("{label}: {plan}");
        if label == "initial" {
            let page = select(&db, request).await?;
            assert!(page.groups[0].total_count >= 100_000);
            let last = page.candidates.last().expect("nonempty heavy account");
            selection.cursor = Some(CandidateCursor {
                identity: last.identity.clone(),
                sort_value: last.sort_value,
            });
        }
    }
    Ok(())
}
