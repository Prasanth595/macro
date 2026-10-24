//! The work feed use cases: list a page, recompute known items, mark items
//! done, and undo a done.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use macro_user_id::user_id::MacroUserIdStr;
use model_entity::{Entity, EntityType};
use model_notifications::NotifEvent;
use rootcause::Report;
use uuid::Uuid;

use super::{
    inbox,
    models::{
        FeedNotification, WorkFeedChange, WorkFeedDoneOutcome, WorkFeedDoneReceipt,
        WorkFeedDoneTarget, WorkFeedEntry, WorkFeedError, WorkFeedItem, WorkFeedItemKey,
        WorkFeedItemState, WorkFeedMode, WorkFeedPage, WorkFeedPrimaryReason, WorkFeedQuery,
        WorkFeedRowType, WorkFeedScope, WorkFeedViewer, counts_as_unseen,
    },
    policy,
    ports::{
        EntityFacts, SourceItem, SourceRequest, WorkFeedMail, WorkFeedNotifications,
        WorkFeedSignals, WorkFeedSource,
    },
    stacking,
};

#[cfg(test)]
mod test;

/// Most candidate keys recomputed per source request.
const RECOMPUTE_CHUNK: usize = 200;

/// The work feed's use cases.
pub trait WorkFeedService: Send + Sync + 'static {
    /// The hydrated entity each item carries.
    type Entity: Send + Sync + 'static;

    /// One page of the viewer's feed, newest first.
    fn page(
        &self,
        viewer: WorkFeedViewer,
        query: WorkFeedQuery,
    ) -> impl Future<Output = Result<WorkFeedPage<Self::Entity>, WorkFeedError>> + Send;

    /// The current membership and content of known items in one feed: each
    /// key comes back upserted with its placement, or removed.
    fn recompute(
        &self,
        viewer: WorkFeedViewer,
        scope: WorkFeedScope,
        keys: Vec<WorkFeedItemKey>,
    ) -> impl Future<Output = Result<Vec<WorkFeedChange<Self::Entity>>, WorkFeedError>> + Send;

    /// Acknowledge the attention the caller observed on each item: its
    /// notifications move to done and its inbox email is archived. Own work
    /// is not acknowledged, so an item the viewer also worked on stays in the
    /// work feed, seen, at its own-work time. A target naming an inbox row
    /// acknowledges only what that row stands for, shown or hidden, and an
    /// email row also archives its thread. Underlying tasks, discussions
    /// and pull requests are not completed.
    fn mark_done(
        &self,
        viewer: WorkFeedViewer,
        targets: Vec<WorkFeedDoneTarget>,
    ) -> impl Future<Output = Result<WorkFeedDoneOutcome, WorkFeedError>> + Send;

    /// Reverse exactly what one mark-done changed, then recompute its items
    /// for the caller's feed.
    fn undo_done(
        &self,
        viewer: WorkFeedViewer,
        scope: WorkFeedScope,
        receipt: WorkFeedDoneReceipt,
    ) -> impl Future<Output = Result<Vec<WorkFeedChange<Self::Entity>>, WorkFeedError>> + Send;
}

/// The work feed service over its ports.
pub struct WorkFeedServiceImpl<S, N, M, G> {
    source: S,
    notifications: N,
    mail: M,
    signals: G,
}

impl<S, N, M, G> WorkFeedServiceImpl<S, N, M, G> {
    /// Create the service from its ports.
    pub fn new(source: S, notifications: N, mail: M, signals: G) -> Self {
        Self {
            source,
            notifications,
            mail,
            signals,
        }
    }
}

/// An entry with the facts done needs about it.
struct Assembled<E> {
    entry: WorkFeedEntry<E>,
    facts: EntityFacts,
}

/// The notifications an item's scope is drawn from: a thread shares its
/// channel's notifications, every other item reads its own entity's.
fn notification_source(item: &SourceItem<impl Sized>) -> Option<Entity<'static>> {
    match item.key.entity_type {
        EntityType::ChannelMessage => item
            .facts
            .thread_channel
            .map(|channel| EntityType::Channel.with_entity_string(channel.to_string())),
        _ => Some(item.key.clone()),
    }
}

/// What an attention feed needs to cut its items into inbox rows.
struct RowContext<'a> {
    viewer: &'a MacroUserIdStr<'static>,
    row_types: &'a [WorkFeedRowType],
    now: DateTime<Utc>,
}

/// Build one item from its candidate and its source's active notifications.
/// The item is built the same way in every feed; an attention feed (`rows`
/// set) also cuts it into inbox rows and lists it only while it has a row.
/// Returns `None` when the item has no reason left in the feed.
fn assemble_item<E>(
    item: SourceItem<E>,
    loaded: &HashMap<Entity<'static>, Vec<FeedNotification>>,
    rows: Option<&RowContext<'_>>,
) -> Option<Assembled<E>> {
    let source = notification_source(&item);
    let available = source
        .as_ref()
        .and_then(|source| loaded.get(source))
        .map(Vec::as_slice)
        .unwrap_or_default();
    let mut scoped = match item.key.entity_type {
        EntityType::Channel => stacking::scope_channel(available),
        EntityType::ChannelMessage => {
            stacking::scope_channel_thread(available, item.key.entity_id.as_ref())
        }
        _ => available.to_vec(),
    };
    // An email's attention lasts while it is in the inbox: archive is mail's
    // own done, whatever its notifications' states.
    let in_inbox = item.facts.mail.is_none_or(|mail| mail.inbox_visible);
    if !in_inbox {
        scoped.clear();
    }
    stacking::sort_newest_first(&mut scoped);
    let key = WorkFeedItemKey::new(item.key);
    let rows = match rows {
        Some(context) if in_inbox => {
            let mut rows = inbox::rows(
                &key,
                available,
                item.facts.mail,
                context.viewer,
                context.now,
            );
            if !context.row_types.is_empty() {
                rows.retain(|row| context.row_types.contains(&row.row_type));
            }
            Some(rows)
        }
        Some(_) => Some(Vec::new()),
        None => None,
    };
    let listed = match &rows {
        Some(rows) => !rows.is_empty(),
        None => !scoped.is_empty() || item.touched_at.is_some(),
    };
    if !listed {
        return None;
    }

    let stacks = stacking::stack(&scoped);
    let attention_at = scoped.first().map(|notification| notification.created_at);
    let unseen = match item.facts.mail {
        // Mail is unseen while it has unread messages or an unseen reminder;
        // new-mail notifications follow the mailbox's own read state.
        Some(mail) => {
            !mail.is_read
                || scoped.iter().any(|notification| {
                    matches!(notification.notification_metadata, NotifEvent::Reminder(_))
                        && counts_as_unseen(notification)
                })
        }
        None => scoped
            .iter()
            .any(|notification| counts_as_unseen(notification)),
    };
    let primary = match (attention_at, item.touched_at) {
        (Some(attention), Some(touched)) if touched >= attention => WorkFeedPrimaryReason::OwnWork,
        (Some(_), _) if !stacks.is_empty() => WorkFeedPrimaryReason::Attention { stack: 0 },
        _ => WorkFeedPrimaryReason::OwnWork,
    };

    Some(Assembled {
        entry: WorkFeedEntry {
            sort_at: item.sort_at,
            rows: rows.unwrap_or_default(),
            item: WorkFeedItem {
                key,
                entity: item.entity,
                state: if unseen {
                    WorkFeedItemState::Unseen
                } else {
                    WorkFeedItemState::Seen
                },
                attention_at,
                touched_at: item.touched_at,
                notifications: scoped,
                stacks,
                primary,
            },
        },
        facts: item.facts,
    })
}

impl<S, N, M, G> WorkFeedServiceImpl<S, N, M, G>
where
    S: WorkFeedSource,
    N: WorkFeedNotifications,
    M: WorkFeedMail,
    G: WorkFeedSignals,
{
    /// Load the candidates' notifications and build their items for
    /// `scope`, in order.
    async fn assemble(
        &self,
        viewer: &WorkFeedViewer,
        scope: &WorkFeedScope,
        items: Vec<SourceItem<S::Entity>>,
    ) -> Result<Vec<Assembled<S::Entity>>, Report> {
        let mut sources = Vec::new();
        let mut seen = HashSet::new();
        for source in items.iter().filter_map(notification_source) {
            if seen.insert(source.clone()) {
                sources.push(source);
            }
        }
        let loaded = if sources.is_empty() {
            HashMap::new()
        } else {
            self.notifications
                .active(viewer.user.clone(), sources)
                .await?
        };
        let rows = (scope.mode == WorkFeedMode::Attention).then(|| RowContext {
            viewer: &viewer.user,
            row_types: &scope.row_types,
            now: Utc::now(),
        });
        Ok(items
            .into_iter()
            .filter_map(|item| assemble_item(item, &loaded, rows.as_ref()))
            .collect())
    }

    /// Current items for `keys` in `scope`, keyed by item.
    async fn current(
        &self,
        viewer: &WorkFeedViewer,
        scope: &WorkFeedScope,
        keys: &[WorkFeedItemKey],
    ) -> Result<HashMap<WorkFeedItemKey, Assembled<S::Entity>>, Report> {
        let filter = policy::signal_filter(&viewer.user, scope.include_snippets);
        let types = policy::candidate_types(scope.mode, &scope.types);
        let mut current = HashMap::with_capacity(keys.len());
        for chunk in keys.chunks(RECOMPUTE_CHUNK) {
            let page = self
                .source
                .page(SourceRequest {
                    viewer: viewer.clone(),
                    mode: scope.mode,
                    types: types.clone(),
                    filter: filter.clone(),
                    limit: u16::try_from(chunk.len()).unwrap_or(u16::MAX),
                    after: None,
                    only: Some(chunk.iter().map(|key| key.entity().clone()).collect()),
                })
                .await?;
            for assembled in self.assemble(viewer, scope, page.items).await? {
                current.insert(assembled.entry.item.key.clone(), assembled);
            }
        }
        Ok(current)
    }
}

/// Keys deduplicated in first-seen order.
fn unique_keys(keys: impl IntoIterator<Item = WorkFeedItemKey>) -> Vec<WorkFeedItemKey> {
    let mut seen = HashSet::new();
    keys.into_iter()
        .filter(|key| seen.insert(key.clone()))
        .collect()
}

/// Add the ids of `notifications` created by `through` to `ids`, once each.
fn acknowledge(ids: &mut Vec<Uuid>, notifications: &[FeedNotification], through: DateTime<Utc>) {
    for notification in notifications {
        if notification.created_at <= through && !ids.contains(&notification.notification_id) {
            ids.push(notification.notification_id);
        }
    }
}

/// An email thread item's thread id.
fn email_thread_id(key: &WorkFeedItemKey) -> Option<Uuid> {
    (key.entity().entity_type == EntityType::EmailThread)
        .then(|| Uuid::parse_str(key.entity().entity_id.as_ref()).ok())
        .flatten()
}

impl<S, N, M, G> WorkFeedService for WorkFeedServiceImpl<S, N, M, G>
where
    S: WorkFeedSource,
    N: WorkFeedNotifications,
    M: WorkFeedMail,
    G: WorkFeedSignals,
{
    type Entity = S::Entity;

    #[tracing::instrument(err, skip(self, viewer), fields(user = %viewer.user))]
    async fn page(
        &self,
        viewer: WorkFeedViewer,
        query: WorkFeedQuery,
    ) -> Result<WorkFeedPage<Self::Entity>, WorkFeedError> {
        let page = self
            .source
            .page(SourceRequest {
                viewer: viewer.clone(),
                mode: query.scope.mode,
                types: policy::candidate_types(query.scope.mode, &query.scope.types),
                filter: policy::signal_filter(&viewer.user, query.scope.include_snippets),
                limit: query.limit,
                after: query.after,
                only: None,
            })
            .await?;
        let entries = self
            .assemble(&viewer, &query.scope, page.items)
            .await?
            .into_iter()
            .map(|assembled| assembled.entry)
            .collect();
        Ok(WorkFeedPage {
            entries,
            next: page.next,
        })
    }

    #[tracing::instrument(err, skip(self, viewer, keys), fields(user = %viewer.user, keys = keys.len()))]
    async fn recompute(
        &self,
        viewer: WorkFeedViewer,
        scope: WorkFeedScope,
        keys: Vec<WorkFeedItemKey>,
    ) -> Result<Vec<WorkFeedChange<Self::Entity>>, WorkFeedError> {
        let keys = unique_keys(keys);
        if keys.is_empty() {
            return Ok(Vec::new());
        }
        let mut current = self.current(&viewer, &scope, &keys).await?;
        Ok(keys
            .into_iter()
            .map(|key| match current.remove(&key) {
                Some(assembled) => WorkFeedChange::Upserted(assembled.entry),
                None => WorkFeedChange::Removed(key),
            })
            .collect())
    }

    #[tracing::instrument(err, skip(self, viewer, targets), fields(user = %viewer.user, targets = targets.len()))]
    async fn mark_done(
        &self,
        viewer: WorkFeedViewer,
        targets: Vec<WorkFeedDoneTarget>,
    ) -> Result<WorkFeedDoneOutcome, WorkFeedError> {
        if targets.iter().any(|target| {
            target
                .row
                .as_ref()
                .is_some_and(|row| !target.key.owns_row(row))
        }) {
            return Err(WorkFeedError::InvalidInput(
                "a done row does not belong to its item",
            ));
        }
        let keys = unique_keys(targets.iter().map(|target| target.key.clone()));
        if keys.is_empty() {
            return Ok(WorkFeedDoneOutcome {
                items: Vec::new(),
                rows: Vec::new(),
                receipt: WorkFeedDoneReceipt::default(),
            });
        }
        let item_keys = unique_keys(
            targets
                .iter()
                .filter(|target| target.row.is_none())
                .map(|target| target.key.clone()),
        );
        let row_keys = unique_keys(
            targets
                .iter()
                .filter(|target| target.row.is_some())
                .map(|target| target.key.clone()),
        );
        // Evaluate each item in every feed's scope, whatever feed the caller
        // was looking at, so done acknowledges what they observed. A row is
        // found among every row of its item.
        let items = if item_keys.is_empty() {
            HashMap::new()
        } else {
            self.current(&viewer, &WorkFeedScope::everything(), &item_keys)
                .await?
        };
        let rows = if row_keys.is_empty() {
            HashMap::new()
        } else {
            self.current(&viewer, &WorkFeedScope::every_row(), &row_keys)
                .await?
        };

        let mut notification_ids = Vec::new();
        let mut archive = Vec::new();
        let mut done_rows = Vec::new();
        let mut planned = HashSet::new();
        for target in &targets {
            let planned_key = (target.key.clone(), target.row.clone());
            if !planned.insert(planned_key) {
                continue;
            }
            let (assembled, archives) = match &target.row {
                None => {
                    // Already gone from every feed: nothing left to acknowledge.
                    let Some(assembled) = items.get(&target.key) else {
                        continue;
                    };
                    let item = &assembled.entry.item;
                    let observed = target.revision.unwrap_or_else(|| item.revision());
                    if let Some(through) = observed.attention_through {
                        acknowledge(&mut notification_ids, &item.notifications, through);
                    }
                    (assembled, true)
                }
                Some(row_id) => {
                    done_rows.push(row_id.clone());
                    let Some(assembled) = rows.get(&target.key) else {
                        continue;
                    };
                    let Some(row) = assembled.entry.rows.iter().find(|row| row.id == *row_id)
                    else {
                        continue;
                    };
                    let observed = target.revision.unwrap_or_else(|| row.revision());
                    if let Some(through) = observed.attention_through {
                        acknowledge(&mut notification_ids, &row.notifications, through);
                        acknowledge(&mut notification_ids, &row.hidden, through);
                    }
                    (assembled, row.row_type == WorkFeedRowType::Email)
                }
            };
            if archives
                && assembled.facts.mail.is_some_and(|mail| mail.inbox_visible)
                && let Some(thread_id) = email_thread_id(&target.key)
                && !archive.contains(&thread_id)
            {
                archive.push(thread_id);
            }
        }

        let user = viewer.user.clone();
        let changed_notifications = if notification_ids.is_empty() {
            Vec::new()
        } else {
            self.notifications
                .set_done(user.clone(), notification_ids, true)
                .await?
        };
        // Archiving is best effort: the thread's notifications are already
        // done, which removes its attention on their own.
        let mut archived = Vec::new();
        for thread_id in archive {
            match self.mail.set_archived(user.clone(), thread_id, true).await {
                Ok(()) => archived.push(thread_id),
                Err(error) => {
                    tracing::warn!(error = ?error, %thread_id, "failed to archive work feed email")
                }
            }
        }

        self.signals
            .items_changed(user, keys.iter().map(|key| key.entity().clone()).collect())
            .await;

        Ok(WorkFeedDoneOutcome {
            receipt: WorkFeedDoneReceipt {
                items: keys.iter().map(WorkFeedItemKey::id).collect(),
                notification_ids: changed_notifications,
                archived_threads: archived,
            },
            items: item_keys,
            rows: done_rows,
        })
    }

    #[tracing::instrument(err, skip(self, viewer, receipt), fields(user = %viewer.user))]
    async fn undo_done(
        &self,
        viewer: WorkFeedViewer,
        scope: WorkFeedScope,
        receipt: WorkFeedDoneReceipt,
    ) -> Result<Vec<WorkFeedChange<Self::Entity>>, WorkFeedError> {
        let user = viewer.user.clone();
        if !receipt.notification_ids.is_empty() {
            self.notifications
                .set_done(user.clone(), receipt.notification_ids.clone(), false)
                .await?;
        }
        for thread_id in &receipt.archived_threads {
            if let Err(error) = self
                .mail
                .set_archived(user.clone(), *thread_id, false)
                .await
            {
                tracing::warn!(error = ?error, %thread_id, "failed to unarchive work feed email");
            }
        }
        let keys = receipt.item_keys();
        self.signals
            .items_changed(user, keys.iter().map(|key| key.entity().clone()).collect())
            .await;
        self.recompute(viewer, scope, keys).await
    }
}
