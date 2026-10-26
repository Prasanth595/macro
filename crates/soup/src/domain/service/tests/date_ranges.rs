use super::*;
use crate::domain::ports::PropertyQueryAuthorizer;
use models_grouping::{GroupByField, PropertyBucketing, PropertyDateRange, PropertyDateRanges};

struct DatePropertyAuthorization;

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
async fn private_date_definition_never_reaches_candidate_sources() {
    let mut service = SoupImpl::new(
        MockSoupRepo::new(),
        FrecencyQueryServiceImpl::new(MockFrecencyStorage::new()),
        NoopEmailPreviewService,
        NoopCommsService,
        NoopCallRecordQueryService,
        NoOpCrmService,
        NoopPullRequestListing,
    );
    service.property_queries = Some(Arc::new(DatePropertyAuthorization));
    let user = MacroUserIdStr::parse_from_str("macro|viewer@example.com").unwrap();
    let context = crate::domain::models::property_dates::PropertyDateContext::initial(
        models_grouping::CandidateQuery {
            date_property_id: Some(Uuid::from_u128(17)),
            timestamp_sort: None,
            direction: models_grouping::CandidateDirection::Ascending,
            grouping: Some(review_date_grouping()),
            cursor: None,
            limit: 25,
        },
        EntityFilterAst::mock_empty(),
        Default::default(),
    )
    .unwrap();
    let request = crate::domain::models::property_dates::PropertyDateRequest::new(
        user,
        None,
        context,
        true,
        false,
        SoupType::Expanded,
        vec![],
    );
    let date_page = service.get_property_date_page(request).await;
    assert!(matches!(
        date_page,
        Err(SoupErr::PropertyQuery(properties::PropertiesErr::NotFound))
    ));
}
