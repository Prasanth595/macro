use serde_json::json;

use super::*;
use crate::domain::event_trigger::EventEntityType;

fn variable(key: &str, kind: VariableKind) -> FillVariable {
    FillVariable {
        key: VariableKey::try_from(key.to_owned()).unwrap(),
        kind,
        label: key.to_owned(),
        description: String::new(),
        current: None,
    }
}

#[test]
fn proposals_keep_only_requested_well_shaped_values() {
    let variables = [
        variable("agent", VariableKind::Agent),
        variable("schedule", VariableKind::Schedule),
        variable("person", VariableKind::User),
        variable("customer", VariableKind::Text),
        variable(
            "thread",
            VariableKind::EventEntity {
                entity_type: EventEntityType::EmailThread,
            },
        ),
        variable("channel", VariableKind::Channel),
    ];
    let raw: RawFill = serde_json::from_value(json!({
        "name": "Initech digest",
        "variables": [
            {"key": "agent", "agent_id": "0199f000-0000-7000-8000-0000000000aa", "reason": "r", "confidence": "high"},
            {"key": "schedule", "cron": "0 0 9 * * Mon", "timezone": "UTC", "reason": "r", "confidence": "check"},
            {"key": "person", "user_id": "bo@macro.com", "reason": "r", "confidence": "high"},
            {"key": "customer", "text": "Initech", "reason": "r", "confidence": "high"},
            {"key": "thread", "id": "0199f000-0000-7000-8000-000000000003", "name": "Renewal", "reason": "r", "confidence": "high"},
            {"key": "channel", "id": "not-a-uuid", "reason": "r", "confidence": "high"},
            {"key": "unrequested", "text": "x", "reason": "r", "confidence": "high"},
            {"key": "agent", "reason": "missing id", "confidence": "high"}
        ]
    }))
    .unwrap();

    let proposals = proposals(raw, &variables, 4);

    assert_eq!(proposals.tool_calls, 4);
    assert_eq!(proposals.name.as_deref(), Some("Initech digest"));
    let values: Vec<_> = proposals
        .proposals
        .iter()
        .map(|proposal| (proposal.key.to_string(), serde_json::to_value(&proposal.value).unwrap()))
        .collect();
    assert_eq!(
        values,
        [
            (
                "agent".to_owned(),
                json!({"type": "agent", "target": {"kind": "agent", "bot_id": "0199f000-0000-7000-8000-0000000000aa"}})
            ),
            (
                "schedule".to_owned(),
                json!({"type": "schedule", "cron": "0 0 9 * * Mon", "timezone": "UTC"})
            ),
            (
                "person".to_owned(),
                json!({"type": "user", "user_id": "macro|bo@macro.com"})
            ),
            ("customer".to_owned(), json!({"type": "text", "text": "Initech"})),
            (
                "thread".to_owned(),
                json!({"type": "entity", "id": "0199f000-0000-7000-8000-000000000003", "name": "Renewal"})
            ),
        ]
    );
}

#[test]
fn request_schemas_fit_the_cognition_limits() {
    for schema in [draft_schema(), fill_schema()] {
        let request = request("system", &json!({"a": 1}), schema).unwrap();
        request.validate().unwrap();
    }
}
