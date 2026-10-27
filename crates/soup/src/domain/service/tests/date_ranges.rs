use super::*;
use crate::domain::models::DynamicSort;

struct PrivateDefinition;
impl properties::PropertyDefinitionReader for PrivateDefinition {
    fn read_definition(
        &self,
        _id: Uuid,
        _viewer: MacroUserIdStr<'static>,
        _team: Option<properties::TeamReceipt>,
    ) -> std::pin::Pin<
        Box<
            dyn Future<
                    Output = Result<
                        models_properties::service::property_definition::PropertyDefinition,
                        properties::PropertiesErr,
                    >,
                > + Send
                + '_,
        >,
    > {
        Box::pin(async { Err(properties::PropertiesErr::NotFound) })
    }
}

#[tokio::test]
async fn private_sort_definition_is_rejected_before_query_execution() {
    let mut service = SoupImpl::new(
        MockSoupRepo::new(),
        FrecencyQueryServiceImpl::new(MockFrecencyStorage::new()),
        NoopEmailPreviewService,
        NoopCommsService,
        NoopCallRecordQueryService,
        NoOpCrmService,
        NoopPullRequestListing,
    );
    service.property_queries = Some(Arc::new(PrivateDefinition));
    let request = GroupedSortRequest::initial(
        MacroUserIdStr::parse_from_str("macro|viewer@example.com").unwrap(),
        20,
        DynamicSort::Property {
            property_definition_id: Uuid::from_u128(17),
            direction: SoupSortDirection::Asc,
        },
        EntityFilterAst::mock_empty(),
        models_grouping::GroupingConfig::new(models_grouping::GroupByField::EntityType),
    );
    assert!(matches!(
        service.get_user_soup_grouped(request).await,
        Err(SoupErr::PropertyQuery(properties::PropertiesErr::NotFound))
    ));
}
