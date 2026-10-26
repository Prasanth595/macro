use super::*;
use crate::domain::ports::ChannelListRepo;
const LEFT_USER: &str = "macro|left-user@test.com";
const NON_MEMBER: &str = "macro|user-d@test.com";
const TEAM_A_AUTO_ACTIVE: Uuid = Uuid::from_u128(0xc11);
const TEAM_A_MANUAL: Uuid = Uuid::from_u128(0xc13);
const TEAM_B_AUTO: Uuid = Uuid::from_u128(0xc21);
use models_grouping::{CandidateCursor, CandidateDirection, CandidateQuery};
use properties::PropertiesService;
use std::sync::Arc;

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
    fixtures(path = "../../../../fixtures", scripts("channels_repo")),
    migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS"
)]
async fn dates_keep_channel_access_filters_counts_and_null_cursors(
    pool: PgPool,
) -> anyhow::Result<()> {
    let property = Uuid::now_v7();
    sqlx::query!("INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, $2, 'Review Date', 'DATE', false)", property, LEFT_USER).execute(&pool).await?;
    for (channel, date) in [
        (TEAM_A_AUTO_ACTIVE, "2026-01-01T00:00:00Z"),
        (TEAM_A_MANUAL, "2026-01-02T00:00:00Z"),
    ] {
        sqlx::query!("INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) VALUES ($1, $2, 'CHANNEL', $3, $4)", Uuid::now_v7(), channel.to_string(), property, serde_json::json!({"type":"Date","value":date})).execute(&pool).await?;
    }
    let definitions = Definitions::new(properties::PropertiesPgRepo::new(pool.clone()), None, None);
    let repo = PgChannelsRepo::new(pool);
    let mut selection = CandidateQuery {
        date_property_id: Some(property),
        timestamp_sort: None,
        direction: CandidateDirection::Ascending,
        grouping: None,
        cursor: None,
        limit: 1,
    };
    let mut ids = Vec::new();
    for _ in 0..3 {
        let page = repo
            .get_channel_property_candidates(ChannelPropertyCandidateRequest {
                selection: definitions
                    .authorize_property_query(
                        MacroUserIdStr::try_from(LEFT_USER.to_owned())?,
                        None,
                        selection.clone(),
                    )
                    .await?,
                filter: None,
                properties: None,
            })
            .await
            .map_err(|error| anyhow::anyhow!("{error:?}"))?;
        assert_eq!(page.groups[0].total_count, 3);
        let candidate = &page.candidates[0];
        ids.push(candidate.identity.id.clone());
        selection.cursor = Some(CandidateCursor {
            identity: candidate.identity.clone(),
            sort_value: candidate.sort_value,
        });
    }
    assert_eq!(
        ids,
        [
            TEAM_A_AUTO_ACTIVE.to_string(),
            TEAM_A_MANUAL.to_string(),
            TEAM_B_AUTO.to_string()
        ]
    );
    let exhausted = repo
        .get_channel_property_candidates(ChannelPropertyCandidateRequest {
            selection: definitions
                .authorize_property_query(
                    MacroUserIdStr::try_from(LEFT_USER.to_owned())?,
                    None,
                    selection.clone(),
                )
                .await?,
            filter: None,
            properties: None,
        })
        .await
        .map_err(|error| anyhow::anyhow!("{error:?}"))?;
    assert!(exhausted.candidates.is_empty());
    assert_eq!(exhausted.groups[0].before_or_at_cursor_count, 3);
    selection.cursor = None;
    selection.direction = CandidateDirection::Descending;
    selection.limit = 10;
    let filter = Expr::and(
        Expr::or(
            Expr::val(ChannelLiteral::ChannelId(TEAM_A_AUTO_ACTIVE)),
            Expr::val(ChannelLiteral::ChannelId(TEAM_A_MANUAL)),
        ),
        Expr::is_not(Expr::val(ChannelLiteral::ChannelId(TEAM_A_MANUAL))),
    );
    let filtered = repo
        .get_channel_property_candidates(ChannelPropertyCandidateRequest {
            selection: definitions
                .authorize_property_query(
                    MacroUserIdStr::try_from(LEFT_USER.to_owned())?,
                    None,
                    selection.clone(),
                )
                .await?,
            filter: Some(Arc::new(filter)),
            properties: None,
        })
        .await
        .map_err(|error| anyhow::anyhow!("{error:?}"))?;
    assert_eq!(filtered.candidates.len(), 1);
    assert_eq!(
        filtered.candidates[0].identity.id,
        TEAM_A_AUTO_ACTIVE.to_string()
    );

    selection.date_property_id = None;
    let denied = repo
        .get_channel_property_candidates(ChannelPropertyCandidateRequest {
            selection: definitions
                .authorize_property_query(
                    MacroUserIdStr::try_from(NON_MEMBER.to_owned())?,
                    None,
                    selection,
                )
                .await?,
            filter: None,
            properties: None,
        })
        .await
        .map_err(|error| anyhow::anyhow!("{error:?}"))?;
    assert!(denied.candidates.is_empty());
    Ok(())
}
