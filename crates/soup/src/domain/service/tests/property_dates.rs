use super::*;
use crate::domain::models::property_dates::PropertyDateRequest;
use crate::outbound::pg_soup_repo::PgSoupRepo;
use item_filters::ast::{chat::ChatLiteral, document::DocumentLiteral, project::ProjectLiteral};
use models_grouping::{
    CandidateDirection, CandidateQuery, PropertyBucketing, PropertyDateRange, PropertyDateRanges,
};
use sqlx::PgPool;

type Definitions = properties::PropertiesServiceImpl<
    properties::PropertiesPgRepo,
    properties::PermissionServiceImpl<entity_access::domain::ports::NoOpEntityAccessService>,
    Notifications,
>;
struct Notifications;
impl properties::NotificationService for Notifications {
    type Err = anyhow::Error;
    async fn send_task_assigned<'a>(
        &self,
        _: properties::domain::model::TaskAssignedNotification<'a>,
    ) -> Result<(), Self::Err> {
        unreachable!("read-only query")
    }
}

#[sqlx::test(
    fixtures(
        path = "../../../../../macro_db_client/fixtures",
        scripts("mixed_items_expanded")
    ),
    migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS"
)]
async fn generic_dates_hydrate_filter_and_page_across_entity_types(
    db: PgPool,
) -> anyhow::Result<()> {
    const DOCUMENT: &str = "11111111-0000-0000-0000-000000000000";
    const TASK: &str = "11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const CHAT: &str = "22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const PROJECT: &str = "aaaaaaaa-ffff-ffff-ffff-ffffffffffff";
    let viewer = MacroUserIdStr::parse_from_str("macro|user-1@test.com")?;
    let definition = Uuid::now_v7();
    sqlx::query!("INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, $2, 'Review Date', 'DATE', false)", definition, viewer.as_ref()).execute(&db).await?;
    sqlx::query!(
        "INSERT INTO document_sub_type (document_id, sub_type) VALUES ($1, 'task')",
        TASK
    )
    .execute(&db)
    .await?;
    for (id, kind, date) in [
        (DOCUMENT, "DOCUMENT", "2026-05-01T00:00:00Z"),
        (TASK, "TASK", "2026-05-02T00:00:00Z"),
        (CHAT, "CHAT", "2026-05-02T00:00:00Z"),
        (TASK, "DOCUMENT", "1900-01-01T00:00:00Z"),
    ] {
        sqlx::query!("INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) VALUES ($1, $2, $3::text::property_entity_type, $4, $5)",
            Uuid::now_v7(), id, kind, definition, serde_json::json!({"type":"Date","value":date})
        ).execute(&db).await?;
    }
    let definitions = Arc::new(Definitions::new(
        properties::PropertiesPgRepo::new(db.clone()),
        None,
        None,
    ));
    let service = SoupImpl::new(
        PgSoupRepo::new(readonly_pool::ReadOnlyPool(db)),
        FrecencyQueryServiceImpl::new(MockFrecencyStorage::new()),
        NoopEmailPreviewService,
        NoopCommsService,
        NoopCallRecordQueryService,
        NoOpCrmService,
        NoopPullRequestListing,
    )
    .with_property_queries(definitions);
    let filters = EntityFilterAst {
        document_filter: Some(Arc::new(Expr::or(
            Expr::val(DocumentLiteral::Id(DOCUMENT.parse()?)),
            Expr::val(DocumentLiteral::Id(TASK.parse()?)),
        ))),
        chat_filter: Some(Arc::new(Expr::val(ChatLiteral::ChatId(CHAT.parse()?)))),
        project_filter: Some(Arc::new(Expr::val(ProjectLiteral::ProjectIdSelf(
            PROJECT.parse()?,
        )))),
        ..Default::default()
    };
    let selection = CandidateQuery {
        date_property_id: Some(definition),
        timestamp_sort: None,
        direction: CandidateDirection::Ascending,
        grouping: None,
        cursor: None,
        limit: 1,
    };
    let mut request = PropertyDateRequest::initial(
        viewer.clone(),
        None,
        selection.clone(),
        filters.clone(),
        true,
    )?;
    for expected in [DOCUMENT, TASK, CHAT, PROJECT] {
        let result = service.get_property_date_page(request).await?;
        assert_eq!(result.candidates.groups[0].total_count, 4);
        let page = result.into_flat();
        assert_eq!(page.items.len(), 1);
        assert_eq!(
            page.items[0].item.item.entity().entity_id.as_ref(),
            expected
        );
        if expected == DOCUMENT || expected == TASK {
            assert!(page.items[0].document_server_facts.is_some());
        }
        if let Some(cursor) = page.next_cursor {
            request = PropertyDateRequest::continue_from(viewer.clone(), None, cursor, true)?;
        } else {
            assert_eq!(expected, PROJECT);
            break;
        }
    }
    let boundary = "2026-05-02T00:00:00Z".parse()?;
    let grouping = GroupingConfig::new(GroupByField::Property {
        property_definition_id: definition,
        entity_type: None,
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
    })
    .with_limit(1);
    let mut selection = selection;
    selection.grouping = Some(grouping);
    let result = service
        .get_property_date_page(PropertyDateRequest::initial(
            viewer.clone(),
            None,
            selection,
            filters,
            false,
        )?)
        .await?
        .into_grouped()?;
    assert_eq!(
        result
            .groups
            .iter()
            .map(|group| (&*group.key, group.total_count))
            .collect::<Vec<_>>(),
        [("before", 1), ("after", 2), ("missing", 1)]
    );
    let cursor = result.groups[1]
        .next_cursor
        .clone()
        .expect("second dated group continues");
    let continued = service
        .get_property_date_page(PropertyDateRequest::continue_from(
            viewer, None, cursor, false,
        )?)
        .await?
        .into_grouped()?;
    assert_eq!(continued.groups.len(), 1);
    assert_eq!(continued.groups[0].total_count, 2);
    assert!(continued.groups[0].next_cursor.is_none());
    Ok(())
}
