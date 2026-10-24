use super::*;
use crate::NotifEvent;

fn metadata(
    review_kind: AgentReviewKind,
    draft_count: u32,
    replies: bool,
) -> AgentReviewRequestedMetadata {
    AgentReviewRequestedMetadata {
        session: AgentSessionNotificationRef {
            session_id: Uuid::from_u128(0xa),
            session_name: "Follow up with Acme".to_owned(),
            bot_id: Uuid::from_u128(0xb07),
            bot_name: "Macro".to_owned(),
            parent: None,
            channel_id: None,
            thread_id: None,
            announcement_message_id: None,
        },
        review_id: Uuid::from_u128(0xc),
        review_kind,
        title: "Replies to this week's leads".to_owned(),
        draft_count,
        replies,
        preview: Some("Re: Renewal terms".to_owned()),
    }
}

#[test]
fn titles_name_what_the_agent_drafted() {
    for (kind, count, replies, title) in [
        (AgentReviewKind::Email, 1, true, "Macro drafted a reply"),
        (AgentReviewKind::Email, 3, true, "Macro drafted 3 replies"),
        (AgentReviewKind::Email, 1, false, "Macro drafted an email"),
        (AgentReviewKind::Email, 2, false, "Macro drafted 2 emails"),
        (
            AgentReviewKind::Calendar,
            1,
            false,
            "Macro drafted an event",
        ),
        (
            AgentReviewKind::Calendar,
            4,
            false,
            "Macro drafted 4 events",
        ),
    ] {
        assert_eq!(
            metadata(kind, count, replies).format_title(None).unwrap(),
            title
        );
    }
}

#[test]
fn body_shows_the_first_draft_and_falls_back_to_the_review_title() {
    let with_preview = metadata(AgentReviewKind::Email, 1, true);
    assert_eq!(with_preview.format_body(None).unwrap(), "Re: Renewal terms");

    let without_preview = AgentReviewRequestedMetadata {
        preview: Some("   ".to_owned()),
        ..with_preview
    };
    assert_eq!(
        without_preview.format_body(None).unwrap(),
        "Replies to this week's leads"
    );
}

#[test]
fn serializes_flat_under_its_tag() {
    let value = serde_json::to_value(NotifEvent::AgentReviewRequested(metadata(
        AgentReviewKind::Calendar,
        2,
        false,
    )))
    .unwrap();
    assert_eq!(value["tag"], "agent_review_requested");
    assert_eq!(
        value["content"]["sessionId"],
        Uuid::from_u128(0xa).to_string()
    );
    assert_eq!(value["content"]["botName"], "Macro");
    assert_eq!(
        value["content"]["reviewId"],
        Uuid::from_u128(0xc).to_string()
    );
    assert_eq!(value["content"]["reviewKind"], "calendar");
    assert_eq!(value["content"]["draftCount"], 2);
    assert!(matches!(
        serde_json::from_value::<NotifEvent>(value).unwrap(),
        NotifEvent::AgentReviewRequested(_)
    ));
}

#[test]
fn each_review_is_its_own_alert() {
    let entity = EntityType::AgentSession.with_entity_string(Uuid::from_u128(0xa).to_string());
    let first = metadata(AgentReviewKind::Email, 1, true);
    let edited = AgentReviewRequestedMetadata {
        preview: Some("Re: New terms".to_owned()),
        ..first.clone()
    };
    let other = AgentReviewRequestedMetadata {
        review_id: Uuid::from_u128(0xd),
        ..first.clone()
    };
    let key = |metadata: &AgentReviewRequestedMetadata| {
        metadata.collapse_key(&entity).into_hashed().into_inner()
    };
    assert_eq!(key(&first), key(&edited));
    assert_ne!(key(&first), key(&other));
}
