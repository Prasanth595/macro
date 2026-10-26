use super::*;
use chrono::Duration;
use models_grouping::{GroupByField, GroupingConfig};
use models_pagination::{Base64Str, Cursor, CursorVal};

#[test]
fn contextual_date_range_cursor_freezes_key_and_boundaries() {
    let today = DateTime::<Utc>::UNIX_EPOCH + Duration::days(20_000);
    let original = GroupingConfig::new(GroupByField::Property {
        property_definition_id: system_properties::SystemPropertyKey::DUE_DATE_UUID,
        entity_type: Some("TASK".into()),
        bucketing: Some(models_grouping::PropertyBucketing::DateRanges(
            models_grouping::PropertyDateRanges {
                ranges: vec![
                    models_grouping::PropertyDateRange {
                        key: "overdue".into(),
                        start: None,
                        end: Some(today),
                    },
                    models_grouping::PropertyDateRange {
                        key: "today".into(),
                        start: Some(today),
                        end: Some(today + Duration::days(1)),
                    },
                    models_grouping::PropertyDateRange {
                        key: "tomorrow".into(),
                        start: Some(today + Duration::days(1)),
                        end: Some(today + Duration::days(2)),
                    },
                    models_grouping::PropertyDateRange {
                        key: "next_7_days".into(),
                        start: Some(today + Duration::days(2)),
                        end: Some(today + Duration::days(8)),
                    },
                    models_grouping::PropertyDateRange {
                        key: "later".into(),
                        start: Some(today + Duration::days(8)),
                        end: None,
                    },
                ],
                missing_value_bucket_key: "no_due_date".into(),
            },
        )),
    })
    .with_group_key("today");
    let cursor = Cursor {
        id: Uuid::from_u128(12),
        limit: 2,
        val: CursorVal {
            sort_type: DueDateSort::Earliest,
            last_val: None,
        },
        filter: GroupedDueDateContext {
            filters: EntityFilterAst::default(),
            grouping: original.clone(),
        },
    };
    let encoded = Base64Str::encode_json(cursor).type_erase();
    let cursor = Base64Str::<GroupedDueDateCursor>::new_from_string(encoded)
        .decode_json()
        .unwrap();
    let user = MacroUserIdStr::parse_from_str("macro|user@example.com").unwrap();
    let mut conflicting = original.clone();
    conflicting.field = GroupByField::Property {
        property_definition_id: system_properties::SystemPropertyKey::DUE_DATE_UUID,
        entity_type: Some("TASK".into()),
        bucketing: Some(models_grouping::PropertyBucketing::DateRanges(
            models_grouping::PropertyDateRanges {
                ranges: vec![
                    models_grouping::PropertyDateRange {
                        key: "overdue".into(),
                        start: None,
                        end: Some(today + Duration::days(1)),
                    },
                    models_grouping::PropertyDateRange {
                        key: "today".into(),
                        start: Some(today + Duration::days(1)),
                        end: Some(today + Duration::days(2)),
                    },
                    models_grouping::PropertyDateRange {
                        key: "tomorrow".into(),
                        start: Some(today + Duration::days(2)),
                        end: Some(today + Duration::days(3)),
                    },
                    models_grouping::PropertyDateRange {
                        key: "next_7_days".into(),
                        start: Some(today + Duration::days(3)),
                        end: Some(today + Duration::days(9)),
                    },
                    models_grouping::PropertyDateRange {
                        key: "later".into(),
                        start: Some(today + Duration::days(9)),
                        end: None,
                    },
                ],
                missing_value_bucket_key: "no_due_date".into(),
            },
        )),
    };
    assert!(
        GroupedDueDateRequest::continue_from(user.clone(), cursor.clone(), Some(conflicting))
            .is_err()
    );
    let req = GroupedDueDateRequest::continue_from(user, cursor, None).unwrap();
    assert_eq!(req.grouping.field, original.field);
    assert_eq!(req.grouping.group_key.as_deref(), Some("today"));
    assert!(
        matches!(req.cursor, Query::Cursor(ref c) if c.val.last_val.is_none() && c.id == Uuid::from_u128(12))
    );
}

#[test]
fn invalid_boundaries_and_missing_group_key_fail() {
    let today = DateTime::<Utc>::UNIX_EPOCH;
    let grouping = GroupingConfig::new(GroupByField::Property {
        property_definition_id: system_properties::SystemPropertyKey::DUE_DATE_UUID,
        entity_type: Some("TASK".into()),
        bucketing: Some(models_grouping::PropertyBucketing::DateRanges(
            models_grouping::PropertyDateRanges {
                ranges: vec![
                    models_grouping::PropertyDateRange {
                        key: "overdue".into(),
                        start: None,
                        end: Some(today),
                    },
                    models_grouping::PropertyDateRange {
                        key: "today".into(),
                        start: Some(today),
                        end: Some(today),
                    },
                    models_grouping::PropertyDateRange {
                        key: "tomorrow".into(),
                        start: Some(today),
                        end: Some(today),
                    },
                    models_grouping::PropertyDateRange {
                        key: "next_7_days".into(),
                        start: Some(today),
                        end: Some(today),
                    },
                    models_grouping::PropertyDateRange {
                        key: "later".into(),
                        start: Some(today),
                        end: None,
                    },
                ],
                missing_value_bucket_key: "no_due_date".into(),
            },
        )),
    });
    let user = MacroUserIdStr::parse_from_str("macro|user@example.com").unwrap();
    assert!(
        GroupedDueDateRequest::initial(
            user.clone(),
            10,
            DueDateSort::Latest,
            EntityFilterAst::default(),
            grouping
        )
        .is_err()
    );
    let cursor = Cursor {
        id: Uuid::from_u128(1),
        limit: 10,
        val: CursorVal {
            sort_type: DueDateSort::Latest,
            last_val: None,
        },
        filter: GroupedDueDateContext {
            filters: EntityFilterAst::default(),
            grouping: GroupingConfig::new(GroupByField::EntityType),
        },
    };
    assert!(GroupedDueDateRequest::continue_from(user, cursor, None).is_err());
}
