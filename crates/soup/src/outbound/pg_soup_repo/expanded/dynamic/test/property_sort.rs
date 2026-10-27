use super::*;
use crate::domain::models::{DynamicSort, SoupSortDirection};
use chrono::{DateTime, Utc};
use item_filters::ast::{
    calendar_event::CalendarEventLiteral, chat::ChatLiteral, document::DocumentLiteral,
    project::ProjectLiteral,
};
use models_grouping::{PropertyBucketing, PropertyDateRange, PropertyDateRanges};
use models_pagination::{
    CursorVal, CursorWithValAndFilter, Identify, Query, SimpleSortMethod, SortOn,
};
use serde_json::{Value, json};

const A: Uuid = uuid::uuid!("11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const B: Uuid = uuid::uuid!("11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const C: Uuid = uuid::uuid!("11111111-cccc-cccc-cccc-cccccccccccc");
const D: Uuid = uuid::uuid!("11111111-dddd-dddd-dddd-dddddddddddd");
const UNSET: Uuid = uuid::uuid!("11111111-0000-0000-0000-000000000000");

fn documents() -> EntityFilterAst {
    EntityFilterAst {
        document_filter: Some(Arc::new(Expr::is_not(Expr::val(DocumentLiteral::Id(
            Uuid::nil(),
        ))))),
        chat_filter: Some(Arc::new(Expr::val(ChatLiteral::Importance(false)))),
        project_filter: Some(Arc::new(Expr::val(ProjectLiteral::Importance(false)))),
        calendar_event_filter: Some(Arc::new(Expr::val(CalendarEventLiteral::Id(Uuid::nil())))),
        ..EntityFilterAst::mock_empty()
    }
}

async fn seed_property(
    pool: &PgPool,
    data_type: &str,
    first: Value,
    second: Value,
) -> anyhow::Result<Uuid> {
    let property_id = Uuid::now_v7();
    sqlx::query!(
        "INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, 'macro|user-1@test.com', $2, $3::text::property_data_type, false)",
        property_id,
        format!("Sort {property_id}"),
        data_type,
    )
    .execute(pool)
    .await?;
    for (id, value) in [
        (A, Some(first)),
        (B, Some(second)),
        // A valid-looking payload under the wrong tag never supplies a sort key.
        (C, Some(json!({"type": "String", "value": "999"}))),
        (D, None),
    ] {
        sqlx::query!(
            "INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) VALUES ($1, $2, 'DOCUMENT', $3, $4)",
            Uuid::now_v7(),
            id.to_string(),
            property_id,
            value,
        )
        .execute(pool)
        .await?;
    }
    Ok(property_id)
}

fn sort(property_definition_id: Uuid, direction: SoupSortDirection) -> DynamicSort {
    DynamicSort::Property {
        property_definition_id,
        direction,
    }
}

fn continuation(
    id: Uuid,
    key: Option<f64>,
    timestamp: DateTime<Utc>,
    sort: DynamicSort,
) -> Query<Uuid, DynamicSort, EntityFilterAst> {
    Query::Cursor(CursorWithValAndFilter {
        id,
        limit: 2,
        val: CursorVal {
            sort_type: sort,
            last_val: sort.position(key, timestamp),
        },
        filter: documents(),
    })
}

async fn flat(
    pool: &PgPool,
    cursor: Query<Uuid, DynamicSort, EntityFilterAst>,
    limit: u16,
) -> anyhow::Result<Vec<crate::domain::models::SoupProjectionHydration>> {
    Ok(expanded_dynamic_cursor_soup_with_projection(
        pool,
        ExpandedDynamicCursorArgs {
            user_id: MacroUserIdStr::parse_from_str("macro|user-1@test.com")?,
            limit,
            cursor,
            exclude_frecency: false,
        },
    )
    .await?)
}

async fn grouped(
    pool: &PgPool,
    cursor: Query<Uuid, DynamicSort, EntityFilterAst>,
    field: GroupByField,
    group_key: Option<&str>,
    limit: u16,
) -> anyhow::Result<Vec<crate::domain::models::grouping::ItemGroupingInfo>> {
    Ok(expanded_dynamic_cursor_soup_grouped(
        pool,
        GroupedDynamicCursorArgs {
            user_id: MacroUserIdStr::parse_from_str("macro|user-1@test.com")?,
            limit,
            cursor,
            exclude_frecency: false,
            grouping: GroupingConfig {
                field,
                group_key: group_key.map(str::to_owned),
                per_group_limit: None,
            },
        },
    )
    .await?
    .collect())
}

#[sqlx::test(
    fixtures(
        path = "../../../../../../../macro_db_client/fixtures",
        scripts("mixed_items_expanded")
    ),
    migrator = "MACRO_DB_MIGRATIONS"
)]
async fn property_sort_flat_and_grouped_pages_preserve_keys_and_missing_values(
    pool: PgPool,
) -> anyhow::Result<()> {
    for data_type in [
        "DATE",
        "NUMBER",
        "BOOLEAN",
        "SELECT_STRING",
        "SELECT_NUMBER",
        "TAG",
    ] {
        let (first, second) = match data_type {
            "DATE" => (
                json!({"type":"Date","value":"2025-01-01T00:00:00Z"}),
                json!({"type":"Date","value":"2025-02-01T00:00:00Z"}),
            ),
            "NUMBER" => (
                json!({"type":"Number","value":10}),
                json!({"type":"Number","value":20}),
            ),
            "BOOLEAN" => (
                json!({"type":"Boolean","value":false}),
                json!({"type":"Boolean","value":true}),
            ),
            _ => {
                let early = Uuid::now_v7();
                let middle = Uuid::now_v7();
                let late = Uuid::now_v7();
                // Keep options tied to the definition inserted below.
                let property_id = Uuid::now_v7();
                sqlx::query!(
                    "INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, 'macro|user-1@test.com', $2, $3::text::property_data_type, true)",
                    property_id, format!("Sort {property_id}"), data_type,
                ).execute(&pool).await?;
                for (id, order) in [(early, 1), (middle, 2), (late, 3)] {
                    if data_type == "SELECT_NUMBER" {
                        sqlx::query!(
                            "INSERT INTO property_options (id, property_definition_id, display_order, number_value) VALUES ($1, $2, $3, $4)",
                            id, property_id, order, f64::from(order),
                        ).execute(&pool).await?;
                    } else {
                        sqlx::query!(
                            "INSERT INTO property_options (id, property_definition_id, display_order, string_value) VALUES ($1, $2, $3, $4)",
                            id, property_id, order, id.to_string(),
                        ).execute(&pool).await?;
                    }
                }
                for (id, value) in [
                    (
                        A,
                        Some(json!({"type":"SelectOption","value":[late, middle]})),
                    ),
                    (B, Some(json!({"type":"SelectOption","value":[early]}))),
                    (C, Some(json!({"type":"String","value":"999"}))),
                    (D, None),
                ] {
                    sqlx::query!(
                        "INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) VALUES ($1, $2, 'DOCUMENT', $3, $4)",
                        Uuid::now_v7(), id.to_string(), property_id, value,
                    ).execute(&pool).await?;
                }
                for direction in [SoupSortDirection::Asc, SoupSortDirection::Desc] {
                    check_pages(&pool, data_type, property_id, direction, 2.0, 1.0).await?;
                }
                continue;
            }
        };
        let property_id = seed_property(&pool, data_type, first, second).await?;
        let (a, b) = match data_type {
            "DATE" => (1735689600.0 * 1_000_000.0, 1738368000.0 * 1_000_000.0),
            "NUMBER" => (10.0, 20.0),
            "BOOLEAN" => (0.0, 1.0),
            _ => unreachable!(),
        };
        for direction in [SoupSortDirection::Asc, SoupSortDirection::Desc] {
            check_pages(&pool, data_type, property_id, direction, a, b).await?;
        }
    }
    Ok(())
}

async fn check_pages(
    pool: &PgPool,
    label: &str,
    property_id: Uuid,
    direction: SoupSortDirection,
    a: f64,
    b: f64,
) -> anyhow::Result<()> {
    let order = if (a < b) == (direction == SoupSortDirection::Asc) {
        [A, B, UNSET, D, C]
    } else {
        [B, A, UNSET, D, C]
    };
    let signed = if direction == SoupSortDirection::Asc {
        -1.0
    } else {
        1.0
    };
    let selected_sort = sort(property_id, direction);
    let mut cursor = Query::Sort(selected_sort, documents());
    let mut seen = Vec::new();
    for _ in 0..4 {
        let page = flat(pool, cursor, 2).await?;
        if page.is_empty() {
            break;
        }
        for item in &page {
            let id = item.item.id();
            let key = match id {
                A => Some(a * signed),
                B => Some(b * signed),
                _ => Some(f64::NEG_INFINITY),
            };
            assert_eq!(item.sort_key, key, "{label} {direction:?} {id}");
            seen.push(id);
        }
        let last = page.last().unwrap();
        cursor = continuation(
            last.item.id(),
            last.sort_key,
            SoupItem::sort_on(SimpleSortMethod::UpdatedAt)(&last.item).last_val,
            selected_sort,
        );
    }
    assert_eq!(seen, order, "flat {label} {direction:?}");

    let initial = grouped(
        pool,
        Query::Sort(selected_sort, documents()),
        GroupByField::EntityType,
        None,
        2,
    )
    .await?;
    assert_eq!(
        initial
            .iter()
            .map(|item| item.item.id())
            .collect::<Vec<_>>(),
        order,
        "grouped {label} {direction:?}"
    );
    assert!(
        initial
            .iter()
            .all(|item| item.key == "document" && item.total_group_count == 5)
    );
    for (index, item) in initial.iter().enumerate() {
        assert_eq!(item.index_in_group, index + 1);
    }
    let mut cursor = Query::Sort(selected_sort, documents());
    let mut seen = Vec::new();
    for _ in 0..4 {
        let page = grouped(pool, cursor, GroupByField::EntityType, Some("document"), 2).await?;
        if page.is_empty() {
            break;
        }
        for item in &page {
            assert_eq!(item.total_group_count, 5);
            assert_eq!(item.index_in_group, seen.len() + 1);
            seen.push(item.item.id());
        }
        let last = page.last().unwrap();
        cursor = continuation(
            last.item.id(),
            last.sort_key,
            SoupItem::sort_on(SimpleSortMethod::UpdatedAt)(&last.item).last_val,
            selected_sort,
        );
    }
    assert_eq!(seen, order, "grouped continuation {label} {direction:?}");
    Ok(())
}

#[sqlx::test(
    fixtures(
        path = "../../../../../../../macro_db_client/fixtures",
        scripts("mixed_items_expanded")
    ),
    migrator = "MACRO_DB_MIGRATIONS"
)]
async fn property_date_ranges_keep_full_totals_and_missing_bucket(
    pool: PgPool,
) -> anyhow::Result<()> {
    let property_id = seed_property(
        &pool,
        "DATE",
        json!({"type":"Date","value":"2025-01-01T00:00:00Z"}),
        json!({"type":"Date","value":"2025-02-01T00:00:00Z"}),
    )
    .await?;
    let boundary = "2025-02-01T00:00:00Z".parse::<DateTime<Utc>>()?;
    let field = GroupByField::Property {
        property_definition_id: property_id,
        entity_type: Some("DOCUMENT".into()),
        bucketing: Some(PropertyBucketing::DateRanges(PropertyDateRanges {
            ranges: vec![
                PropertyDateRange {
                    key: "before".into(),
                    start: None,
                    end: Some(boundary),
                },
                PropertyDateRange {
                    key: "after".into(),
                    start: Some(boundary),
                    end: None,
                },
            ],
            missing_value_bucket_key: "missing".into(),
        })),
    };
    let selected_sort = sort(property_id, SoupSortDirection::Asc);
    let initial = grouped(
        &pool,
        Query::Sort(selected_sort, documents()),
        field.clone(),
        None,
        1,
    )
    .await?;
    assert_eq!(
        initial
            .iter()
            .map(|item| (
                item.key.as_str(),
                item.item.id(),
                item.total_group_count,
                item.index_in_group
            ))
            .collect::<Vec<_>>(),
        [
            ("missing", UNSET, 3, 1),
            ("missing", D, 3, 2),
            ("missing", C, 3, 3),
            ("before", A, 1, 1),
            ("after", B, 1, 1)
        ]
    );
    let first = grouped(
        &pool,
        Query::Sort(selected_sort, documents()),
        field.clone(),
        Some("missing"),
        1,
    )
    .await?;
    assert_eq!(
        (
            first[0].item.id(),
            first[0].total_group_count,
            first[0].index_in_group
        ),
        (UNSET, 3, 1)
    );
    let second = grouped(
        &pool,
        continuation(
            first[0].item.id(),
            first[0].sort_key,
            SoupItem::sort_on(SimpleSortMethod::UpdatedAt)(&first[0].item).last_val,
            selected_sort,
        ),
        field,
        Some("missing"),
        1,
    )
    .await?;
    assert_eq!(
        (
            second[0].item.id(),
            second[0].total_group_count,
            second[0].index_in_group
        ),
        (D, 3, 2)
    );
    Ok(())
}
