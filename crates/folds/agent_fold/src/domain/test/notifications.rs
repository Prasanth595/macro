use super::util::{parse_log, test_session};
use crate::domain::{
    fold::fold,
    lifecycle::LifecycleFold,
    log::{AgentSessionLog, Message},
    model::{Author, FoldEvent, TurnSignal},
};
use agent_client_protocol::schema::v1::{RequestId, SessionId};
use agent_runtime_protocol::domain::{
    action::AgentAction,
    notification::{Notification, NotificationEvent, NotificationInput},
};

#[test]
fn system_events_never_become_messages_and_split_noop_never_streams() {
    let mut machine = LifecycleFold::new();
    let action = AgentAction::notification(vec![Notification {
        id: macro_uuid::generate_uuid_v7(),
        subject_id: "connection".into(),
        created_at: "2026-10-21T00:00:00Z".into(),
        event: NotificationEvent::AppConnected {
            app: "Calendar".into(),
        },
    }]);
    let request = action
        .to_runtime(&SessionId::new("s"), RequestId::Str("event".into()))
        .unwrap();
    let initial = machine.push(AgentSessionLog {
        agent_session_id: test_session(),
        user_id: None,
        content: Message::Notification(request),
        logged_at: None,
    });
    assert!(
        initial
            .events
            .iter()
            .all(|event| matches!(event, FoldEvent::MetadataUpdated(_)))
    );
    assert!(machine.inner().messages().is_empty());
    assert_eq!(machine.inner().metadata().notifications.len(), 1);
    for frame in parse_log(
        r#"
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_thought_chunk","content":{"type":"text","text":"No response needed."}}}}}
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"<no"}}}}}
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"op/>"}}}}}
"#,
    ) {
        let result = machine.push(frame);
        assert!(result.events.iter().all(|event| !matches!(
            event,
            FoldEvent::NewMessage(_) | FoldEvent::MessageUpdate(_)
        )));
    }
    let closed = machine.push(parse_log(r#"{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","id":"event","result":{"stopReason":"end_turn"}}}"#).remove(0));
    assert!(machine.inner().messages().is_empty());
    assert!(matches!(
        closed.signals.as_slice(),
        [TurnSignal::TurnEnded {
            notification_noop: true,
            ..
        }]
    ));
}

#[test]
fn quiet_events_do_not_pollute_real_prompts_and_real_prompts_cannot_noop() {
    let mut action = AgentAction::prompt("actual owner request");
    if let AgentAction::Prompt(prompt) = &mut action {
        prompt.notifications = Some(NotificationInput {
            notifications: vec![Notification {
                id: macro_uuid::generate_uuid_v7(),
                subject_id: "app".into(),
                created_at: "2026-10-21T00:00:00Z".into(),
                event: NotificationEvent::AppConnected {
                    app: "Calendar".into(),
                },
            }],
            system_turn: false,
        });
    }
    let request = action
        .to_runtime(&SessionId::new("s"), RequestId::Str("event".into()))
        .unwrap();
    let mut frames = vec![AgentSessionLog {
        agent_session_id: test_session(),
        user_id: None,
        content: Message::ToRuntime(request),
        logged_at: None,
    }];
    frames.extend(parse_log(r#"
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"<noop/>"}}}}}
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","id":"event","result":{"stopReason":"end_turn"}}}
"#));
    let messages = fold(frames);
    assert_eq!(messages.len(), 2);
    assert!(matches!(messages[0].author, Author::User { .. }));
    assert_eq!(
        messages[0].last_text().as_deref(),
        Some("actual owner request")
    );
    assert_eq!(messages[1].last_text().as_deref(), Some("<noop/>"));
}

#[test]
fn notification_turn_with_tool_activity_preserves_noop_as_text() {
    let request = AgentAction::notification(vec![Notification {
        id: macro_uuid::generate_uuid_v7(),
        subject_id: "app".into(),
        created_at: "2026-10-21T00:00:00Z".into(),
        event: NotificationEvent::AppConnected {
            app: "Calendar".into(),
        },
    }])
    .to_runtime(&SessionId::new("s"), RequestId::Str("event".into()))
    .unwrap();
    let mut frames = vec![AgentSessionLog {
        agent_session_id: test_session(),
        user_id: None,
        content: Message::Notification(request),
        logged_at: None,
    }];
    frames.extend(parse_log(r#"
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"tool_call","toolCallId":"send","title":"SendEmail","kind":"other","status":"completed"}}}}
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"<noop/>"}}}}}
{"direction":"to_server","content":{"type":"acp","jsonrpc":"2.0","id":"event","result":{"stopReason":"end_turn"}}}
"#));
    let messages = fold(frames);
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].last_text().as_deref(), Some("<noop/>"));
}
