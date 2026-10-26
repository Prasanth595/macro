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
        sort_property_definition_id: None,
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
        sort_property_definition_id: None,
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
        sort_property_definition_id: None,
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
        sort_property_definition_id: None,
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
        sort_property_definition_id: None,
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
        sort_property_definition_id: None,
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
fn date_range_grouping_preserves_custom_keys_and_timestamp_sorting() {
    let request = GroupedSoupInput::Initial(Box::new(GroupedSoupInitialInput {
        sort_property_definition_id: None,
        group_by: date_range_input(),
        limit: Some(25),
        sort_method: Some(GraphqlSimpleSortMethod::UpdatedAt),
        filters: None,
    }))
    .into_read_request(test_macro_user_id())
    .unwrap();
    let GroupedReadRequest::PropertyDate(context) = request else {
        panic!("expected property-date grouping");
    };
    assert_eq!(context.selection.limit, 25);
    assert!(matches!(
        context.selection.timestamp_sort,
        Some(SimpleSortMethod::UpdatedAt)
    ));
    let (property, ranges) = context
        .selection
        .grouping
        .as_ref()
        .unwrap()
        .field
        .date_ranges()
        .unwrap();
    assert_eq!(property, Uuid::from_u128(18));
    assert_eq!(ranges.missing_value_bucket_key, "no-review-date");
    assert_eq!(ranges.ranges[1].key, "review-window");
    assert_eq!(
        ranges.ranges[1].end.unwrap() - ranges.ranges[1].start.unwrap(),
        chrono::Duration::hours(23)
    );
}

#[test]
fn generic_date_sort_keeps_the_selected_definition_through_a_null_cursor() {
    use models_grouping::{CandidateCursor, CandidateIdentity, CandidateSortValue};
    let definition = Uuid::from_u128(18);
    let input = SoupInput::Initial(Box::new(SoupInitialInput {
        limit: Some(10),
        expand: Some(false),
        sort_method: Some(GraphqlSimpleSortMethod::PropertyDateLatest),
        sort_property_definition_id: Some(ID::from(definition.to_string())),
        email_view: Some(GraphqlEmailView::All),
        filters: None,
        sort_direction: None,
    }));
    let SoupReadRequest::PropertyDate { context, soup_type } = input
        .into_read_request(test_macro_user_id(), vec![])
        .unwrap()
    else {
        panic!("generic sort used legacy routing");
    };
    assert_eq!(context.selection.date_property_id, Some(definition));
    assert!(matches!(soup_type, SoupType::UnExpanded));
    let cursor = context.next_cursor(
        CandidateCursor {
            identity: CandidateIdentity {
                id: Uuid::from_u128(1).to_string(),
                entity_type: "CHANNEL".into(),
            },
            sort_value: CandidateSortValue(None),
        },
        None,
    );
    let continuation = SoupInput::Continuation(SoupContinuationInput {
        cursor: cursor.clone(),
        expand: Some(false),
        email_view: None,
        sort_direction: None,
    });
    let SoupReadRequest::PropertyDate { context, .. } = continuation
        .into_read_request(test_macro_user_id(), vec![])
        .unwrap()
    else {
        panic!("generic cursor used legacy routing");
    };
    assert_eq!(context.selection.date_property_id, Some(definition));
    assert_eq!(context.email_preview_view.to_string(), "all");
    let changed_view = SoupInput::Continuation(SoupContinuationInput {
        cursor,
        expand: None,
        email_view: Some(GraphqlEmailView::Inbox),
        sort_direction: None,
    });
    assert!(
        changed_view
            .into_read_request(test_macro_user_id(), vec![])
            .is_err()
    );
    assert_eq!(
        context.selection.cursor.unwrap().identity.entity_type,
        "CHANNEL"
    );
}
