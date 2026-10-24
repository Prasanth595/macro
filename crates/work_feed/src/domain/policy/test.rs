use super::*;
use crate::domain::test_support::viewer_id;

#[test]
fn no_types_means_homes_kinds_in_work_feeds() {
    assert_eq!(
        candidate_types(WorkFeedMode::Work, &[]),
        vec![
            EntityType::Document,
            EntityType::Chat,
            EntityType::Project,
            EntityType::EmailThread,
            EntityType::Channel,
            EntityType::ChannelMessage,
            EntityType::CalendarEvent,
            EntityType::ForeignEntity,
            EntityType::AgentSession,
        ]
    );
}

#[test]
fn no_types_adds_projects_and_crm_records_in_attention_feeds() {
    let types = candidate_types(WorkFeedMode::Attention, &[]);
    assert_eq!(
        types[types.len() - 3..],
        [
            EntityType::Initiative,
            EntityType::CrmCompany,
            EntityType::CrmContact,
        ]
    );
    assert_eq!(
        types[..types.len() - 3],
        candidate_types(WorkFeedMode::Work, &[])
    );
}

#[test]
fn types_keep_request_order_without_duplicates() {
    assert_eq!(
        candidate_types(
            WorkFeedMode::Work,
            &[
                WorkFeedItemType::Email,
                WorkFeedItemType::Document,
                WorkFeedItemType::Email,
            ]
        ),
        vec![EntityType::EmailThread, EntityType::Document]
    );
}

#[test]
fn signal_filter_matches_home_signal() {
    let filter = signal_filter(&viewer_id(), false);
    assert!(filter.document_filter.is_some(), "snippets are excluded");
    assert!(
        filter.agent_session_filter.is_some(),
        "agent sessions are opted in"
    );
    assert!(
        filter.initiative_filter.is_some(),
        "initiatives are opted in; the requested types decide"
    );
    assert!(filter.email_filter.tree.is_some());
    assert!(filter.channel_thread_filter.is_some());
    assert!(filter.foreign_entity_filter.is_some());

    let with_snippets = signal_filter(&viewer_id(), true);
    assert!(with_snippets.document_filter.is_none());
}
