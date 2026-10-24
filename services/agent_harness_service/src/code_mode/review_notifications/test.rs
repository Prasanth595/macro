use super::*;
use agent_code_mode::domain::reviews::{ReviewId, ReviewItem};
use agent_session::{domain::model::AgentSessionId, testing::InMemoryAgentSessionRepo};
use feature_flags::{FlagSnapshot, FlagValue, outbound::fake::FakeFeatureFlags};
use notification::domain::{
    models::{Notification, NotificationResult, SendNotificationRequest},
    service::SendNotificationError,
};
use rootcause::Report;
use serde::Serialize;
use serde_json::json;
use std::sync::Mutex;

/// Records every request as JSON, the way the SQS ingress would serialize it.
#[derive(Default)]
struct RecordingIngress {
    sent: Mutex<Vec<Value>>,
}

impl NotificationIngress for RecordingIngress {
    async fn send_notification<
        'a,
        T: Notification + Clone + 'static,
        U: Serialize + Send + Sync + 'static,
    >(
        &'a self,
        req: SendNotificationRequest<'a, T, U>,
    ) -> Result<Option<NotificationResult<'a>>, Report<SendNotificationError>> {
        self.sent
            .lock()
            .unwrap()
            .push(serde_json::to_value(&req).expect("requests serialize"));
        Ok(None)
    }
}

fn account_holder() -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from_email("owner@example.com").unwrap()
}

fn review(kind: ReviewKind, drafts: Vec<(Value, ReviewItemStatus)>) -> ReviewRecord {
    serde_json::from_value(json!({
        "id": Uuid::from_u128(0xc),
        "sessionId": Uuid::from_u128(0xa),
        "actingUser": account_holder().to_string(),
        "executionId": null,
        "kind": kind,
        "title": "Replies to this week's leads",
        "revision": 1,
        "updatedAt": 0,
        "items": [],
    }))
    .map(|record: ReviewRecord| ReviewRecord {
        items: drafts
            .into_iter()
            .enumerate()
            .map(|(index, (draft, status))| ReviewItem {
                id: Uuid::from_u128(index as u128),
                draft,
                edited: false,
                status,
                result: None,
                error: None,
            })
            .collect(),
        ..record
    })
    .unwrap()
}

fn session_ref() -> AgentSessionNotificationRef {
    AgentSessionNotificationRef {
        session_id: Uuid::from_u128(0xa),
        session_name: "Follow up with Acme".to_owned(),
        bot_id: Uuid::from_u128(0xb07),
        bot_name: "Macro".to_owned(),
        parent: None,
        channel_id: None,
        thread_id: None,
        announcement_message_id: None,
    }
}

#[test]
fn a_reply_review_counts_and_previews_only_drafts_still_awaiting() {
    let record = review(
        ReviewKind::Email,
        vec![
            (
                json!({"subject":"Sent already", "replyingToId":"m0"}),
                ReviewItemStatus::Completed,
            ),
            (
                json!({"subject":"  Re: Renewal terms  ", "replyingToId":"m1"}),
                ReviewItemStatus::Pending,
            ),
            (
                json!({"subject":"Re: Pricing", "replyingToId":"m2"}),
                ReviewItemStatus::Pending,
            ),
        ],
    );
    let metadata = requested(session_ref(), &record).expect("email reviews reach the inbox");
    assert_eq!(metadata.review_id, Uuid::from_u128(0xc));
    assert_eq!(metadata.review_kind, AgentReviewKind::Email);
    assert_eq!(metadata.draft_count, 2);
    assert!(metadata.replies);
    assert_eq!(metadata.preview.as_deref(), Some("Re: Renewal terms"));
}

#[test]
fn a_new_email_among_replies_is_not_a_reply_review() {
    let record = review(
        ReviewKind::Email,
        vec![
            (
                json!({"subject":"Re: Renewal", "replyingToId":"m1"}),
                ReviewItemStatus::Pending,
            ),
            (
                json!({"subject":"Intro", "replyingToId":null}),
                ReviewItemStatus::Pending,
            ),
        ],
    );
    assert!(
        !requested(session_ref(), &record)
            .expect("email reviews reach the inbox")
            .replies
    );
}

#[test]
fn a_calendar_review_previews_its_first_event_title_within_bounds() {
    let record = review(
        ReviewKind::Calendar,
        vec![(json!({"title":"x".repeat(200)}), ReviewItemStatus::Pending)],
    );
    let metadata = requested(session_ref(), &record).expect("calendar reviews reach the inbox");
    assert_eq!(metadata.review_kind, AgentReviewKind::Calendar);
    assert!(!metadata.replies);
    assert_eq!(
        metadata.preview.map(|preview| preview.chars().count()),
        Some(PREVIEW_MAX_CHARS)
    );
}

#[test]
fn each_review_has_one_stable_notification_id() {
    let record = review(ReviewKind::Email, vec![]);
    let other = ReviewRecord {
        id: ReviewId(Uuid::from_u128(0xd)),
        ..review(ReviewKind::Email, vec![])
    };
    assert_eq!(notification_id(&record), notification_id(&record.clone()));
    assert_ne!(notification_id(&record), notification_id(&other));
}

fn notifier(
    flags: Option<FakeFeatureFlags>,
) -> InboxReviewNotifier<InMemoryAgentSessionRepo, RecordingIngress, (), (), FakeFeatureFlags> {
    let sessions = InMemoryAgentSessionRepo::new();
    let mut session = agent_session::testing::test_agent_session(AgentSessionId::new_from_uuid(
        Uuid::from_u128(0xa),
    ));
    session.name = "Follow up with Acme".to_owned();
    sessions.insert_session(session);
    InboxReviewNotifier {
        sessions,
        ingress: Arc::new(RecordingIngress::default()),
        reader: Arc::new(()),
        withdrawal: Arc::new(()),
        flags,
    }
}

fn flags(result: Result<bool, &str>) -> FakeFeatureFlags {
    let mut flags = FakeFeatureFlags::default();
    flags.set(
        account_holder(),
        result
            .map(|enabled| {
                FlagSnapshot::new([(
                    UNIFIED_NOTIFICATIONS.to_owned(),
                    FlagValue::Boolean(enabled),
                )])
            })
            .map_err(str::to_owned),
    );
    flags
}

#[tokio::test]
async fn an_account_holder_with_the_inbox_is_notified_under_the_reviews_id() {
    let notifier = notifier(Some(flags(Ok(true))));
    let record = review(
        ReviewKind::Email,
        vec![(
            json!({"subject":"Re: Renewal terms", "replyingToId":"m1"}),
            ReviewItemStatus::Pending,
        )],
    );
    notifier.announce(&account_holder(), &record).await;

    let sent = notifier.ingress.sent.lock().unwrap();
    assert_eq!(sent.len(), 1);
    let request = &sent[0];
    assert_eq!(
        request["uuid_to_write"],
        notification_id(&record).to_string()
    );
    assert_eq!(
        request["req"]["recipient_ids"],
        json!([account_holder().to_string()])
    );
    assert_eq!(
        request["req"]["notification_entity"]["entity_type"],
        "agent_session"
    );
    assert_eq!(
        request["req"]["notification_entity"]["entity_id"],
        Uuid::from_u128(0xa).to_string()
    );
    assert_eq!(
        request["req"]["notification"]["tag"],
        "agent_review_requested"
    );
    let metadata = &request["req"]["notification"]["content"];
    assert_eq!(metadata["sessionName"], "Follow up with Acme");
    assert_eq!(metadata["botName"], "Test Agent");
    assert_eq!(metadata["replies"], true);
    assert_eq!(request["send_conn_gateway"], true);
    assert!(request["build_apns"].is_object());
}

#[tokio::test]
async fn nobody_is_notified_without_the_inbox_or_its_flags() {
    let record = review(
        ReviewKind::Email,
        vec![(json!({"subject":"Intro"}), ReviewItemStatus::Pending)],
    );
    for flags in [
        None,
        Some(flags(Ok(false))),
        Some(flags(Err("posthog down"))),
    ] {
        let notifier = notifier(flags);
        notifier.announce(&account_holder(), &record).await;
        assert!(notifier.ingress.sent.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn an_import_review_never_reaches_the_inbox() {
    let record = review(
        ReviewKind::Import,
        vec![(json!({"source":"notion"}), ReviewItemStatus::Pending)],
    );
    assert!(requested(session_ref(), &record).is_none());

    let notifier = notifier(Some(flags(Ok(true))));
    notifier.announce(&account_holder(), &record).await;
    assert!(notifier.ingress.sent.lock().unwrap().is_empty());
}
