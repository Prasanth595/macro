use macro_user_id::{cowlike::CowLike, user_id::MacroUserIdStr};
use models_pagination::{CursorVal, Query};

use super::date_ranges::{GraphqlDateBucketRange, GraphqlPropertyBucketingType};
use super::*;

fn test_macro_user_id() -> MacroUserIdStr<'static> {
    MacroUserIdStr::parse_from_str("macro|user@example.com")
        .unwrap()
        .into_owned()
}

#[test]
fn maps_email_view_to_soup_request() {
    let request = SoupInput::Initial(Box::new(SoupInitialInput {
        limit: None,
        expand: None,
        sort_method: None,
        email_view: Some(GraphqlEmailView::Sent),
        filters: None,
        sort_direction: None,
    }))
    .into_request(test_macro_user_id(), vec![])
    .unwrap();

    assert_eq!(request.email_preview_view.to_string(), "sent");
}

#[test]
fn defaults_email_view_to_inbox() {
    let request = SoupInput::Initial(Box::new(SoupInitialInput {
        limit: None,
        expand: None,
        sort_method: None,
        email_view: None,
        filters: None,
        sort_direction: None,
    }))
    .into_request(test_macro_user_id(), vec![])
    .unwrap();

    assert_eq!(request.email_preview_view.to_string(), "inbox");
}

#[test]
fn maps_soup_cursor_continuation() {
    let cursor = Base64Str::encode_json(CursorWithValAndFilter {
        id: uuid::Uuid::from_u128(1),
        limit: 25,
        val: CursorVal {
            sort_type: SimpleSortMethod::UpdatedAt,
            last_val: chrono::DateTime::default(),
        },
        filter: item_filters::ast::EntityFilterAst::default(),
    });
    let request = SoupInput::Continuation(SoupContinuationInput {
        cursor: cursor.to_string(),
        expand: Some(false),
        email_view: Some(GraphqlEmailView::Sent),
        sort_direction: None,
    })
    .into_request(test_macro_user_id(), vec![])
    .unwrap();

    assert_eq!(request.limit, 25);
    assert!(matches!(request.cursor, SoupQuery::Simple(_)));
    assert_eq!(request.email_preview_view.to_string(), "sent");
    assert!(matches!(request.soup_type, SoupType::UnExpanded));
}

#[test]
fn maps_notified_at_to_notified_soup_request() {
    let request = SoupInput::Initial(Box::new(SoupInitialInput {
        limit: Some(500),
        expand: None,
        sort_method: Some(GraphqlSimpleSortMethod::NotifiedAt),
        email_view: None,
        filters: None,
        sort_direction: None,
    }))
    .into_request(test_macro_user_id(), vec![])
    .unwrap();

    assert_eq!(request.limit, 500);
    assert!(matches!(request.cursor, SoupQuery::Notified(_)));
}

#[test]
fn continues_a_notified_cursor_as_a_notified_request() {
    let cursor = Base64Str::encode_json(CursorWithValAndFilter {
        id: "00000000-0000-0000-0000-000000000001".to_owned(),
        limit: 500,
        val: CursorVal {
            sort_type: NotifiedAt,
            last_val: chrono::DateTime::default(),
        },
        filter: item_filters::ast::EntityFilterAst::default(),
    });
    let request = SoupInput::Continuation(SoupContinuationInput {
        cursor: cursor.to_string(),
        expand: None,
        email_view: None,
        sort_direction: None,
    })
    .into_request(test_macro_user_id(), vec![])
    .unwrap();

    assert_eq!(request.limit, 500);
    assert!(matches!(request.cursor, SoupQuery::Notified(_)));
}

#[test]
fn rejects_ascending_notified_at() {
    let result = SoupInput::Initial(Box::new(SoupInitialInput {
        limit: None,
        expand: None,
        sort_method: Some(GraphqlSimpleSortMethod::NotifiedAt),
        email_view: None,
        filters: None,
        sort_direction: Some(GraphqlSortDirection::Asc),
    }))
    .into_request(test_macro_user_id(), vec![]);

    assert!(result.is_err());
}

#[test]
fn rejects_grouped_notified_at() {
    let result = GroupedSoupInput::Initial(Box::new(GroupedSoupInitialInput {
        group_by: GraphqlGroupByInput {
            field: GraphqlGroupByField::EntityType,
            property_definition_id: None,
            entity_type: None,
            bucketing: None,
        },
        limit: None,
        sort_method: Some(GraphqlSimpleSortMethod::NotifiedAt),
        filters: None,
    }))
    .into_request(test_macro_user_id());

    assert!(result.is_err());
}

#[test]
fn maps_initial_grouped_input() {
    let request = GroupedSoupInput::Initial(Box::new(GroupedSoupInitialInput {
        group_by: GraphqlGroupByInput {
            field: GraphqlGroupByField::EntityType,
            property_definition_id: None,
            entity_type: None,
            bucketing: None,
        },
        limit: Some(42),
        sort_method: Some(GraphqlSimpleSortMethod::UpdatedAt),
        filters: None,
    }))
    .into_request(test_macro_user_id())
    .unwrap();

    let GroupedSortQuery::Timestamp(request) = request else {
        panic!("expected a timestamp grouped request");
    };
    assert_eq!(request.limit, 42);
    assert!(request.grouping.group_key.is_none());
    assert!(matches!(
        request.cursor,
        Query::Sort(SimpleSortMethod::UpdatedAt, _)
    ));
}

#[test]
fn maps_grouped_cursor_continuation() {
    let cursor = Base64Str::encode_json(CursorWithValAndFilter {
        id: uuid::Uuid::from_u128(1),
        limit: 25,
        val: CursorVal {
            sort_type: SimpleSortMethod::UpdatedAt,
            last_val: chrono::DateTime::default(),
        },
        filter: item_filters::ast::EntityFilterAst::default(),
    });
    let request = GroupedSoupInput::Continuation(GroupedSoupContinuationInput {
        group_by: GraphqlGroupByInput {
            field: GraphqlGroupByField::EntityType,
            property_definition_id: None,
            entity_type: None,
            bucketing: None,
        },
        group_key: "document".to_owned(),
        cursor: cursor.to_string(),
    })
    .into_request(test_macro_user_id())
    .unwrap();

    let GroupedSortQuery::Timestamp(request) = request else {
        panic!("expected a timestamp grouped continuation");
    };
    assert_eq!(request.limit, 25);
    assert_eq!(request.grouping.group_key.as_deref(), Some("document"));
    assert!(matches!(request.cursor, Query::Cursor(_)));
}

fn date_range_input() -> GraphqlGroupByInput {
    GraphqlGroupByInput {
        field: GraphqlGroupByField::Property,
        property_definition_id: Some(ID::from("00000000-0000-0000-0000-000000000012")),
        entity_type: Some(GraphqlPropertyEntityType::Document),
        bucketing: Some(GraphqlPropertyBucketing {
            kind: GraphqlPropertyBucketingType::DateRanges,
            ranges: vec![
                GraphqlDateBucketRange {
                    key: "before-review".to_owned(),
                    start: None,
                    end: Some("2026-03-08T05:00:00Z".to_owned()),
                },
                GraphqlDateBucketRange {
                    key: "review-window".to_owned(),
                    start: Some("2026-03-08T05:00:00Z".to_owned()),
                    end: Some("2026-03-09T04:00:00Z".to_owned()),
                },
                GraphqlDateBucketRange {
                    key: "after-review".to_owned(),
                    start: Some("2026-03-09T04:00:00Z".to_owned()),
                    end: None,
                },
            ],
            missing_value_bucket_key: "no-review-date".to_owned(),
        }),
    }
}

#[test]
fn date_ranges_require_a_selected_property() {
    for field in [
        GraphqlGroupByField::Date,
        GraphqlGroupByField::EntityType,
        GraphqlGroupByField::Project,
    ] {
        let mut input = date_range_input();
        input.field = field;
        input.property_definition_id = None;
        input.entity_type = None;
        assert!(input.into_group_by_field().is_err());
    }

    let mut input = date_range_input();
    input.property_definition_id = None;
    assert!(input.into_group_by_field().is_err());
}

#[test]
fn invalid_date_range_timestamps_are_rejected() {
    let mut input = date_range_input();
    input.bucketing.as_mut().unwrap().ranges[0].end = Some("not-a-timestamp".to_owned());
    assert!(input.into_group_by_field().is_err());
}

#[test]
fn due_date_sorts_and_null_continuations_keep_the_due_date_query_kind() {
    for (sort_method, sort_type) in [
        (
            GraphqlSimpleSortMethod::DueDateEarliest,
            DueDateSort::Earliest,
        ),
        (GraphqlSimpleSortMethod::DueDateLatest, DueDateSort::Latest),
    ] {
        let initial = SoupInput::Initial(Box::new(SoupInitialInput {
            limit: Some(25),
            expand: None,
            sort_method: Some(sort_method),
            email_view: None,
            filters: None,
            sort_direction: None,
        }))
        .into_request(test_macro_user_id(), vec![])
        .unwrap();
        assert!(matches!(initial.cursor, SoupQuery::DueDate(_)));

        let cursor = Base64Str::encode_json(CursorWithValAndFilter {
            id: Uuid::from_u128(1),
            limit: 25,
            val: CursorVal {
                sort_type,
                last_val: None,
            },
            filter: EntityFilterAst::default(),
        });
        let continuation = SoupInput::Continuation(SoupContinuationInput {
            cursor: cursor.to_string(),
            expand: None,
            email_view: None,
            sort_direction: None,
        })
        .into_request(test_macro_user_id(), vec![])
        .unwrap();
        assert_eq!(continuation.limit, 25);
        assert!(matches!(continuation.cursor, SoupQuery::DueDate(_)));
    }
}

#[test]
fn date_range_grouping_preserves_custom_keys_and_timestamp_sorting() {
    let request = GroupedSoupInput::Initial(Box::new(GroupedSoupInitialInput {
        group_by: date_range_input(),
        limit: Some(25),
        sort_method: Some(GraphqlSimpleSortMethod::UpdatedAt),
        filters: None,
    }))
    .into_request(test_macro_user_id())
    .unwrap();
    let GroupedSortQuery::Timestamp(request) = request else {
        panic!("expected timestamp sorting within date-range groups");
    };
    assert_eq!(request.limit, 25);
    assert!(matches!(
        request.cursor,
        Query::Sort(SimpleSortMethod::UpdatedAt, _)
    ));
    let (property, ranges) = request.grouping.field.date_ranges().unwrap();
    assert_eq!(property, Uuid::from_u128(18));
    assert_eq!(ranges.missing_value_bucket_key, "no-review-date");
    assert_eq!(ranges.ranges[1].key, "review-window");
    assert_eq!(
        ranges.ranges[1].end.unwrap() - ranges.ranges[1].start.unwrap(),
        chrono::Duration::hours(23)
    );
}

#[test]
fn due_date_grouped_continuation_retains_null_cursor_and_rejects_changed_group() {
    use soup::domain::models::due_date::GroupedDueDateContext;
    let context = GroupedDueDateContext {
        filters: EntityFilterAst::default(),
        grouping: GroupingConfig {
            field: GroupByField::EntityType,
            group_key: Some("document".to_owned()),
            per_group_limit: Some(25),
        },
    };
    let cursor = Base64Str::encode_json(CursorWithValAndFilter {
        id: Uuid::from_u128(1),
        limit: 25,
        val: CursorVal {
            sort_type: DueDateSort::Latest,
            last_val: None,
        },
        filter: context,
    })
    .type_erase();
    let request = GroupedSoupInput::Continuation(GroupedSoupContinuationInput {
        group_by: GraphqlGroupByInput {
            field: GraphqlGroupByField::EntityType,
            property_definition_id: None,
            entity_type: None,
            bucketing: None,
        },
        group_key: "document".to_owned(),
        cursor: cursor.clone(),
    })
    .into_request(test_macro_user_id())
    .unwrap();
    let GroupedSortQuery::DueDate(request) = request else {
        panic!("expected a nullable due-date continuation");
    };
    assert_eq!(request.limit, 25);
    assert_eq!(request.grouping.per_group_limit, Some(25));
    assert!(matches!(request.cursor, Query::Cursor(cursor) if cursor.val.last_val.is_none()));
    assert!(
        GroupedSoupInput::Continuation(GroupedSoupContinuationInput {
            group_by: GraphqlGroupByInput {
                field: GraphqlGroupByField::EntityType,
                property_definition_id: None,
                entity_type: None,
                bucketing: None,
            },
            group_key: "project".to_owned(),
            cursor,
        })
        .into_request(test_macro_user_id())
        .is_err()
    );
}
