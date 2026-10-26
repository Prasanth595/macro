use super::*;
use crate::domain::models::property_dates::PropertyDateContext;
use models_grouping::{
    CandidateCursor, CandidateDirection, CandidateIdentity, CandidateQuery, CandidateSortValue,
};

#[tokio::test]
async fn due_date_sort_markers_select_the_due_date_query() {
    for sort_method in ["property_date_earliest", "property_date_latest"] {
        let soup = MockSoup::succeeding();
        let calls = soup.property_date_calls.clone();
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
                serde_json::to_vec(&json!({ "sort_method": sort_method, "sort_property_definition_id": Uuid::from_u128(18) })).unwrap(),
            ))
            .unwrap();

        let (status, _) = send_json(router, request).await;
        assert_eq!(status, StatusCode::OK);
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(
            calls[0].selection.date_property_id,
            Some(Uuid::from_u128(18))
        );
    }
}

#[tokio::test]
async fn null_due_date_cursor_does_not_fall_back_to_an_initial_timestamp_query() {
    for direction in [
        CandidateDirection::Ascending,
        CandidateDirection::Descending,
    ] {
        let soup = MockSoup::succeeding();
        let calls = soup.property_date_calls.clone();
        let router = mock_router_with(
            soup,
            MockEmailLinkResult {
                get_link_result: Arc::new(|| Ok(None)),
            },
        );
        let cursor = models_pagination::Base64Str::encode_json(PropertyDateContext {
            version: 1,
            sources: vec![crate::domain::models::property_dates::PropertyDateSource::Soup],
            email_preview_view: PreviewView::StandardLabel(PreviewViewStandardLabel::All),
            selection: CandidateQuery {
                date_property_id: Some(Uuid::from_u128(18)),
                timestamp_sort: None,
                direction,
                grouping: None,
                limit: 20,
                cursor: Some(CandidateCursor {
                    identity: CandidateIdentity {
                        id: Uuid::from_u128(1).to_string(),
                        entity_type: models_grouping::PropertyEntityType::Task,
                    },
                    sort_value: CandidateSortValue(None),
                }),
            },
            filters: EntityFilterAst::default(),
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

        let (status, _) = send_json(router.clone(), request).await;
        assert_eq!(status, StatusCode::OK);
        let changed_view = authenticated_request()
            .uri(format!("/soup?cursor={cursor}"))
            .method(Method::POST)
            .header("content-type", "application/json")
            .body(axum::body::Body::from(r#"{"emailView":"inbox"}"#))
            .unwrap();
        let (status, _) = send_json(router, changed_view).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert!(
            calls[0]
                .selection
                .cursor
                .as_ref()
                .unwrap()
                .sort_value
                .0
                .is_none()
        );
        assert_eq!(calls[0].selection.direction, direction);
        assert_eq!(
            calls[0].email_preview_view,
            PreviewView::StandardLabel(PreviewViewStandardLabel::All)
        );
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
    let calls = soup.property_date_calls.clone();
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
    assert_eq!(
        calls[0]
            .selection
            .grouping
            .as_ref()
            .unwrap()
            .per_group_limit,
        Some(25)
    );
    let (property, ranges) = calls[0]
        .selection
        .grouping
        .as_ref()
        .unwrap()
        .field
        .date_ranges()
        .unwrap();
    assert_eq!(property, Uuid::from_u128(18));
    assert_eq!(ranges.missing_value_bucket_key, "no-review-date");
    assert_eq!(ranges.ranges[1].key, "review");
    assert_eq!(
        ranges.ranges[1].end.unwrap() - ranges.ranges[1].start.unwrap(),
        chrono::Duration::hours(23)
    );
    assert!(matches!(
        calls[0].selection.timestamp_sort,
        Some(SimpleSortMethod::UpdatedAt)
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
        let calls = soup.property_date_calls.clone();
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
async fn property_date_group_sort_dispatches_to_the_shared_service() {
    let soup = MockSoup::succeeding();
    let calls = soup.property_date_calls.clone();
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
                "sort_method": "property_date_latest",
                "sort_property_definition_id": Uuid::from_u128(18),
                "per_group_limit": 25
            }))
            .unwrap(),
        ))
        .unwrap();
    let (status, _) = send_json(router, request).await;
    assert_eq!(status, StatusCode::OK);
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(
        calls[0].selection.date_property_id,
        Some(Uuid::from_u128(18))
    );
    assert_eq!(calls[0].selection.direction, CandidateDirection::Descending);
}

#[tokio::test]
async fn changed_date_range_context_cannot_restart_a_group_continuation() {
    use crate::inbound::axum_router::ApiGroupByField;
    let original = date_range_grouping();
    let field: ApiGroupByField = serde_json::from_value(original.clone()).unwrap();
    let cursor = models_pagination::Base64Str::encode_json(PropertyDateContext {
        version: 1,
        sources: vec![crate::domain::models::property_dates::PropertyDateSource::Soup],
        email_preview_view: Default::default(),
        selection: CandidateQuery {
            date_property_id: None,
            timestamp_sort: Some(SimpleSortMethod::UpdatedAt),
            direction: CandidateDirection::Descending,
            limit: 25,
            cursor: Some(CandidateCursor {
                identity: CandidateIdentity {
                    id: Uuid::from_u128(1).to_string(),
                    entity_type: models_grouping::PropertyEntityType::Document,
                },
                sort_value: CandidateSortValue(Some("2026-03-08T12:00:00Z".parse().unwrap())),
            }),
            grouping: Some(models_grouping::GroupingConfig {
                field: field.into(),
                group_key: Some("review".into()),
                per_group_limit: Some(25),
            }),
        },
        filters: EntityFilterAst::default(),
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
        let calls = soup.property_date_calls.clone();
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

#[tokio::test]
async fn grouped_property_cursor_routes_without_repeating_the_sort() {
    let context = PropertyDateContext {
        version: 1,
        sources: vec![crate::domain::models::property_dates::PropertyDateSource::Soup],
        email_preview_view: Default::default(),
        selection: CandidateQuery {
            date_property_id: Some(Uuid::from_u128(18)),
            timestamp_sort: None,
            direction: CandidateDirection::Ascending,
            limit: 25,
            cursor: Some(CandidateCursor {
                identity: CandidateIdentity {
                    id: Uuid::from_u128(1).to_string(),
                    entity_type: models_grouping::PropertyEntityType::Task,
                },
                sort_value: CandidateSortValue(None),
            }),
            grouping: Some(
                models_grouping::GroupingConfig::new(models_grouping::GroupByField::EntityType)
                    .with_group_key("document")
                    .with_limit(25),
            ),
        },
        filters: EntityFilterAst::default(),
    };
    let cursor = models_pagination::Base64Str::encode_json(context)
        .type_erase()
        .replace('+', "%2B")
        .replace('/', "%2F")
        .replace('=', "%3D");
    let soup = MockSoup::succeeding();
    let calls = soup.property_date_calls.clone();
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
                "mode": "group_page", "group_by": "entity_type", "group_key": "document"
            }))
            .unwrap(),
        ))
        .unwrap();
    let (status, body) = send_json(router, request).await;
    assert_eq!(status, StatusCode::OK, "{body:?}");
    assert_eq!(body["group"]["key"], "document");
    assert_eq!(body["group"]["total_count"], 0);
    assert_eq!(calls.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn property_date_continuations_compare_normalized_limits() {
    for requested_limit in [0_u16, 1_000] {
        let limit = requested_limit.clamp(1, 500);
        for grouped in [false, true] {
            let context = PropertyDateContext {
                version: 1,
                sources: vec![crate::domain::models::property_dates::PropertyDateSource::Soup],
                email_preview_view: Default::default(),
                selection: CandidateQuery {
                    date_property_id: Some(Uuid::from_u128(18)),
                    timestamp_sort: None,
                    direction: CandidateDirection::Ascending,
                    limit,
                    cursor: Some(CandidateCursor {
                        identity: CandidateIdentity {
                            id: Uuid::from_u128(1).to_string(),
                            entity_type: models_grouping::PropertyEntityType::Task,
                        },
                        sort_value: CandidateSortValue(None),
                    }),
                    grouping: grouped.then(|| {
                        models_grouping::GroupingConfig::new(
                            models_grouping::GroupByField::EntityType,
                        )
                        .with_group_key("document")
                        .with_limit(u32::from(limit))
                    }),
                },
                filters: EntityFilterAst::default(),
            };
            let cursor = models_pagination::Base64Str::encode_json(context)
                .type_erase()
                .replace('+', "%2B")
                .replace('/', "%2F")
                .replace('=', "%3D");
            let soup = MockSoup::succeeding();
            let calls = soup.property_date_calls.clone();
            let router = mock_router_with(
                soup,
                MockEmailLinkResult {
                    get_link_result: Arc::new(|| Ok(None)),
                },
            );
            let path = if grouped {
                "/soup/ast/grouped"
            } else {
                "/soup"
            };
            let body = if grouped {
                json!({"mode":"group_page", "group_by":"entity_type",
                    "group_key":"document", "limit":requested_limit})
            } else {
                json!({"limit":requested_limit})
            };
            let request = authenticated_request()
                .uri(format!("{path}?cursor={cursor}"))
                .method(Method::POST)
                .header("content-type", "application/json")
                .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
                .unwrap();
            let (status, body) = send_json(router, request).await;
            assert_eq!(status, StatusCode::OK, "{body:?}");
            assert_eq!(calls.lock().unwrap()[0].selection.limit, limit);
        }
    }
}

#[test]
fn property_date_cursors_reject_version_and_source_changes() {
    let context = PropertyDateContext::initial(
        models_grouping::CandidateQuery {
            date_property_id: Some(Uuid::from_u128(17)),
            timestamp_sort: None,
            direction: models_grouping::CandidateDirection::Ascending,
            grouping: None,
            cursor: None,
            limit: 2,
        },
        EntityFilterAst::default(),
        Default::default(),
    )
    .unwrap();
    let cursor = context.next_cursor(
        CandidateCursor {
            identity: CandidateIdentity {
                id: Uuid::from_u128(1).to_string(),
                entity_type: models_grouping::PropertyEntityType::Document,
            },
            sort_value: CandidateSortValue(None),
        },
        None,
    );
    let decoded = PropertyDateContext::decode(&cursor).unwrap();
    assert_eq!(decoded.version, 1);
    assert_eq!(
        decoded.sources,
        [crate::domain::models::property_dates::PropertyDateSource::Soup]
    );
    for (field, value) in [
        ("version", json!(2)),
        ("version", serde_json::Value::Null),
        ("sources", json!([])),
        ("sources", json!(["soup", "soup"])),
        ("sources", json!(["soup", "email"])),
        ("sources", serde_json::Value::Null),
    ] {
        let mut changed = serde_json::to_value(&decoded).unwrap();
        changed[field] = value;
        let cursor = models_pagination::Base64Str::encode_json(changed).type_erase();
        assert!(PropertyDateContext::try_decode(&cursor).is_err());
    }
}

#[test]
fn property_group_memberships_serialize_raw_uuids() {
    let id = Uuid::from_u128(17);
    let group = crate::domain::models::grouping::GroupMeta {
        key: "today".into(),
        label: "Today".into(),
        display_order: None,
        total_count: 1,
        next_cursor: None,
        item_ids: vec![CandidateIdentity {
            entity_type: models_grouping::PropertyEntityType::Task,
            id: id.to_string(),
        }],
    };
    let group = crate::inbound::axum_router::ApiGroupMeta::try_from(group).unwrap();
    assert_eq!(
        serde_json::to_value(group).unwrap()["item_ids"],
        json!([id])
    );
}
