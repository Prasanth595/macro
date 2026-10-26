use super::*;
use models_pagination::DueDateSort;

#[tokio::test]
async fn due_date_sort_markers_select_the_due_date_query() {
    for sort_method in ["due_date_earliest", "due_date_latest"] {
        let soup = MockSoup::succeeding();
        let calls = soup.called.clone();
        let router = mock_router_with(
            soup,
            MockEmailLinkResult {
                get_link_result: Arc::new(|| Ok(None)),
            },
        );
        let request = authenticated_request()
            .uri("/soup/ast")
            .method(Method::POST)
            .header("content-type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_vec(&json!({ "sort_method": sort_method })).unwrap(),
            ))
            .unwrap();

        let (status, _) = send_json(router, request).await;
        assert_eq!(status, StatusCode::OK);
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert!(matches!(calls[0].cursor_kind, MockCursorKind::DueDateSort));
    }
}

#[tokio::test]
async fn null_due_date_cursor_does_not_fall_back_to_an_initial_timestamp_query() {
    for sort_type in [DueDateSort::Earliest, DueDateSort::Latest] {
        let soup = MockSoup::succeeding();
        let calls = soup.called.clone();
        let router = mock_router_with(
            soup,
            MockEmailLinkResult {
                get_link_result: Arc::new(|| Ok(None)),
            },
        );
        let cursor = models_pagination::Base64Str::encode_json(models_pagination::Cursor {
            id: Uuid::from_u128(1),
            limit: 20,
            val: CursorVal {
                sort_type,
                last_val: None,
            },
            filter: EntityFilters::default(),
        })
        .type_erase()
        .replace('+', "%2B")
        .replace('/', "%2F")
        .replace('=', "%3D");
        let request = authenticated_request()
            .uri(format!("/soup?cursor={cursor}"))
            .method(Method::POST)
            .header("content-type", "application/json")
            .body(axum::body::Body::from("{}"))
            .unwrap();

        let (status, _) = send_json(router, request).await;
        assert_eq!(status, StatusCode::OK);
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert!(matches!(
            calls[0].cursor_kind,
            MockCursorKind::DueDateCursor
        ));
    }
}

fn date_range_grouping() -> serde_json::Value {
    json!({ "property": {
        "property_definition_id": "00000000-0000-0000-0000-000000000012",
        "entity_type": "DOCUMENT",
        "bucketing": {
            "type": "date_ranges",
            "ranges": [
                { "key": "before-review", "start": null, "end": "2026-03-08T05:00:00Z" },
                { "key": "review", "start": "2026-03-08T05:00:00Z", "end": "2026-03-09T04:00:00Z" },
                { "key": "after-review", "start": "2026-03-09T04:00:00Z", "end": null }
            ],
            "missing_value_bucket_key": "no-review-date"
        }
    }})
}

#[tokio::test]
async fn date_range_grouping_preserves_property_ranges_sort_and_limit() {
    let soup = MockSoup::succeeding();
    let calls = soup.grouped_calls.clone();
    let router = mock_router_with(
        soup,
        MockEmailLinkResult {
            get_link_result: Arc::new(|| Ok(None)),
        },
    );
    let request = authenticated_request()
        .uri("/soup/ast/grouped")
        .method(Method::POST)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({
                "mode": "initial",
                "group_by": date_range_grouping(),
                "sort_method": "updated_at",
                "per_group_limit": 25
            }))
            .unwrap(),
        ))
        .unwrap();
    let (status, _) = send_json(router, request).await;
    assert_eq!(status, StatusCode::OK);
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].0.per_group_limit, Some(25));
    let (property, ranges) = calls[0].0.field.date_ranges().unwrap();
    assert_eq!(property, Uuid::from_u128(18));
    assert_eq!(ranges.missing_value_bucket_key, "no-review-date");
    assert_eq!(ranges.ranges[1].key, "review");
    assert_eq!(
        ranges.ranges[1].end.unwrap() - ranges.ranges[1].start.unwrap(),
        chrono::Duration::hours(23)
    );
    assert!(matches!(
        calls[0].1,
        crate::domain::models::GroupedSortMethod::Timestamp(SimpleSortMethod::UpdatedAt)
    ));
}

#[tokio::test]
async fn invalid_date_partitions_are_rejected_before_the_service() {
    for invalid in [
        "gap",
        "duplicate_key",
        "missing_key_collision",
        "empty_ranges",
    ] {
        let mut group_by = date_range_grouping();
        let bucketing = &mut group_by["property"]["bucketing"];
        match invalid {
            "gap" => bucketing["ranges"][1]["start"] = json!("2026-03-08T06:00:00Z"),
            "duplicate_key" => bucketing["ranges"][1]["key"] = json!("before-review"),
            "missing_key_collision" => bucketing["missing_value_bucket_key"] = json!("review"),
            "empty_ranges" => bucketing["ranges"] = json!([]),
            _ => unreachable!(),
        }
        let soup = MockSoup::succeeding();
        let calls = soup.grouped_calls.clone();
        let router = mock_router_with(
            soup,
            MockEmailLinkResult {
                get_link_result: Arc::new(|| Ok(None)),
            },
        );
        let request = authenticated_request()
            .uri("/soup/ast/grouped")
            .method(Method::POST)
            .header("content-type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_vec(&json!({
                    "mode": "initial", "group_by": group_by
                }))
                .unwrap(),
            ))
            .unwrap();
        let (status, _) = send_json(router, request).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{invalid}");
        assert!(calls.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn due_date_group_sort_dispatches_to_the_task_service() {
    let soup = MockSoup::succeeding();
    let calls = soup.grouped_calls.clone();
    let router = mock_router_with(
        soup,
        MockEmailLinkResult {
            get_link_result: Arc::new(|| Ok(None)),
        },
    );
    let request = authenticated_request()
        .uri("/soup/ast/grouped")
        .method(Method::POST)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({
                "mode": "initial",
                "group_by": "entity_type",
                "sort_method": "due_date_latest",
                "per_group_limit": 25
            }))
            .unwrap(),
        ))
        .unwrap();
    let (status, _) = send_json(router, request).await;
    assert_eq!(status, StatusCode::OK);
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert!(matches!(
        calls[0].1,
        crate::domain::models::GroupedSortMethod::DueDate(DueDateSort::Latest)
    ));
}

#[tokio::test]
async fn changed_date_range_context_cannot_restart_a_group_continuation() {
    use crate::domain::models::due_date::GroupedDueDateContext;
    use crate::inbound::axum_router::ApiGroupByField;
    let original = date_range_grouping();
    let field: ApiGroupByField = serde_json::from_value(original.clone()).unwrap();
    let cursor = models_pagination::Base64Str::encode_json(CursorWithValAndFilter {
        id: Uuid::from_u128(1),
        limit: 25,
        val: CursorVal {
            sort_type: SimpleSortMethod::UpdatedAt,
            last_val: "2026-03-08T12:00:00Z".parse().unwrap(),
        },
        filter: GroupedDueDateContext {
            filters: EntityFilterAst::default(),
            grouping: models_grouping::GroupingConfig {
                field: field.into(),
                group_key: Some("review".to_owned()),
                per_group_limit: Some(25),
            },
        },
    })
    .type_erase()
    .replace('+', "%2B")
    .replace('/', "%2F")
    .replace('=', "%3D");
    for change in ["range", "property", "missing_key", "group_key"] {
        let mut group_by = original.clone();
        let mut group_key = "review";
        match change {
            "range" => {
                group_by["property"]["bucketing"]["ranges"][0]["end"] =
                    json!("2026-03-08T06:00:00Z");
                group_by["property"]["bucketing"]["ranges"][1]["start"] =
                    json!("2026-03-08T06:00:00Z");
            }
            "property" => {
                group_by["property"]["property_definition_id"] =
                    json!("00000000-0000-0000-0000-000000000013")
            }
            "missing_key" => {
                group_by["property"]["bucketing"]["missing_value_bucket_key"] = json!("unset")
            }
            "group_key" => group_key = "after-review",
            _ => unreachable!(),
        }
        let soup = MockSoup::succeeding();
        let calls = soup.grouped_calls.clone();
        let router = mock_router_with(
            soup,
            MockEmailLinkResult {
                get_link_result: Arc::new(|| Ok(None)),
            },
        );
        let request = authenticated_request()
            .uri(format!("/soup/ast/grouped?cursor={cursor}"))
            .method(Method::POST)
            .header("content-type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_vec(&json!({
                    "mode": "group_page", "group_key": group_key, "group_by": group_by
                }))
                .unwrap(),
            ))
            .unwrap();
        let (status, _) = send_json(router, request).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{change}");
        assert!(calls.lock().unwrap().is_empty());
    }
}
