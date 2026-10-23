use super::*;
use chrono::{DateTime, Duration, Utc};
use models_grouping::{CandidateCursor, CandidateIdentity, CandidateSortValue};
use uuid::Uuid;

const QUERY: CandidateQuery = CandidateQuery {
    date_property_id: Some(Uuid::from_u128(17)),
    timestamp_sort: None,
    direction: CandidateDirection::Ascending,
    grouping: None,
    cursor: None,
    limit: 2,
};

#[test]
fn merged_counts_include_exhausted_sources() {
    let query = CandidateQuery {
        cursor: Some(CandidateCursor {
            sort_value: CandidateSortValue(Some(DateTime::<Utc>::UNIX_EPOCH)),
            identity: CandidateIdentity {
                id: "0".into(),
                entity_type: "TASK".into(),
            },
        }),
        ..QUERY
    };
    let result = merge_candidate_pages(
        [
            CandidatePage {
                candidates: vec![GroupedCandidate {
                    identity: CandidateIdentity {
                        id: "2".into(),
                        entity_type: "TASK".into(),
                    },
                    sort_value: CandidateSortValue(Some(DateTime::<Utc>::UNIX_EPOCH)),
                    group_key: "current".into(),
                }],
                groups: vec![CandidateGroupStats {
                    group_key: "current".into(),
                    total_count: 4,
                    before_or_at_cursor_count: 3,
                    has_more: false,
                }],
            },
            CandidatePage {
                candidates: vec![
                    GroupedCandidate {
                        identity: CandidateIdentity {
                            id: "1".into(),
                            entity_type: "THREAD".into(),
                        },
                        sort_value: CandidateSortValue(Some(DateTime::<Utc>::UNIX_EPOCH)),
                        group_key: "current".into(),
                    },
                    GroupedCandidate {
                        identity: CandidateIdentity {
                            id: "3".into(),
                            entity_type: "THREAD".into(),
                        },
                        sort_value: CandidateSortValue(None),
                        group_key: "current".into(),
                    },
                ],
                groups: vec![CandidateGroupStats {
                    group_key: "current".into(),
                    total_count: 3,
                    before_or_at_cursor_count: 1,
                    has_more: false,
                }],
            },
            CandidatePage {
                candidates: vec![],
                groups: vec![CandidateGroupStats {
                    group_key: "current".into(),
                    total_count: 5,
                    before_or_at_cursor_count: 5,
                    has_more: false,
                }],
            },
        ],
        &query,
    )
    .unwrap();
    assert_eq!(
        result
            .candidates
            .iter()
            .map(|row| row.identity.id.as_str())
            .collect::<Vec<_>>(),
        ["1", "2"]
    );
    assert_eq!(
        result.groups,
        vec![CandidateGroupStats {
            group_key: "current".into(),
            total_count: 12,
            before_or_at_cursor_count: 9,
            has_more: true,
        }]
    );
}

#[test]
fn final_page_retains_totals_without_an_extra_cursor() {
    let query = CandidateQuery {
        cursor: Some(CandidateCursor {
            sort_value: CandidateSortValue(Some(DateTime::<Utc>::UNIX_EPOCH)),
            identity: CandidateIdentity {
                id: "2".into(),
                entity_type: "TASK".into(),
            },
        }),
        ..QUERY
    };
    let result = merge_candidate_pages(
        [
            CandidatePage {
                candidates: vec![],
                groups: vec![CandidateGroupStats {
                    group_key: "current".into(),
                    total_count: 4,
                    before_or_at_cursor_count: 4,
                    has_more: false,
                }],
            },
            CandidatePage {
                candidates: vec![GroupedCandidate {
                    identity: CandidateIdentity {
                        id: "3".into(),
                        entity_type: "THREAD".into(),
                    },
                    sort_value: CandidateSortValue(None),
                    group_key: "current".into(),
                }],
                groups: vec![CandidateGroupStats {
                    group_key: "current".into(),
                    total_count: 3,
                    before_or_at_cursor_count: 2,
                    has_more: false,
                }],
            },
        ],
        &query,
    )
    .unwrap();
    assert_eq!(result.candidates.len(), 1);
    assert_eq!(
        result.groups,
        vec![CandidateGroupStats {
            group_key: "current".into(),
            total_count: 7,
            before_or_at_cursor_count: 6,
            has_more: false,
        }]
    );
}

#[test]
fn missing_dates_stay_last_and_identity_ties_ascend_in_both_directions() {
    let page = CandidatePage {
        candidates: vec![
            GroupedCandidate {
                identity: CandidateIdentity {
                    id: "0".into(),
                    entity_type: "TASK".into(),
                },
                sort_value: CandidateSortValue(None),
                group_key: "all".into(),
            },
            GroupedCandidate {
                identity: CandidateIdentity {
                    id: "2".into(),
                    entity_type: "TASK".into(),
                },
                sort_value: CandidateSortValue(Some(
                    DateTime::<Utc>::UNIX_EPOCH + Duration::days(1),
                )),
                group_key: "all".into(),
            },
            GroupedCandidate {
                identity: CandidateIdentity {
                    id: "1".into(),
                    entity_type: "THREAD".into(),
                },
                sort_value: CandidateSortValue(Some(DateTime::<Utc>::UNIX_EPOCH)),
                group_key: "all".into(),
            },
            GroupedCandidate {
                identity: CandidateIdentity {
                    id: "1".into(),
                    entity_type: "TASK".into(),
                },
                sort_value: CandidateSortValue(Some(DateTime::<Utc>::UNIX_EPOCH)),
                group_key: "all".into(),
            },
        ],
        groups: vec![CandidateGroupStats {
            group_key: "all".into(),
            total_count: 4,
            before_or_at_cursor_count: 0,
            has_more: false,
        }],
    };
    let query = CandidateQuery { limit: 4, ..QUERY };
    let ascending = merge_candidate_pages([page.clone()], &query).unwrap();
    assert_eq!(
        ascending
            .candidates
            .iter()
            .map(|row| (row.identity.id.as_str(), row.identity.entity_type.as_str()))
            .collect::<Vec<_>>(),
        [("1", "TASK"), ("1", "THREAD"), ("2", "TASK"), ("0", "TASK"),]
    );
    let descending = merge_candidate_pages(
        [page],
        &CandidateQuery {
            direction: CandidateDirection::Descending,
            ..query
        },
    )
    .unwrap();
    assert_eq!(
        descending
            .candidates
            .iter()
            .map(|row| (row.identity.id.as_str(), row.identity.entity_type.as_str()))
            .collect::<Vec<_>>(),
        [("2", "TASK"), ("1", "TASK"), ("1", "THREAD"), ("0", "TASK"),]
    );
}

#[test]
fn overlapping_sources_are_rejected_even_if_their_date_values_differ() {
    let page = CandidatePage {
        candidates: vec![GroupedCandidate {
            identity: CandidateIdentity {
                id: "1".into(),
                entity_type: "TASK".into(),
            },
            sort_value: CandidateSortValue(Some(DateTime::<Utc>::UNIX_EPOCH)),
            group_key: "current".into(),
        }],
        groups: vec![CandidateGroupStats {
            group_key: "current".into(),
            total_count: 1,
            before_or_at_cursor_count: 0,
            has_more: false,
        }],
    };
    let mut conflicting = page.clone();
    conflicting.candidates[0].sort_value = CandidateSortValue(None);
    assert_eq!(
        merge_candidate_pages([page, conflicting], &QUERY),
        Err(CandidateMergeError::OverlappingSources("current".into()))
    );
}

#[test]
fn an_entity_can_belong_to_distinct_groups() {
    let result = merge_candidate_pages(
        [CandidatePage {
            candidates: vec![
                GroupedCandidate {
                    identity: CandidateIdentity {
                        id: "1".into(),
                        entity_type: "TASK".into(),
                    },
                    sort_value: CandidateSortValue(None),
                    group_key: "first".into(),
                },
                GroupedCandidate {
                    identity: CandidateIdentity {
                        id: "1".into(),
                        entity_type: "TASK".into(),
                    },
                    sort_value: CandidateSortValue(None),
                    group_key: "second".into(),
                },
            ],
            groups: vec![
                CandidateGroupStats {
                    group_key: "first".into(),
                    total_count: 1,
                    before_or_at_cursor_count: 0,
                    has_more: false,
                },
                CandidateGroupStats {
                    group_key: "second".into(),
                    total_count: 1,
                    before_or_at_cursor_count: 0,
                    has_more: false,
                },
            ],
        }],
        &QUERY,
    )
    .unwrap();
    assert_eq!(result.groups.len(), 2);
    assert_eq!(result.candidates.len(), 2);
}

#[test]
fn missing_statistics_and_incomplete_source_pages_are_rejected() {
    assert_eq!(
        merge_candidate_pages(
            [CandidatePage {
                candidates: vec![],
                groups: vec![CandidateGroupStats {
                    group_key: "current".into(),
                    total_count: 3,
                    before_or_at_cursor_count: 0,
                    has_more: true,
                }],
            }],
            &QUERY
        ),
        Err(CandidateMergeError::InvalidStatistics("current".into()))
    );
    assert_eq!(
        merge_candidate_pages(
            [CandidatePage {
                candidates: vec![GroupedCandidate {
                    identity: CandidateIdentity {
                        id: "1".into(),
                        entity_type: "TASK".into()
                    },
                    sort_value: CandidateSortValue(None),
                    group_key: "absent".into(),
                }],
                groups: vec![],
            }],
            &QUERY
        ),
        Err(CandidateMergeError::MissingStatistics("absent".into()))
    );
}

#[test]
fn invalid_statistics_fail_closed() {
    for (total_count, before_or_at_cursor_count) in [(-1, 0), (1, -1), (1, 2)] {
        assert_eq!(
            merge_candidate_pages(
                [CandidatePage {
                    candidates: vec![],
                    groups: vec![CandidateGroupStats {
                        group_key: "current".into(),
                        total_count,
                        before_or_at_cursor_count,
                        has_more: false,
                    }],
                }],
                &QUERY
            ),
            Err(CandidateMergeError::InvalidStatistics("current".into()))
        );
    }
}
