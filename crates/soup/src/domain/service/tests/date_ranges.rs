use super::*;
use crate::domain::ports::PropertyQueryAuthorizer;
use models_grouping::{GroupByField, PropertyBucketing, PropertyDateRange, PropertyDateRanges};

struct DatePropertyAuthorization {
    denied: bool,
}

impl PropertyQueryAuthorizer for DatePropertyAuthorization {
    fn authorize_selection<'a>(
        &'a self,
        _viewer: MacroUserIdStr<'static>,
        _team: Option<
            entity_access::domain::models::EntityAccessReceipt<
                entity_access::domain::models::MemberTeamRole,
            >,
        >,
        _selection: models_grouping::CandidateQuery,
    ) -> std::pin::Pin<
        Box<
            dyn Future<
                    Output = Result<properties::AuthorizedPropertyQuery, properties::PropertiesErr>,
                > + Send
                + 'a,
        >,
    > {
        Box::pin(async { Err(properties::PropertiesErr::NotFound) })
    }
    fn authorize<'a>(
        &'a self,
        viewer: MacroUserIdStr<'static>,
        grouping: GroupingConfig,
    ) -> std::pin::Pin<Box<dyn Future<Output = Result<(), properties::PropertiesErr>> + Send + 'a>>
    {
        assert_eq!(viewer.as_ref(), "macro|viewer@example.com");
        assert_eq!(grouping.field.date_ranges().unwrap().0, Uuid::from_u128(17));
        Box::pin(async move {
            if self.denied {
                Err(properties::PropertiesErr::NotFound)
            } else {
                Ok(())
            }
        })
    }
}

fn review_date_grouping() -> GroupingConfig {
    GroupingConfig {
        field: GroupByField::Property {
            property_definition_id: Uuid::from_u128(17),
            entity_type: None,
            bucketing: Some(PropertyBucketing::DateRanges(PropertyDateRanges {
                ranges: vec![
                    PropertyDateRange {
                        key: "before-review".into(),
                        start: None,
                        end: Some("2026-03-08T05:00:00Z".parse().unwrap()),
                    },
                    PropertyDateRange {
                        key: "review".into(),
                        start: Some("2026-03-08T05:00:00Z".parse().unwrap()),
                        end: None,
                    },
                ],
                missing_value_bucket_key: "no-review-date".into(),
            })),
        },
        group_key: None,
        per_group_limit: Some(25),
    }
}

#[tokio::test]
async fn timestamp_sorted_date_range_groups_authorize_before_the_repository() {
    let mut repo = MockSoupRepo::new();
    repo.expect_expanded_grouped_cursor_soup()
        .times(1)
        .withf(|request| {
            request.grouping.field.date_ranges().is_some()
                && matches!(
                    request.cursor.sort_method(),
                    SimpleSortMethod::ViewedUpdated
                )
                && request.grouping.per_group_limit == Some(25)
        })
        .returning(|_| Box::pin(async { Ok(Vec::<ItemGroupingInfo>::new().into_iter()) }));
    let mut service = SoupImpl::new(
        repo,
        FrecencyQueryServiceImpl::new(MockFrecencyStorage::new()),
        NoopEmailPreviewService,
        NoopCommsService,
        NoopCallRecordQueryService,
        NoOpCrmService,
        NoopPullRequestListing,
    );
    service.property_queries = Some(Arc::new(DatePropertyAuthorization { denied: false }));
    let request = GroupedSortRequest::initial(
        MacroUserIdStr::parse_from_str("macro|viewer@example.com").unwrap(),
        25,
        SimpleSortMethod::ViewedUpdated,
        EntityFilterAst::mock_empty(),
        review_date_grouping(),
    );
    assert!(
        service
            .get_user_soup_grouped(request)
            .await
            .unwrap()
            .collect::<Vec<_>>()
            .is_empty()
    );
}

#[tokio::test]
async fn private_date_definition_never_reaches_either_grouped_repository_path() {
    let mut service = SoupImpl::new(
        MockSoupRepo::new(),
        FrecencyQueryServiceImpl::new(MockFrecencyStorage::new()),
        NoopEmailPreviewService,
        NoopCommsService,
        NoopCallRecordQueryService,
        NoOpCrmService,
        NoopPullRequestListing,
    );
    service.property_queries = Some(Arc::new(DatePropertyAuthorization { denied: true }));
    let user = MacroUserIdStr::parse_from_str("macro|viewer@example.com").unwrap();
    let timestamp = service
        .get_user_soup_grouped(GroupedSortRequest::initial(
            user.clone(),
            25,
            SimpleSortMethod::ViewedUpdated,
            EntityFilterAst::mock_empty(),
            review_date_grouping(),
        ))
        .await;
    assert!(matches!(
        timestamp,
        Err(SoupErr::PropertyQuery(properties::PropertiesErr::NotFound))
    ));
    let request = crate::domain::models::property_dates::PropertyDateRequest::initial(
        user,
        None,
        models_grouping::CandidateQuery {
            date_property_id: Some(Uuid::from_u128(17)),
            timestamp_sort: None,
            direction: models_grouping::CandidateDirection::Ascending,
            grouping: Some(review_date_grouping()),
            cursor: None,
            limit: 25,
        },
        EntityFilterAst::mock_empty(),
        true,
    )
    .unwrap();
    let date_page = service.get_property_date_page(request).await;
    assert!(matches!(
        date_page,
        Err(SoupErr::PropertyQuery(properties::PropertiesErr::NotFound))
    ));
}
