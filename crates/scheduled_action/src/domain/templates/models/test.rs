use serde_json::json;

use super::*;

fn draft(value: serde_json::Value) -> TemplateDraft {
    serde_json::from_value(value).unwrap()
}

fn valid() -> serde_json::Value {
    let slot = mention_utils::serialize::template_variable("channel").unwrap();
    json!({
        "name": "Digest",
        "task": {"target": {"$var": "agent"}, "user_prompt": format!("Post to {slot}")},
        "trigger": {"type": "events", "filters": [
            {"events": ["channel.message_posted"], "ids": [{"$var": "channel"}]}
        ]},
        "variables": [
            {"key": "agent", "label": "Agent", "description": "", "kind": {"type": "agent"}, "mode": {"type": "variable"}},
            {"key": "channel", "label": "Channel", "description": "", "kind": {"type": "channel"}, "mode": {"type": "variable"}}
        ]
    })
}

#[test]
fn a_consistent_draft_validates() {
    draft(valid()).validate().unwrap();
}

#[test]
fn keys_are_lowercase_slugs() {
    for bad in ["", "Agent", "1st", "with space", "dash-ed"] {
        assert!(VariableKey::try_from(bad.to_owned()).is_err(), "{bad}");
    }
    for good in ["agent", "customer_domain", "channel_2"] {
        assert!(VariableKey::try_from(good.to_owned()).is_ok(), "{good}");
    }
}

#[test]
fn inconsistent_drafts_are_rejected() {
    let key = |key: &str| VariableKey::try_from(key.to_owned()).unwrap();
    let cases: Vec<(&str, Box<dyn Fn(&mut serde_json::Value)>, TemplateError)> = vec![
        (
            "unused variable",
            Box::new(|value| {
                value["variables"].as_array_mut().unwrap().push(json!(
                    {"key": "extra", "label": "Extra", "description": "", "kind": {"type": "text"}, "mode": {"type": "variable"}}
                ))
            }),
            TemplateError::UnusedVariable(key("extra")),
        ),
        (
            "undeclared variable",
            Box::new(|value| {
                value["trigger"]["filters"][0]["ids"] = json!([{"$var": "ghost"}]);
            }),
            TemplateError::UnknownVariable(key("ghost")),
        ),
        (
            "fixed agent",
            Box::new(|value| {
                value["variables"][0]["mode"] = json!({"type": "fixed", "value": {
                    "type": "agent", "target": {"kind": "model", "model": "m"}
                }});
            }),
            TemplateError::FixedValueMismatch(key("agent")),
        ),
        (
            "fixed value of the wrong kind",
            Box::new(|value| {
                value["variables"][1]["mode"] = json!({"type": "fixed", "value": {"type": "text", "text": "general"}});
            }),
            TemplateError::FixedValueMismatch(key("channel")),
        ),
        (
            "document id watched by a channel filter",
            Box::new(|value| {
                value["variables"][1]["kind"] = json!({"type": "document"});
            }),
            TemplateError::MisplacedVariable(key("channel")),
        ),
        (
            "no agent variable",
            Box::new(|value| {
                value["variables"].as_array_mut().unwrap().remove(0);
            }),
            TemplateError::AgentVariable,
        ),
        (
            "duplicate key",
            Box::new(|value| {
                let copy = value["variables"][1].clone();
                value["variables"].as_array_mut().unwrap().push(copy);
            }),
            TemplateError::DuplicateKey(key("channel")),
        ),
    ];
    for (case, edit, expected) in cases {
        let mut value = valid();
        edit(&mut value);
        assert_eq!(draft(value).validate().unwrap_err(), expected, "{case}");
    }
}
