use super::*;
use models_grouping::{PropertyBucketing, PropertyDateRange, PropertyDateRanges};
use models_pagination::{CursorWithValAndFilter, SortOn};
use models_soup::item::SoupItem;
use uuid::Uuid;

#[sqlx::test(
    fixtures(
        path = "../../../../../../macro_db_client/fixtures",
        scripts("mixed_items_expanded")
    ),
    migrator = "MACRO_DB_MIGRATIONS"
)]
async fn custom_date_property_groups_documents_tasks_chats_and_projects_before_paging(
    pool: Pool<Postgres>,
) -> anyhow::Result<()> {
    let property = Uuid::from_u128(17);
    sqlx::query!(
        "INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, 'macro|user-1@test.com', 'Review date', 'DATE', false)",
        property,
    ).execute(&pool).await?;
    sqlx::query!(
        "INSERT INTO document_sub_type (document_id, sub_type) VALUES ('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'task'), ('11111111-dddd-dddd-dddd-dddddddddddd', 'task')"
    ).execute(&pool).await?;
    for (id, entity_type, value) in [
        (
            "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "DOCUMENT",
            serde_json::json!({"type":"Date", "value":"2026-03-08T04:59:59Z"}),
        ),
        (
            "11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "TASK",
            serde_json::json!({"type":"Date", "value":"2026-03-08T05:00:00Z"}),
        ),
        (
            "11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "DOCUMENT",
            serde_json::json!({"type":"Date", "value":"2026-03-08T04:00:00Z"}),
        ),
        (
            "22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "CHAT",
            serde_json::json!({"type":"Date", "value":"2026-03-08T05:00:00Z"}),
        ),
        (
            "aaaaaaaa-ffff-ffff-ffff-ffffffffffff",
            "PROJECT",
            serde_json::json!({"type":"Date", "value":"2026-03-08T04:00:00Z"}),
        ),
        (
            "11111111-cccc-cccc-cccc-cccccccccccc",
            "DOCUMENT",
            serde_json::json!({"type":"Date", "value":null}),
        ),
        (
            "11111111-dddd-dddd-dddd-dddddddddddd",
            "TASK",
            serde_json::json!({"type":"Link", "value":["https://one.test", "https://two.test"]}),
        ),
        (
            "11111111-9999-9999-9999-999999999999",
            "DOCUMENT",
            serde_json::json!({"type":"Date", "value":"2026-03-08T05:00:00Z"}),
        ),
    ] {
        sqlx::query!(
            "INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) VALUES ($1, $2, $3::text::property_entity_type, $4, $5)",
            Uuid::now_v7(), id, entity_type, property, value,
        ).execute(&pool).await?;
    }
    let grouping = GroupingConfig {
        field: GroupByField::Property {
            property_definition_id: property,
            entity_type: None,
            bucketing: Some(PropertyBucketing::DateRanges(PropertyDateRanges {
                ranges: vec![
                    PropertyDateRange {
                        key: "past'quoted".into(),
                        start: None,
                        end: Some("2026-03-08T05:00:00Z".parse()?),
                    },
                    PropertyDateRange {
                        key: "review".into(),
                        start: Some("2026-03-08T05:00:00Z".parse()?),
                        end: None,
                    },
                ],
                missing_value_bucket_key: "no-review-date".into(),
            })),
        },
        group_key: None,
        per_group_limit: Some(1),
    };
    let first = expanded_dynamic_cursor_soup_grouped(
        &pool,
        GroupedDynamicCursorArgs {
            user_id: MacroUserIdStr::parse_from_str("macro|user-1@test.com")?,
            limit: 1,
            cursor: Query::Sort(SimpleSortMethod::UpdatedAt, EntityFilterAst::mock_empty()),
            exclude_frecency: false,
            grouping: grouping.clone(),
        },
    )
    .await?
    .collect::<Vec<_>>();
    assert_eq!(first.len(), 3);
    assert_eq!(
        first
            .iter()
            .find(|row| row.key == "past'quoted")
            .unwrap()
            .total_group_count,
        2
    );
    let review = first.iter().find(|row| row.key == "review").unwrap();
    assert_eq!(review.total_group_count, 2);
    assert_eq!(review.index_in_group, 1);
    let missing = first
        .iter()
        .find(|row| row.key == "no-review-date")
        .unwrap();
    assert_eq!(missing.total_group_count, 9);
    let next = expanded_dynamic_cursor_soup_grouped(
        &pool,
        GroupedDynamicCursorArgs {
            user_id: MacroUserIdStr::parse_from_str("macro|user-1@test.com")?,
            limit: 1,
            cursor: Query::Cursor(CursorWithValAndFilter {
                id: review.item.id(),
                limit: 1,
                val: SoupItem::sort_on(SimpleSortMethod::UpdatedAt)(&review.item),
                filter: EntityFilterAst::mock_empty(),
            }),
            exclude_frecency: false,
            grouping: grouping.clone().with_group_key("review"),
        },
    )
    .await?
    .collect::<Vec<_>>();
    assert_eq!(next.len(), 1);
    assert_ne!(next[0].item.id(), review.item.id());
    assert_eq!(next[0].total_group_count, 2);
    assert_eq!(next[0].index_in_group, 2);
    assert!(
        next.iter()
            .chain(first.iter())
            .all(|row| row.item.id().to_string() != "11111111-9999-9999-9999-999999999999")
    );
    Ok(())
}
