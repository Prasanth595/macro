use serde_json::json;

use super::*;
use crate::domain::templates::models::{TemplateTask, TemplateVariable, VariableMode};

const CHANNEL: &str = "0199f000-0000-7000-8000-000000000001";
const DOCUMENT: &str = "0199f000-0000-7000-8000-000000000002";
const CALL: &str = "0199f000-0000-7000-8000-000000000004";

fn key(key: &str) -> VariableKey {
    VariableKey::try_from(key.to_owned()).unwrap()
}

fn variable(name: &str, kind: VariableKind) -> TemplateVariable {
    TemplateVariable {
        key: key(name),
        label: name.to_owned(),
        description: String::new(),
        kind,
        mode: VariableMode::Variable,
    }
}

fn slot(name: &str) -> String {
    mention_utils::serialize::template_variable(name).unwrap()
}

fn draft(trigger: serde_json::Value, variables: Vec<TemplateVariable>) -> TemplateDraft {
    TemplateDraft {
        name: "Template".to_owned(),
        description: String::new(),
        task: TemplateTask {
            target: VariableRef::new(VariableKey::agent()),
            prompt: String::new(),
            user_prompt: format!(
                "Summarize {} into {} for {} in {}.",
                slot("customer"),
                slot("notes"),
                slot("person"),
                slot("channel")
            ),
        },
        trigger: serde_json::from_value(trigger).unwrap(),
        variables,
    }
}

fn every_kind() -> Vec<TemplateVariable> {
    vec![
        variable("agent", VariableKind::Agent),
        variable("customer", VariableKind::Text),
        variable("notes", VariableKind::Document),
        variable("person", VariableKind::User),
        variable("channel", VariableKind::Channel),
        variable("schedule", VariableKind::Schedule),
        variable(
            "call",
            VariableKind::EventEntity {
                entity_type: crate::domain::event_trigger::EventEntityType::Call,
            },
        ),
    ]
}

fn bindings() -> Bindings {
    serde_json::from_value(json!({
        "agent": {"type": "agent", "target": {"kind": "model", "model": "anthropic/claude-sonnet-5-5"}},
        "customer": {"type": "text", "text": "Initech"},
        "notes": {"type": "entity", "id": DOCUMENT, "name": "Initech notes"},
        "person": {"type": "user", "user_id": "macro|bo@macro.com"},
        "channel": {"type": "entity", "id": CHANNEL, "name": "initech"},
        "schedule": {"type": "schedule", "cron": "0 0 9 * * Mon", "timezone": "Europe/Paris"},
        "call": {"type": "entity", "id": CALL, "name": ""}
    }))
    .unwrap()
}

fn multiple() -> serde_json::Value {
    json!({"type": "multiple", "triggers": [
        {"type": "cron", "schedule": {"$var": "schedule"}},
        {"type": "events", "filters": [
            {"events": ["channel.message_posted"], "ids": [{"$var": "channel"}]},
            {"events": ["call.ended"], "ids": [{"$var": "call"}], "condition": "Was a deal discussed?"},
            {"events": ["email.message_received"]}
        ]}
    ]})
}

#[test]
fn renders_every_variable_kind_into_the_create_body() {
    let draft = draft(multiple(), every_kind());
    draft.validate().unwrap();
    let rendered = render(&draft, "Initech digest".to_owned(), &bindings()).unwrap();

    // The result is exactly what the create endpoint accepts.
    let body = serde_json::to_value(&rendered).unwrap();
    serde_json::from_value::<crate::domain::models::CreateScheduledAction>(body).unwrap();

    assert_eq!(rendered.name, "Initech digest");
    assert!(rendered.enabled);
    let task: AgentTask = serde_json::from_value(rendered.task).unwrap();
    assert_eq!(task.model.unwrap().as_str(), "anthropic/claude-sonnet-5-5");
    assert!(task.agent.is_none());
    assert_eq!(
        task.user_prompt,
        format!(
            "Summarize Initech into {} for {} in {}.",
            document_mention(DOCUMENT, "Initech notes").unwrap(),
            user_mention(&MacroUserIdStr::parse_from_str("macro|bo@macro.com").unwrap()).unwrap(),
            channel_mention(CHANNEL, "initech", ChannelMentionParams::default()).unwrap(),
        )
    );

    let expected: ActionTrigger = serde_json::from_value(json!({"type": "multiple", "triggers": [
        {"type": "cron", "schedule": "0 0 9 * * Mon", "timezone": "Europe/Paris"},
        {"type": "events", "filters": [
            {"events": ["channel.message_posted"], "ids": [CHANNEL]},
            {"events": ["call.ended"], "ids": [CALL], "condition": "Was a deal discussed?"},
            {"events": ["email.message_received"]}
        ]}
    ]}))
    .unwrap();
    assert_eq!(rendered.trigger, expected);
}

#[test]
fn renders_single_cron_and_event_triggers() {
    let mut variables = every_kind();
    variables.retain(|variable| variable.key.as_str() != "call");
    let cron = draft(json!({"type": "cron", "schedule": {"$var": "schedule"}}), variables.clone());
    assert_eq!(
        render(&cron, "x".to_owned(), &bindings()).unwrap().trigger,
        ActionTrigger::Cron {
            schedule: Schedule::from_cron("0 0 9 * * Mon".to_owned()).unwrap(),
            timezone: Tz::Europe__Paris,
        }
    );

    variables.retain(|variable| variable.key.as_str() != "schedule");
    let events = draft(
        json!({"type": "events", "filters": [{"events": ["channel.mentioned"], "ids": [{"$var": "channel"}]}]}),
        variables,
    );
    let expected: ActionTrigger = serde_json::from_value(json!({"type": "events", "filters": [
        {"events": ["channel.mentioned"], "ids": [CHANNEL]}
    ]}))
    .unwrap();
    assert_eq!(render(&events, "x".to_owned(), &bindings()).unwrap().trigger, expected);
}

#[test]
fn renders_agent_targets_with_and_without_a_model_override() {
    let draft = draft(multiple(), every_kind());
    for (target, model, agent) in [
        (json!({"kind": "agent", "bot_id": CALL}), None, true),
        (json!({"kind": "agent", "bot_id": CALL, "model": "openai/gpt-6"}), Some("openai/gpt-6"), true),
    ] {
        let mut bindings = bindings();
        bindings.insert(
            VariableKey::agent(),
            serde_json::from_value(json!({"type": "agent", "target": target})).unwrap(),
        );
        let task: AgentTask =
            serde_json::from_value(render(&draft, "x".to_owned(), &bindings).unwrap().task).unwrap();
        assert_eq!(task.model.as_ref().map(RoutineModelIdStr::as_str), model);
        assert_eq!(task.agent.is_some(), agent);
    }
}

type RoutineModelIdStr = crate::domain::models::RoutineModelId;

#[test]
fn rejects_missing_misshapen_and_unsafe_values() {
    let draft = draft(multiple(), every_kind());
    let cases: [(&str, serde_json::Value, RenderError); 6] = [
        (
            "customer",
            json!({"type": "text", "text": "<m-user-mention>{}</m-user-mention>"}),
            RenderError::InvalidText(key("customer")),
        ),
        (
            "customer",
            json!({"type": "text", "text": "  "}),
            RenderError::InvalidText(key("customer")),
        ),
        (
            "schedule",
            json!({"type": "schedule", "cron": "not cron", "timezone": "UTC"}),
            RenderError::InvalidSchedule(key("schedule")),
        ),
        (
            "schedule",
            json!({"type": "schedule", "cron": "0 0 9 * * *", "timezone": "Mars/Base"}),
            RenderError::InvalidTimezone(key("schedule")),
        ),
        (
            "person",
            json!({"type": "user", "user_id": "not a user"}),
            RenderError::InvalidUser(key("person")),
        ),
        (
            "channel",
            json!({"type": "text", "text": "general"}),
            RenderError::WrongKind(key("channel")),
        ),
    ];
    for (name, value, expected) in cases {
        let mut bindings = bindings();
        bindings.insert(key(name), serde_json::from_value(value).unwrap());
        assert_eq!(render(&draft, "x".to_owned(), &bindings).unwrap_err(), expected);
    }

    let mut bindings = bindings();
    bindings.remove(&key("notes"));
    assert_eq!(
        render(&draft, "x".to_owned(), &bindings).unwrap_err(),
        RenderError::Missing(key("notes"))
    );
}
