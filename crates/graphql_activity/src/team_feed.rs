use std::{collections::HashSet, num::NonZeroU32};

use activity::{ActivityFeedPage, EntityType};
use chrono::{DateTime, Utc};
use entity_access::domain::{
    models::{AccessError, EditAccessLevel},
    ports::EntityAccessService,
};
use futures::{StreamExt as _, TryStreamExt as _, stream};
use macro_user_id::user_id::MacroUserIdStr;
use uuid::Uuid;

use crate::loaders::{ActivityFeedReader, ActivityReadFailed};

/// Access checks one team page runs at once.
const MAX_CONCURRENT_ACCESS_CHECKS: usize = 8;

/// One page of the viewer's teammates' activity, keeping only rows on
/// entities shared with the viewer (`can_read_activity`). The page's `next` is the raw
/// storage position, so hidden rows shrink a page but never end the feed.
#[tracing::instrument(
    name = "activity.team_feed",
    skip_all,
    fields(row_count, entity_count, visible_count),
    err(Debug)
)]
pub(crate) async fn read_team_feed<R, A>(
    reader: &R,
    access: &A,
    viewer: &MacroUserIdStr<'static>,
    cursor: Option<(DateTime<Utc>, Uuid)>,
    limit: NonZeroU32,
) -> Result<ActivityFeedPage, ActivityReadFailed>
where
    R: ActivityFeedReader,
    A: EntityAccessService,
{
    let page = reader.teammate_feed(viewer.as_ref(), cursor, limit).await?;
    let entities: HashSet<(EntityType, String)> = page
        .records
        .iter()
        .map(|record| (record.entity_type, record.entity_id.clone()))
        .collect();
    let span = tracing::Span::current();
    span.record("row_count", page.records.len());
    span.record("entity_count", entities.len());

    let visible: HashSet<(EntityType, String)> = stream::iter(entities)
        .map(|entity| async move {
            let readable = can_read_activity(access, viewer, entity.0, &entity.1).await?;
            Ok::<_, AccessError>(readable.then_some(entity))
        })
        .buffer_unordered(MAX_CONCURRENT_ACCESS_CHECKS)
        .try_filter_map(|entity| async move { Ok(entity) })
        .try_collect()
        .await
        .map_err(|error| {
            tracing::error!(?error, "team activity access check failed");
            ActivityReadFailed
        })?;

    let records: Vec<_> = page
        .records
        .into_iter()
        .filter(|record| visible.contains(&(record.entity_type, record.entity_id.clone())))
        .collect();
    span.record("visible_count", records.len());
    Ok(ActivityFeedPage {
        records,
        next: page.next,
    })
}

/// Whether the viewer may read activity on an entity right now: they must be
/// in its explicit audience, the users granted access directly or through a
/// project, team, or channel, and the active participants of a channel. That
/// is the audience realtime activity is addressed to. Link sharing does not
/// count: new documents are link-shared by default, and the feed would
/// otherwise hand every teammate's drafts, and their links, to the team.
/// Forms are also Edit-gated like the form timeline, because their activity
/// names respondents. Refusals read as hidden; failures propagate so an
/// outage never silently empties the feed.
async fn can_read_activity<A: EntityAccessService>(
    access: &A,
    viewer: &MacroUserIdStr<'static>,
    entity_type: EntityType,
    entity_id: &str,
) -> Result<bool, AccessError> {
    let in_audience = match access.get_users_by_entity(entity_id, entity_type).await {
        Ok(users) => users.iter().any(|user| user == viewer),
        Err(error) => return refusal_or(error),
    };
    if !in_audience || entity_type != EntityType::Form {
        return Ok(in_audience);
    }
    match access
        .generate_entity_access_receipt::<EditAccessLevel>(viewer, None, entity_id, entity_type)
        .await
    {
        Ok(_) => Ok(true),
        Err(error) => refusal_or(error),
    }
}

/// An access refusal reads as hidden; anything else is a failure.
fn refusal_or(error: AccessError) -> Result<bool, AccessError> {
    match error {
        AccessError::Unauthorized
        | AccessError::UnauthorizedWithMessage(_)
        | AccessError::NotFound(_)
        | AccessError::BadRequest(_) => Ok(false),
        error => Err(error),
    }
}
