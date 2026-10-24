use std::sync::Mutex;

use macro_user_id::user_id::MacroUserIdStr;
use notification::domain::models::NotificationState;
use serde_json::json;

use super::*;
use crate::domain::{
    models::{
        WorkFeedItemType, WorkFeedMode, WorkFeedPosition, WorkFeedRevision, WorkFeedStackKind,
    },
    ports::{MailFacts, SourcePage},
    test_support::*,
};

const DOC: u128 = 0xD0;
const OTHER_DOC: u128 = 0xD1;
const CHANNEL: u128 = 0xC0;
const THREAD: u128 = 0x70;
const MAIL: u128 = 0xE0;
const SENT_MAIL: u128 = 0xE1;

/// A source serving a fixed, ordered feed of labelled candidates.
#[derive(Default)]
struct FakeSource {
    items: Mutex<Vec<SourceItem<&'static str>>>,
    requests: Mutex<Vec<SourceRequest>>,
}

impl FakeSource {
    fn with(items: Vec<SourceItem<&'static str>>) -> Self {
        Self {
            items: Mutex::new(items),
            requests: Mutex::default(),
        }
    }
}

impl WorkFeedSource for FakeSource {
    type Entity = &'static str;

    async fn page(&self, request: SourceRequest) -> Result<SourcePage<&'static str>, Report> {
        self.requests.lock().unwrap().push(request.clone());
        let items = self.items.lock().unwrap().clone();
        let mut page: Vec<_> = items
            .into_iter()
            .filter(|item| {
                request
                    .only
                    .as_ref()
                    .is_none_or(|only| only.contains(&item.key))
            })
            .filter(|item| {
                request.after.as_ref().is_none_or(|after| {
                    (item.sort_at, item.key.entity_id.to_string())
                        < (after.sort_at, after.entity_id.clone())
                })
            })
            .collect();
        let full = page.len() > usize::from(request.limit);
        page.truncate(usize::from(request.limit));
        let next = full.then(|| {
            let last = page.last().unwrap();
            WorkFeedPosition {
                sort_at: last.sort_at,
                entity_id: last.key.entity_id.to_string(),
            }
        });
        Ok(SourcePage { items: page, next })
    }
}

#[derive(Default)]
struct FakeNotifications {
    by_entity: Mutex<HashMap<Entity<'static>, Vec<FeedNotification>>>,
    loads: Mutex<Vec<Vec<Entity<'static>>>>,
    done_calls: Mutex<Vec<(Vec<Uuid>, bool)>>,
}

impl FakeNotifications {
    fn with(notifications: Vec<FeedNotification>) -> Self {
        let mut by_entity: HashMap<Entity<'static>, Vec<FeedNotification>> = HashMap::new();
        for notification in notifications {
            by_entity
                .entry(notification.entity.clone())
                .or_default()
                .push(notification);
        }
        Self {
            by_entity: Mutex::new(by_entity),
            ..Default::default()
        }
    }

    fn state_of(&self, id: Uuid) -> NotificationState {
        self.by_entity
            .lock()
            .unwrap()
            .values()
            .flatten()
            .find(|n| n.notification_id == id)
            .map(|n| n.state)
            .unwrap()
    }
}

impl WorkFeedNotifications for FakeNotifications {
    async fn active(
        &self,
        _user: MacroUserIdStr<'static>,
        entities: Vec<Entity<'static>>,
    ) -> Result<HashMap<Entity<'static>, Vec<FeedNotification>>, Report> {
        self.loads.lock().unwrap().push(entities.clone());
        let by_entity = self.by_entity.lock().unwrap();
        Ok(entities
            .into_iter()
            .map(|entity| {
                let active = by_entity
                    .get(&entity)
                    .into_iter()
                    .flatten()
                    .filter(|n| n.state != NotificationState::Done)
                    .cloned()
                    .collect();
                (entity, active)
            })
            .collect())
    }

    async fn set_done(
        &self,
        _user: MacroUserIdStr<'static>,
        notification_ids: Vec<Uuid>,
        done: bool,
    ) -> Result<Vec<Uuid>, Report> {
        self.done_calls
            .lock()
            .unwrap()
            .push((notification_ids.clone(), done));
        let mut changed = Vec::new();
        for notifications in self.by_entity.lock().unwrap().values_mut() {
            for notification in notifications.iter_mut() {
                if notification_ids.contains(&notification.notification_id) {
                    let state = if done {
                        NotificationState::Done
                    } else {
                        NotificationState::Seen
                    };
                    *notification = with_state(notification, state);
                    changed.push(notification.notification_id);
                }
            }
        }
        Ok(changed)
    }
}

#[derive(Default)]
struct FakeMail {
    calls: Mutex<Vec<(Uuid, bool)>>,
}

impl WorkFeedMail for FakeMail {
    async fn set_archived(
        &self,
        _user: MacroUserIdStr<'static>,
        thread_id: Uuid,
        archived: bool,
    ) -> Result<(), Report> {
        self.calls.lock().unwrap().push((thread_id, archived));
        Ok(())
    }
}

#[derive(Default)]
struct FakeSignals {
    calls: Mutex<Vec<Vec<Entity<'static>>>>,
}

impl WorkFeedSignals for FakeSignals {
    async fn items_changed(&self, _user: MacroUserIdStr<'static>, entities: Vec<Entity<'static>>) {
        self.calls.lock().unwrap().push(entities);
    }
}

type Service = WorkFeedServiceImpl<FakeSource, FakeNotifications, FakeMail, FakeSignals>;

fn service(items: Vec<SourceItem<&'static str>>, notifications: Vec<FeedNotification>) -> Service {
    WorkFeedServiceImpl::new(
        FakeSource::with(items),
        FakeNotifications::with(notifications),
        FakeMail::default(),
        FakeSignals::default(),
    )
}

fn viewer() -> WorkFeedViewer {
    WorkFeedViewer {
        user: viewer_id(),
        team: None,
    }
}

fn candidate(
    label: &'static str,
    key: Entity<'static>,
    attention: Option<u32>,
    touched: Option<u32>,
) -> SourceItem<&'static str> {
    let attention_at = attention.map(at);
    let touched_at = touched.map(at);
    SourceItem {
        key,
        entity: label,
        facts: EntityFacts::default(),
        attention_at,
        touched_at,
        sort_at: attention_at.max(touched_at).unwrap(),
    }
}

fn mail_candidate(
    label: &'static str,
    id: u128,
    attention: Option<u32>,
    touched: Option<u32>,
    mail: MailFacts,
) -> SourceItem<&'static str> {
    let mut item = candidate(
        label,
        entity(EntityType::EmailThread, id),
        attention,
        touched,
    );
    item.facts.mail = Some(mail);
    item
}

fn new_email(id: u128, thread: u128, minute: u32, state: NotificationState) -> FeedNotification {
    notification(
        id,
        entity(EntityType::EmailThread, thread),
        "new_email",
        json!({
            "toEmail": "viewer@example.com",
            "threadId": uuid(thread),
            "subject": "Hello",
            "snippet": "...",
        }),
        minute,
        state,
    )
}

fn query() -> WorkFeedQuery {
    WorkFeedQuery {
        scope: WorkFeedScope {
            mode: WorkFeedMode::Work,
            types: Vec::new(),
            include_snippets: false,
            row_types: Vec::new(),
        },
        limit: 50,
        after: None,
    }
}

fn key(entity: Entity<'static>) -> WorkFeedItemKey {
    WorkFeedItemKey::new(entity)
}

#[tokio::test]
async fn page_assembles_stacked_items_in_feed_order() {
    let mut thread = candidate(
        "thread",
        entity(EntityType::ChannelMessage, THREAD),
        Some(6),
        None,
    );
    thread.facts.thread_channel = Some(uuid(CHANNEL));
    let service = service(
        vec![
            candidate("doc", entity(EntityType::Document, DOC), Some(5), Some(9)),
            thread,
            // The channel's only notification belongs to the thread.
            candidate(
                "channel",
                entity(EntityType::Channel, CHANNEL),
                Some(6),
                None,
            ),
            mail_candidate(
                "mail",
                MAIL,
                Some(4),
                None,
                MailFacts {
                    inbox_visible: true,
                    is_read: false,
                },
            ),
            mail_candidate(
                "sent",
                SENT_MAIL,
                None,
                Some(3),
                MailFacts {
                    inbox_visible: false,
                    is_read: true,
                },
            ),
        ],
        vec![
            doc_comment(1, DOC, 0xA0, 0xA0, 5),
            channel_reply(2, CHANNEL, THREAD, 0x71, 6),
            new_email(3, MAIL, 4, NotificationState::Seen),
            // Outside the inbox, mail attention no longer counts.
            new_email(4, SENT_MAIL, 2, NotificationState::Unseen),
        ],
    );

    let page = service.page(viewer(), query()).await.unwrap();
    let labels: Vec<_> = page.entries.iter().map(|e| e.item.entity).collect();
    assert_eq!(labels, vec!["doc", "thread", "mail", "sent"]);

    // doc-A: own work is newer, but its older comment keeps it unseen.
    let doc = &page.entries[0].item;
    assert_eq!(doc.primary, WorkFeedPrimaryReason::OwnWork);
    assert_eq!(doc.state, WorkFeedItemState::Unseen);
    assert_eq!(doc.attention_at, Some(at(5)));
    assert_eq!(doc.touched_at, Some(at(9)));
    assert_eq!(page.entries[0].sort_at, at(9));
    assert_eq!(doc.stacks[0].kind, WorkFeedStackKind::Comments);

    let thread = &page.entries[1].item;
    assert_eq!(
        thread.primary,
        WorkFeedPrimaryReason::Attention { stack: 0 }
    );
    assert_eq!(thread.stacks[0].kind, WorkFeedStackKind::ChannelThread);

    // Unread mail is unseen even when its notification was seen.
    assert_eq!(page.entries[2].item.state, WorkFeedItemState::Unseen);

    let sent = &page.entries[3].item;
    assert!(sent.notifications.is_empty());
    assert_eq!(sent.state, WorkFeedItemState::Seen);
    assert_eq!(sent.primary, WorkFeedPrimaryReason::OwnWork);

    // The thread and its channel share one notification load.
    let loads = service.notifications.loads.lock().unwrap();
    assert_eq!(loads.len(), 1);
    assert_eq!(
        loads[0]
            .iter()
            .filter(|e| e.entity_type == EntityType::Channel)
            .count(),
        1
    );
}

#[tokio::test]
async fn page_forwards_scope_and_cursor_to_the_source() {
    let service = service(
        vec![candidate(
            "doc",
            entity(EntityType::Document, DOC),
            None,
            Some(9),
        )],
        Vec::new(),
    );
    let mut query = query();
    query.scope.mode = WorkFeedMode::Attention;
    query.scope.types = vec![WorkFeedItemType::Email, WorkFeedItemType::ChannelThread];
    query.after = Some(WorkFeedPosition {
        sort_at: at(30),
        entity_id: "x".to_string(),
    });
    service.page(viewer(), query).await.unwrap();

    let requests = service.source.requests.lock().unwrap();
    assert_eq!(requests[0].mode, WorkFeedMode::Attention);
    assert_eq!(
        requests[0].types,
        vec![EntityType::EmailThread, EntityType::ChannelMessage]
    );
    assert_eq!(requests[0].after.as_ref().unwrap().sort_at, at(30));
    assert!(requests[0].only.is_none());
}

#[tokio::test]
async fn recompute_upserts_present_items_and_removes_missing_ones() {
    let service = service(
        vec![candidate(
            "doc",
            entity(EntityType::Document, DOC),
            None,
            Some(9),
        )],
        Vec::new(),
    );
    let changes = service
        .recompute(
            viewer(),
            query().scope,
            vec![
                key(entity(EntityType::Document, DOC)),
                key(entity(EntityType::Document, OTHER_DOC)),
                key(entity(EntityType::Document, DOC)),
            ],
        )
        .await
        .unwrap();

    assert_eq!(changes.len(), 2);
    assert!(matches!(&changes[0], WorkFeedChange::Upserted(entry) if entry.item.entity == "doc"));
    assert!(
        matches!(&changes[1], WorkFeedChange::Removed(removed) if *removed == key(entity(EntityType::Document, OTHER_DOC)))
    );
}

#[tokio::test]
async fn done_acknowledges_only_what_was_observed() {
    let service = service(
        vec![candidate(
            "doc",
            entity(EntityType::Document, DOC),
            Some(8),
            Some(9),
        )],
        vec![
            doc_comment(1, DOC, 0xA0, 0xA0, 5),
            // Arrived after the caller looked at the item.
            doc_comment(2, DOC, 0xB0, 0xB0, 8),
        ],
    );
    let doc = key(entity(EntityType::Document, DOC));

    let outcome = service
        .mark_done(
            viewer(),
            vec![WorkFeedDoneTarget {
                key: doc.clone(),
                revision: Some(WorkFeedRevision {
                    attention_through: Some(at(6)),
                }),
                row: None,
            }],
        )
        .await
        .unwrap();

    assert_eq!(outcome.items, vec![doc.clone()]);
    assert_eq!(outcome.receipt.notification_ids, vec![uuid(1)]);
    assert_eq!(
        service.notifications.state_of(uuid(1)),
        NotificationState::Done
    );
    assert_eq!(
        service.notifications.state_of(uuid(2)),
        NotificationState::Unseen
    );
    assert!(outcome.receipt.archived_threads.is_empty());
    // Every session of the viewer is told the item changed.
    assert_eq!(
        *service.signals.calls.lock().unwrap(),
        vec![vec![doc.entity().clone()]]
    );
}

#[tokio::test]
async fn done_without_a_revision_completes_everything_current() {
    let inbox = MailFacts {
        inbox_visible: true,
        is_read: true,
    };
    let sent = MailFacts {
        inbox_visible: false,
        is_read: true,
    };
    let service = service(
        vec![
            mail_candidate("mail", MAIL, Some(4), None, inbox),
            mail_candidate("sent", SENT_MAIL, None, Some(3), sent),
        ],
        vec![new_email(1, MAIL, 4, NotificationState::Unseen)],
    );

    let outcome = service
        .mark_done(
            viewer(),
            vec![
                WorkFeedDoneTarget {
                    key: key(entity(EntityType::EmailThread, MAIL)),
                    revision: None,
                    row: None,
                },
                WorkFeedDoneTarget {
                    key: key(entity(EntityType::EmailThread, SENT_MAIL)),
                    revision: None,
                    row: None,
                },
            ],
        )
        .await
        .unwrap();

    assert_eq!(outcome.receipt.notification_ids, vec![uuid(1)]);
    // Only the inbox thread is archived; the sent thread is own work, which
    // done leaves alone.
    assert_eq!(
        *service.mail.calls.lock().unwrap(),
        vec![(uuid(MAIL), true)]
    );
    assert_eq!(outcome.receipt.archived_threads, vec![uuid(MAIL)]);
}

#[tokio::test]
async fn done_leaves_own_work_alone() {
    let service = service(
        vec![candidate(
            "doc",
            entity(EntityType::Document, DOC),
            None,
            Some(9),
        )],
        Vec::new(),
    );
    let doc = key(entity(EntityType::Document, DOC));
    let outcome = service
        .mark_done(
            viewer(),
            vec![WorkFeedDoneTarget {
                key: doc.clone(),
                revision: None,
                row: None,
            }],
        )
        .await
        .unwrap();

    // Nothing to acknowledge: the item keeps its own-work reason.
    assert_eq!(outcome.items, vec![doc]);
    assert!(outcome.receipt.notification_ids.is_empty());
    assert!(service.notifications.done_calls.lock().unwrap().is_empty());
    assert!(service.mail.calls.lock().unwrap().is_empty());
}

#[tokio::test]
async fn done_on_an_item_already_gone_changes_nothing() {
    let service = service(Vec::new(), Vec::new());
    let gone = key(entity(EntityType::Document, DOC));
    let outcome = service
        .mark_done(
            viewer(),
            vec![WorkFeedDoneTarget {
                key: gone.clone(),
                revision: None,
                row: None,
            }],
        )
        .await
        .unwrap();
    assert_eq!(outcome.items, vec![gone]);
    assert_eq!(outcome.receipt.notification_ids, Vec::<Uuid>::new());
    assert!(service.notifications.done_calls.lock().unwrap().is_empty());
}

#[tokio::test]
async fn undo_reverses_exactly_one_done() {
    let inbox = MailFacts {
        inbox_visible: true,
        is_read: true,
    };
    let service = service(
        vec![
            candidate("doc", entity(EntityType::Document, DOC), Some(5), Some(9)),
            mail_candidate("mail", MAIL, Some(4), None, inbox),
        ],
        vec![
            doc_comment(1, DOC, 0xA0, 0xA0, 5),
            new_email(2, MAIL, 4, NotificationState::Unseen),
        ],
    );
    let doc = key(entity(EntityType::Document, DOC));
    let mail = key(entity(EntityType::EmailThread, MAIL));
    let outcome = service
        .mark_done(
            viewer(),
            vec![
                WorkFeedDoneTarget {
                    key: doc.clone(),
                    revision: None,
                    row: None,
                },
                WorkFeedDoneTarget {
                    key: mail.clone(),
                    revision: None,
                    row: None,
                },
            ],
        )
        .await
        .unwrap();

    let receipt = WorkFeedDoneReceipt::decode(&outcome.receipt.encode()).unwrap();
    let changes = service
        .undo_done(viewer(), query().scope, receipt)
        .await
        .unwrap();

    // Undone notifications come back seen.
    assert_eq!(
        service.notifications.state_of(uuid(1)),
        NotificationState::Seen
    );
    assert_eq!(
        service.notifications.state_of(uuid(2)),
        NotificationState::Seen
    );
    assert_eq!(
        *service.mail.calls.lock().unwrap(),
        vec![(uuid(MAIL), true), (uuid(MAIL), false)]
    );
    assert_eq!(changes.len(), 2);
    assert!(
        changes
            .iter()
            .all(|change| matches!(change, WorkFeedChange::Upserted(_)))
    );
}

fn attention_query(row_types: Vec<WorkFeedRowType>) -> WorkFeedQuery {
    WorkFeedQuery {
        scope: WorkFeedScope {
            mode: WorkFeedMode::Attention,
            types: Vec::new(),
            include_snippets: true,
            row_types,
        },
        limit: 50,
        after: None,
    }
}

fn thread_candidate(minute: u32) -> SourceItem<&'static str> {
    let mut item = candidate(
        "thread",
        entity(EntityType::ChannelMessage, THREAD),
        Some(minute),
        None,
    );
    item.facts.thread_channel = Some(uuid(CHANNEL));
    item
}

fn document_mention(id: u128, message: u128, minute: u32) -> FeedNotification {
    notification(
        id,
        entity(EntityType::Channel, CHANNEL),
        "document_mention",
        json!({
            "documentName": "Plan",
            "owner": "macro|other@example.com",
            "messageId": uuid(message),
            "messageContent": "see doc",
            "channelType": "public",
        }),
        minute,
        NotificationState::Unseen,
    )
}

#[tokio::test]
async fn attention_entries_carry_rows_and_leave_items_as_work_feeds_build_them() {
    let channel = entity(EntityType::Channel, CHANNEL);
    let items = vec![candidate("channel", channel.clone(), Some(5), None)];
    let notifications = vec![
        channel_reaction(1, CHANNEL, 0x100, None, 5),
        channel_send(2, CHANNEL, 0x101, 4),
    ];

    let work = service(items.clone(), notifications.clone())
        .page(viewer(), query())
        .await
        .unwrap();
    let attention = service(items, notifications)
        .page(viewer(), attention_query(Vec::new()))
        .await
        .unwrap();

    // The item is the same in both feeds: the top-level reaction is not in
    // the channel's stacks, which leave reactions to message threads.
    let (work, attention) = (&work.entries[0], &attention.entries[0]);
    assert!(work.rows.is_empty());
    assert_eq!(
        attention
            .item
            .stacks
            .iter()
            .map(|s| s.kind)
            .collect::<Vec<_>>(),
        work.item.stacks.iter().map(|s| s.kind).collect::<Vec<_>>()
    );
    assert_eq!(attention.item.attention_at, work.item.attention_at);
    assert_eq!(
        ids(&attention.item.notifications),
        ids(&work.item.notifications)
    );

    // The inbox row holds the channel's top-level activity, reaction included.
    assert_eq!(attention.rows.len(), 1);
    assert_eq!(attention.rows[0].row_type, WorkFeedRowType::ChannelMessages);
    assert_eq!(
        ids(&attention.rows[0].notifications),
        vec![uuid(1), uuid(2)]
    );
    assert_eq!(
        attention.rows[0].id,
        format!("channel:{}#top_level", uuid(CHANNEL))
    );
}

#[tokio::test]
async fn row_types_narrow_rows_and_drop_items_without_one() {
    let doc = entity(EntityType::Document, DOC);
    let task = notification(
        1,
        doc.clone(),
        "task_assigned",
        json!({ "taskId": uuid(DOC), "taskName": "Ship", "assignedBy": "macro|other@example.com" }),
        2,
        NotificationState::Unseen,
    );
    let items = vec![candidate("doc", doc.clone(), Some(3), None)];
    let notifications = vec![task, doc_comment(2, DOC, 0xA0, 0xA0, 3)];

    let tasks = service(items.clone(), notifications.clone())
        .page(viewer(), attention_query(vec![WorkFeedRowType::Task]))
        .await
        .unwrap();
    assert_eq!(
        tasks.entries[0]
            .rows
            .iter()
            .map(|row| row.row_type)
            .collect::<Vec<_>>(),
        vec![WorkFeedRowType::Task]
    );

    let access = service(items, notifications)
        .page(
            viewer(),
            attention_query(vec![WorkFeedRowType::AccessRequested]),
        )
        .await
        .unwrap();
    assert!(access.entries.is_empty());
}

#[tokio::test]
async fn row_done_acknowledges_only_what_its_row_stands_for() {
    let thread = key(entity(EntityType::ChannelMessage, THREAD));
    let items = vec![
        thread_candidate(2),
        candidate(
            "channel",
            entity(EntityType::Channel, CHANNEL),
            Some(4),
            None,
        ),
    ];
    let notifications = vec![
        // The top-level message that mentions the viewer, with a document
        // chip the mention speaks for.
        channel_mention(1, CHANNEL, THREAD, None, 1),
        document_mention(2, THREAD, 1),
        channel_reply(3, CHANNEL, THREAD, 0x101, 2),
        // Unrelated top-level activity stays active.
        channel_send(4, CHANNEL, 0x102, 4),
    ];
    let service = service(items, notifications);
    let page = service
        .page(viewer(), attention_query(Vec::new()))
        .await
        .unwrap();
    let row = page
        .entries
        .iter()
        .flat_map(|entry| &entry.rows)
        .find(|row| row.row_type == WorkFeedRowType::ChannelMention)
        .unwrap()
        .clone();
    assert_eq!(ids(&row.hidden), vec![uuid(2)]);

    // The caller saw the row before the reply arrived: the reply stays.
    let outcome = service
        .mark_done(
            viewer(),
            vec![WorkFeedDoneTarget {
                key: thread.clone(),
                revision: Some(WorkFeedRevision {
                    attention_through: Some(at(1)),
                }),
                row: Some(row.id.clone()),
            }],
        )
        .await
        .unwrap();

    assert!(outcome.items.is_empty(), "the item itself was not targeted");
    assert_eq!(outcome.rows, vec![row.id]);
    assert_eq!(outcome.receipt.items, vec![thread.id()]);
    assert_eq!(outcome.receipt.notification_ids, vec![uuid(1), uuid(2)]);
    assert_eq!(
        service.notifications.state_of(uuid(3)),
        NotificationState::Unseen
    );
    assert_eq!(
        service.notifications.state_of(uuid(4)),
        NotificationState::Unseen
    );
}

#[tokio::test]
async fn an_email_row_done_archives_its_thread() {
    let mail = key(entity(EntityType::EmailThread, MAIL));
    let items = vec![mail_candidate(
        "mail",
        MAIL,
        Some(3),
        None,
        MailFacts {
            inbox_visible: true,
            is_read: false,
        },
    )];
    let service = service(
        items,
        vec![new_email(1, MAIL, 3, NotificationState::Unseen)],
    );

    let outcome = service
        .mark_done(
            viewer(),
            vec![WorkFeedDoneTarget {
                key: mail.clone(),
                revision: None,
                row: Some(format!("{}#email", mail.id())),
            }],
        )
        .await
        .unwrap();

    assert_eq!(outcome.receipt.notification_ids, vec![uuid(1)]);
    assert_eq!(outcome.receipt.archived_threads, vec![uuid(MAIL)]);
    assert_eq!(
        *service.mail.calls.lock().unwrap(),
        vec![(uuid(MAIL), true)]
    );
}

#[tokio::test]
async fn a_done_row_must_belong_to_its_item() {
    let doc = key(entity(EntityType::Document, DOC));
    let other = key(entity(EntityType::Document, OTHER_DOC));
    let error = service(Vec::new(), Vec::new())
        .mark_done(
            viewer(),
            vec![WorkFeedDoneTarget {
                key: doc,
                revision: None,
                row: Some(format!("{}#task", other.id())),
            }],
        )
        .await
        .unwrap_err();
    assert!(matches!(error, WorkFeedError::InvalidInput(_)));
}
