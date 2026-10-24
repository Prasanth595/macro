use super::*;
use crate::domain::test_support::*;
use notification::domain::models::NotificationState;
use serde_json::json;

const CHANNEL: u128 = 0xC0;
const ROOT: u128 = 0x7A;
const DOC: u128 = 0xD0;

fn channel_item() -> WorkFeedItemKey {
    WorkFeedItemKey::new(entity(EntityType::Channel, CHANNEL))
}

fn thread_item(root: u128) -> WorkFeedItemKey {
    WorkFeedItemKey::new(entity(EntityType::ChannelMessage, root))
}

fn doc_item() -> WorkFeedItemKey {
    WorkFeedItemKey::new(entity(EntityType::Document, DOC))
}

fn rows_of(key: &WorkFeedItemKey, notifications: &[FeedNotification]) -> Vec<WorkFeedRow> {
    rows(key, notifications, None, &viewer_id(), at(59))
}

/// `(row type, shown ids, hidden ids)` per row.
fn shape(rows: &[WorkFeedRow]) -> Vec<(WorkFeedRowType, Vec<Uuid>, Vec<Uuid>)> {
    rows.iter()
        .map(|row| (row.row_type, ids(&row.notifications), ids(&row.hidden)))
        .collect()
}

fn document_mention(
    id: u128,
    message: u128,
    thread: Option<u128>,
    owner: &str,
    minute: u32,
) -> FeedNotification {
    let mut content = json!({
        "documentName": "Plan",
        "owner": owner,
        "messageId": uuid(message),
        "messageContent": "see doc",
        "channelType": "public",
    });
    if let Some(thread) = thread {
        content["threadId"] = json!(uuid(thread));
    }
    notification(
        id,
        entity(EntityType::Channel, CHANNEL),
        "document_mention",
        content,
        minute,
        NotificationState::Unseen,
    )
}

#[test]
fn a_top_level_message_that_mentions_you_is_one_mention_row() {
    // The mention and the document chip in the same message are one row on
    // the message's thread item; the channel item shows nothing for it.
    let notifications = vec![
        channel_mention(1, CHANNEL, ROOT, None, 1),
        document_mention(2, ROOT, None, "macro|other@example.com", 1),
    ];

    assert_eq!(
        shape(&rows_of(&thread_item(ROOT), &notifications)),
        vec![(
            WorkFeedRowType::ChannelMention,
            vec![uuid(1)],
            vec![uuid(2)]
        )]
    );
    assert!(rows_of(&channel_item(), &notifications).is_empty());
}

#[test]
fn replies_join_the_mention_row_which_keeps_its_id() {
    let mention = channel_mention(1, CHANNEL, ROOT, None, 1);
    let reply = channel_reply(2, CHANNEL, ROOT, 0x101, 2);

    let alone = rows_of(&thread_item(ROOT), std::slice::from_ref(&mention));
    let with_reply = rows_of(&thread_item(ROOT), &[mention.clone(), reply]);
    assert_eq!(
        shape(&with_reply),
        vec![(
            WorkFeedRowType::ChannelMention,
            vec![uuid(2), uuid(1)],
            vec![]
        )]
    );
    assert_eq!(alone[0].id, with_reply[0].id);
    assert_eq!(
        alone[0].id,
        format!("channel_message:{}#thread", uuid(ROOT))
    );

    // Once the mention is done the replies are a thread row with the same id.
    let reply_only = rows_of(
        &thread_item(ROOT),
        &[channel_reply(2, CHANNEL, ROOT, 0x101, 2)],
    );
    assert_eq!(reply_only[0].row_type, WorkFeedRowType::ChannelThread);
    assert_eq!(reply_only[0].id, alone[0].id);
}

#[test]
fn top_level_activity_is_one_channel_row() {
    let notifications = vec![
        channel_send(1, CHANNEL, 0x100, 1),
        channel_reaction(2, CHANNEL, 0x101, None, 2),
        channel_invite(3, CHANNEL, 3),
        // A plain chip in a top-level message rides with that message.
        channel_send(4, CHANNEL, 0x102, 4),
        document_mention(5, 0x102, None, "macro|other@example.com", 4),
        // Reactions inside a thread belong to the thread.
        channel_reaction(6, CHANNEL, 0x103, Some(ROOT), 5),
    ];

    let channel = rows_of(&channel_item(), &notifications);
    assert_eq!(
        shape(&channel),
        vec![(
            WorkFeedRowType::ChannelMessages,
            vec![uuid(4), uuid(3), uuid(2), uuid(1)],
            vec![uuid(5)]
        )]
    );
    assert_eq!(
        channel[0].id,
        format!("channel:{}#top_level", uuid(CHANNEL))
    );
    assert_eq!(
        shape(&rows_of(&thread_item(ROOT), &notifications)),
        vec![(WorkFeedRowType::ChannelThread, vec![uuid(6)], vec![])]
    );
}

#[test]
fn a_root_message_moves_into_its_active_thread() {
    let notifications = vec![
        channel_send(1, CHANNEL, ROOT, 1),
        channel_reply(2, CHANNEL, ROOT, 0x101, 2),
    ];
    assert!(rows_of(&channel_item(), &notifications).is_empty());
    assert_eq!(
        shape(&rows_of(&thread_item(ROOT), &notifications)),
        vec![(
            WorkFeedRowType::ChannelThread,
            vec![uuid(2), uuid(1)],
            vec![]
        )]
    );
}

#[test]
fn a_mention_in_a_reply_is_a_thread_row() {
    let notifications = vec![
        channel_mention(1, CHANNEL, 0x101, Some(ROOT), 1),
        document_mention(2, 0x101, Some(ROOT), USER, 1),
    ];
    assert_eq!(
        shape(&rows_of(&thread_item(ROOT), &notifications)),
        vec![(WorkFeedRowType::ChannelThread, vec![uuid(1)], vec![uuid(2)])]
    );
}

#[test]
fn document_mentions_show_only_your_documents() {
    let notifications = vec![
        document_mention(1, 0x100, None, USER, 1),
        document_mention(2, 0x101, None, "macro|other@example.com", 2),
    ];
    assert_eq!(
        shape(&rows_of(&channel_item(), &notifications)),
        vec![(
            WorkFeedRowType::ChannelMessages,
            vec![uuid(1)],
            vec![uuid(2)]
        )]
    );
}

#[test]
fn calls_alone_list_nothing() {
    let call = notification(
        1,
        entity(EntityType::Channel, CHANNEL),
        "call_started",
        json!({ "callId": uuid(0x99), "channelType": "public" }),
        1,
        NotificationState::Unseen,
    );
    assert!(rows_of(&channel_item(), &[call]).is_empty());
}

#[test]
fn discussions_split_into_mentions_threads_and_top_level_comments() {
    let notifications = vec![
        // Thread A: a root comment that mentions you, then a reply.
        doc_comment_mention(1, DOC, 0xA0, 0xA0, 1),
        doc_reply(2, DOC, 0xA1, 0xA0, 2),
        // Thread B: a reply to a thread you are in.
        doc_reply(3, DOC, 0xB1, 0xB0, 3),
        // Threads C and D: lone root comments share the top-level row.
        doc_comment(4, DOC, 0xC0, 0xC0, 4),
        doc_comment(5, DOC, 0xD0, 0xD0, 5),
        // A mention in a reply of thread B shadows its comment.
        doc_comment(6, DOC, 0xB2, 0xB0, 6),
        doc_comment_mention(7, DOC, 0xB2, 0xB0, 6),
    ];
    let rows = rows_of(&doc_item(), &notifications);
    assert_eq!(
        shape(&rows),
        vec![
            (
                WorkFeedRowType::DiscussionThread,
                vec![uuid(7), uuid(3)],
                vec![uuid(6)]
            ),
            (
                WorkFeedRowType::DiscussionMessages,
                vec![uuid(5), uuid(4)],
                vec![]
            ),
            (
                WorkFeedRowType::DiscussionMention,
                vec![uuid(2), uuid(1)],
                vec![]
            ),
        ]
    );
    assert_eq!(
        rows[0].id,
        format!("document:{}#thread:{}", uuid(DOC), uuid(0xB0))
    );
    assert_eq!(rows[1].id, format!("document:{}#top_level", uuid(DOC)));
}

#[test]
fn project_discussions_follow_their_reason() {
    let project = WorkFeedItemKey::new(entity(EntityType::Initiative, 0x1A));
    let discussion = |id: u128, reason: &str, message: u128, thread: u128, minute: u32| {
        notification(
            id,
            entity(EntityType::Initiative, 0x1A),
            "initiative_discussion",
            json!({
                "projectName": "Launch",
                "owner": USER,
                "reason": reason,
                "messageId": uuid(message),
                "threadId": uuid(thread),
                "text": "hello",
            }),
            minute,
            NotificationState::Unseen,
        )
    };
    let notifications = vec![
        discussion(1, "mention", 0xA0, 0xA0, 1),
        discussion(2, "owner", 0xB0, 0xB0, 2),
        discussion(3, "reply", 0xC1, 0xC0, 3),
    ];
    assert_eq!(
        shape(&rows_of(&project, &notifications)),
        vec![
            (WorkFeedRowType::DiscussionThread, vec![uuid(3)], vec![]),
            (WorkFeedRowType::DiscussionMessages, vec![uuid(2)], vec![]),
            (WorkFeedRowType::DiscussionMention, vec![uuid(1)], vec![]),
        ]
    );
}

fn access_requested(id: u128, request: u128, minute: u32) -> FeedNotification {
    notification(
        id,
        entity(EntityType::Document, DOC),
        "entity_access_requested",
        json!({
            "requestId": uuid(request),
            "revision": 1,
            "entityName": "Plan",
            "accessLevel": "edit",
        }),
        minute,
        NotificationState::Unseen,
    )
}

#[test]
fn each_access_request_and_task_is_its_own_row() {
    let task = notification(
        3,
        entity(EntityType::Document, DOC),
        "task_assigned",
        json!({ "taskId": uuid(DOC), "taskName": "Ship", "assignedBy": "macro|other@example.com" }),
        3,
        NotificationState::Seen,
    );
    let notifications = vec![
        access_requested(1, 0xE1, 1),
        access_requested(2, 0xE2, 2),
        task,
    ];
    let rows = rows_of(&doc_item(), &notifications);
    assert_eq!(
        rows.iter().map(|row| row.row_type).collect::<Vec<_>>(),
        vec![
            WorkFeedRowType::Task,
            WorkFeedRowType::AccessRequested,
            WorkFeedRowType::AccessRequested,
        ]
    );
    assert!(!rows[0].unseen, "a seen assignment is read");
    assert_eq!(
        rows[1].id,
        format!("document:{}#access_requested:{}", uuid(DOC), uuid(0xE2))
    );
}

fn calendar_reminder(id: u128, ends_minute: u32) -> FeedNotification {
    notification(
        id,
        entity(EntityType::CalendarEvent, 0xCA),
        "calendar_event_reminder",
        json!({
            "eventId": uuid(0xCA),
            "occurrenceKey": format!("o{id}"),
            "title": "Standup",
            "startsAt": at(ends_minute - 1),
            "endsAt": at(ends_minute),
            "minutesBefore": 10,
        }),
        1,
        NotificationState::Unseen,
    )
}

#[test]
fn reminders_for_ended_events_are_hidden() {
    let event = WorkFeedItemKey::new(entity(EntityType::CalendarEvent, 0xCA));
    let upcoming = calendar_reminder(1, 30);
    let ended = calendar_reminder(2, 20);

    let listed = rows(
        &event,
        &[upcoming.clone(), ended.clone()],
        None,
        &viewer_id(),
        at(25),
    );
    assert_eq!(
        shape(&listed),
        vec![(WorkFeedRowType::CalendarEvent, vec![uuid(1)], vec![uuid(2)])]
    );
    assert!(rows(&event, &[ended], None, &viewer_id(), at(25)).is_empty());
}

#[test]
fn email_rows_follow_the_mailbox_read_state() {
    let thread = WorkFeedItemKey::new(entity(EntityType::EmailThread, 0xE0));
    let email = with_state(
        &notification(
            1,
            entity(EntityType::EmailThread, 0xE0),
            "new_email",
            json!({ "toEmail": "me@example.com", "threadId": uuid(0xE0).to_string(), "subject": "Hi", "snippet": "hello" }),
            1,
            NotificationState::Unseen,
        ),
        NotificationState::Unseen,
    );
    let unread = rows(
        &thread,
        std::slice::from_ref(&email),
        Some(MailFacts {
            inbox_visible: true,
            is_read: false,
        }),
        &viewer_id(),
        at(59),
    );
    let read = rows(
        &thread,
        &[email],
        Some(MailFacts {
            inbox_visible: true,
            is_read: true,
        }),
        &viewer_id(),
        at(59),
    );
    assert_eq!(unread[0].row_type, WorkFeedRowType::Email);
    assert!(unread[0].unseen);
    assert!(
        !read[0].unseen,
        "an unseen new-email notification follows the read mailbox"
    );
}
