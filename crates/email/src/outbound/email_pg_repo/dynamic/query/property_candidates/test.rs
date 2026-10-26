use super::*;
use macro_user_id::cowlike::CowLike;
use models_grouping::{CandidateCursor, CandidateDirection, CandidateQuery};
use properties::PropertiesService;

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
type Definitions = properties::PropertiesServiceImpl<
    properties::PropertiesPgRepo,
    properties::PermissionServiceImpl<entity_access::domain::ports::NoOpEntityAccessService>,
    Notifications,
>;

#[sqlx::test(
    migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../../../fixtures", scripts("email_dynamic_query"))
)]
async fn property_dates_keep_email_views_filters_counts_and_null_pagination(
    pool: PgPool,
) -> anyhow::Result<()> {
    let viewer = MacroUserIdStr::parse_from_str("macro|user1@test.com")?.into_owned();
    let link: Uuid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa".parse()?;
    let property = Uuid::now_v7();
    sqlx::query!("INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, $2, 'Review Date', 'DATE', false)", property, viewer.as_ref()).execute(&pool).await?;
    for (id, date) in [
        (
            "20000001-0000-0000-0000-000000000001",
            "2026-05-02T00:00:00Z",
        ),
        (
            "20000004-0000-0000-0000-000000000004",
            "2026-05-01T00:00:00Z",
        ),
        (
            "20000002-0000-0000-0000-000000000002",
            "1900-01-01T00:00:00Z",
        ),
    ] {
        sqlx::query!("INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) VALUES ($1, $2, 'THREAD', $3, $4)", Uuid::now_v7(), id, property, serde_json::json!({"type":"Date","value":date})).execute(&pool).await?;
    }
    let definitions = Definitions::new(properties::PropertiesPgRepo::new(pool.clone()), None, None);
    let mut selection = CandidateQuery {
        date_property_id: Some(property),
        timestamp_sort: None,
        direction: CandidateDirection::Ascending,
        grouping: None,
        cursor: None,
        limit: 1,
    };
    let mut ids = Vec::new();
    for _ in 0..4 {
        let authorized = definitions
            .authorize_property_query(viewer.clone(), None, selection.clone())
            .await?;
        let page = property_candidates(
            &pool,
            PreviewCursorQuery {
                view: PreviewView::StandardLabel(PreviewViewStandardLabel::Inbox),
                link_ids: vec![link],
                limit: 1,
                query: Query::Sort(SimpleSortMethod::UpdatedAt, None),
                team_id: None,
            },
            authorized,
        )
        .await?;
        assert_eq!(page.groups[0].total_count, 4);
        assert_eq!(page.candidates.len(), 1);
        let row = &page.candidates[0];
        ids.push(row.identity.id.clone());
        selection.cursor = Some(CandidateCursor {
            identity: row.identity.clone(),
            sort_value: row.sort_value,
        });
    }
    assert_eq!(
        ids,
        [
            "20000004-0000-0000-0000-000000000004",
            "20000001-0000-0000-0000-000000000001",
            "20000005-0000-0000-0000-000000000005",
            "20000007-0000-0000-0000-000000000007",
        ]
    );
    selection.cursor = None;
    selection.limit = 10;
    let page = property_candidates(
        &pool,
        PreviewCursorQuery {
            view: PreviewView::StandardLabel(PreviewViewStandardLabel::Inbox),
            link_ids: vec![link],
            limit: 10,
            query: Query::Sort(
                SimpleSortMethod::UpdatedAt,
                Some(Arc::new(Expr::and(
                    Expr::or(
                        Expr::val(EmailLiteral::ThreadId(ids[0].parse()?)),
                        Expr::val(EmailLiteral::ThreadId(ids[1].parse()?)),
                    ),
                    Expr::is_not(Expr::val(EmailLiteral::ThreadId(ids[0].parse()?))),
                ))),
            ),
            team_id: None,
        },
        definitions
            .authorize_property_query(viewer.clone(), None, selection.clone())
            .await?,
    )
    .await?;
    assert_eq!(page.groups[0].total_count, 1);
    assert_eq!(page.candidates[0].identity.id, ids[1]);
    let inaccessible = property_candidates(
        &pool,
        PreviewCursorQuery {
            view: PreviewView::StandardLabel(PreviewViewStandardLabel::Inbox),
            link_ids: vec![Uuid::nil()],
            limit: 10,
            query: Query::Sort(SimpleSortMethod::UpdatedAt, None),
            team_id: None,
        },
        definitions
            .authorize_property_query(viewer, None, selection)
            .await?,
    )
    .await?;
    assert!(inaccessible.candidates.is_empty());
    Ok(())
}
