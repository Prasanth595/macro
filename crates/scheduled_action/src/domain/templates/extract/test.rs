use chrono::Utc;
use model_owner::Owner;
use serde_json::{Value, json};

use super::*;
use crate::domain::event_runs::ConfigurationRevision;
use crate::domain::models::{ActionConfiguration, ActionKind};
use crate::domain::templates::ports::{TextSuggestion, VariableSuggestion};
use crate::domain::templates::render::render;

const CHANNEL: &str = "0199f000-0000-7000-8000-000000000001";
const DOCUMENT: &str = "0199f000-0000-7000-8000-000000000002";
const THREAD: &str = "0199f000-0000-7000-8000-000000000003";
const AGENT: &str = "0199f000-0000-7000-8000-0000000000aa";

fn action(task: Value, trigger: Value) -> ScheduledAction {
    let now = Utc::now();
    ScheduledAction {
        id: Some(Uuid::now_v7()),
        owner: Owner::from_principal_str("macro|creator@macro.com").unwrap(),
        name: "Triage Globex email".to_owned(),
        trigger: serde_json::from_value(trigger).unwrap(),
        kind: ActionKind::Agent,
        created_at: now,
        updated_at: now,
        configuration_revision: ConfigurationRevision::INITIAL,
        event_activated_at: None,
        task,
        claimed: None,
        next_run_at: None,
        enabled: true,
    }
}

fn instructions() -> String {
    format!(
        concat!(
            "Read new email from globex.com and post a summary to ",
            r#"<m-document-mention>{{"documentId":"{channel}","blockName":"channel","documentName":"urgent","blockParams":{{}},"collapsed":false}}</m-document-mention>"#,
            ", cc ",
            r#"<m-user-mention>{{"userId":"macro|ana@macro.com","email":"ana@macro.com"}}</m-user-mention>"#,
            " and update ",
            r#"<m-document-mention>{{"documentId":"{document}","blockName":"md","documentName":"Globex notes","blockParams":{{}},"collapsed":false}}</m-document-mention>"#,
            ". Ping ",
            r#"<m-user-mention>{{"userId":"macro|ana@macro.com","email":"ana@macro.com"}}</m-user-mention>"#,
            " if it's urgent."
        ),
        channel = CHANNEL,
        document = DOCUMENT,
    )
}

fn multiple_trigger() -> Value {
    json!({"type": "multiple", "triggers": [
        {"type": "cron", "schedule": "0 0 9 * * Mon", "timezone": "America/New_York"},
        {"type": "events", "filters": [
            {"events": ["channel.message_posted"], "ids": [CHANNEL]},
            {"events": ["email.message_received"], "ids": [THREAD], "condition": "Is this urgent?"},
            {"events": ["email.message_received"]}
        ]}
    ]})
}

fn rendered_back(action: &ScheduledAction) -> ActionConfiguration {
    let extraction = extract(action).unwrap();
    extraction.draft.validate().unwrap();
    render(
        &extraction.draft,
        action.name.clone(),
        &extraction.creator_values,
    )
    .unwrap()
}

#[test]
fn rendering_the_creators_values_reproduces_the_routine() {
    for task in [
        json!({"agent": {"bot_id": AGENT}, "prompt": "", "user_prompt": instructions()}),
        json!({"model": "anthropic/claude-sonnet-5-5", "prompt": "", "user_prompt": instructions()}),
        json!({"agent": {"bot_id": AGENT}, "model": "openai/gpt-6", "prompt": "", "user_prompt": "Plain"}),
    ] {
        for trigger in [
            multiple_trigger(),
            json!({"type": "cron", "schedule": "0 30 8 * * *", "timezone": "UTC"}),
            json!({"type": "events", "filters": [{"events": ["document.updated"], "ids": [DOCUMENT]}]}),
        ] {
            let action = action(task.clone(), trigger);
            let rendered = rendered_back(&action);
            let expected_task: AgentTask = serde_json::from_value(action.task.clone()).unwrap();
            assert_eq!(rendered.task, serde_json::to_value(expected_task).unwrap());
            assert_eq!(rendered.trigger, action.trigger);
            assert_eq!(rendered.name, action.name);
        }
    }
}

#[test]
fn every_person_specific_value_becomes_one_variable() {
    let action = action(
        json!({"agent": {"bot_id": AGENT}, "prompt": "", "user_prompt": instructions()}),
        multiple_trigger(),
    );
    let extraction = extract(&action).unwrap();
    let draft = &extraction.draft;

    let kinds: Vec<_> = draft
        .variables
        .iter()
        .map(|variable| (variable.key.as_str(), variable.kind))
        .collect();
    assert_eq!(
        kinds,
        [
            ("agent", VariableKind::Agent),
            ("channel", VariableKind::Channel),
            ("person", VariableKind::User),
            ("document", VariableKind::Document),
            ("schedule", VariableKind::Schedule),
            (
                "email_thread",
                VariableKind::EventEntity {
                    entity_type: EventEntityType::EmailThread
                }
            ),
        ]
    );
    // The mentioned channel and the watched channel are the same variable,
    // and the person mentioned twice is one variable.
    assert_eq!(draft.instruction_keys().len(), 4);
    assert!(!draft.task.user_prompt.contains(CHANNEL));
    assert!(!draft.task.user_prompt.contains("ana@macro.com"));
    assert!(!draft.task.user_prompt.contains("Globex notes"));
    // Filters without ids stay relative to whoever owns the routine.
    assert!(
        draft
            .trigger
            .event_filters()
            .iter()
            .any(|filter| filter.ids.is_none())
    );
}

#[test]
fn only_schedules_start_fixed_and_variable_slots_keep_no_value() {
    let action = action(
        json!({"agent": {"bot_id": AGENT}, "prompt": "", "user_prompt": instructions()}),
        multiple_trigger(),
    );
    let extraction = extract(&action).unwrap();
    for variable in &extraction.draft.variables {
        let fixed = matches!(variable.mode, VariableMode::Fixed { .. });
        assert_eq!(
            fixed,
            variable.kind == VariableKind::Schedule,
            "{}",
            variable.key
        );
    }
    let stored = serde_json::to_string(&extraction.draft).unwrap();
    assert!(!stored.contains(AGENT));
    assert!(!stored.contains("ana@macro.com"));
    assert!(!stored.contains(THREAD));
}

#[test]
fn suggestions_rename_fix_and_pull_out_text() {
    let action = action(
        json!({"agent": {"bot_id": AGENT}, "prompt": "", "user_prompt": instructions()}),
        multiple_trigger(),
    );
    let extraction = extract(&action).unwrap();
    let refined = apply_suggestions(
        extraction,
        DraftSuggestions {
            name: Some("Customer email triage".to_owned()),
            description: Some("Summarizes a customer's email.".to_owned()),
            variables: vec![
                VariableSuggestion {
                    key: "channel".to_owned(),
                    label: "Urgent channel".to_owned(),
                    description: "Where summaries go.".to_owned(),
                    fixed: true,
                },
                VariableSuggestion {
                    key: "agent".to_owned(),
                    label: "Agent".to_owned(),
                    description: "Runs it.".to_owned(),
                    fixed: true,
                },
                VariableSuggestion {
                    key: "missing".to_owned(),
                    label: "Ignored".to_owned(),
                    description: "Ignored.".to_owned(),
                    fixed: false,
                },
            ],
            text_variables: vec![
                TextSuggestion {
                    text: "globex.com".to_owned(),
                    key: "customer_domain".to_owned(),
                    label: "Customer domain".to_owned(),
                    description: "The customer's email domain.".to_owned(),
                    fixed: false,
                },
                TextSuggestion {
                    text: "not in the instructions".to_owned(),
                    key: "ghost".to_owned(),
                    label: "Ghost".to_owned(),
                    description: "Ignored.".to_owned(),
                    fixed: false,
                },
            ],
        },
    );
    let draft = &refined.draft;
    assert_eq!(draft.name, "Customer email triage");
    let channel = draft
        .variable(&VariableKey::try_from("channel".to_owned()).unwrap())
        .unwrap();
    assert_eq!(channel.label, "Urgent channel");
    assert!(matches!(channel.mode, VariableMode::Fixed { .. }));
    let agent = draft.variable(&VariableKey::agent()).unwrap();
    assert_eq!(agent.mode, VariableMode::Variable);
    let domain = VariableKey::try_from("customer_domain".to_owned()).unwrap();
    assert_eq!(draft.variable(&domain).unwrap().kind, VariableKind::Text);
    assert!(!draft.task.user_prompt.contains("globex.com"));
    assert!(
        draft
            .variable(&VariableKey::try_from("ghost".to_owned()).unwrap())
            .is_none()
    );

    // The creator's own values still render the original routine.
    let rendered = render(draft, action.name.clone(), &refined.creator_values).unwrap();
    let original: AgentTask = serde_json::from_value(action.task.clone()).unwrap();
    assert_eq!(rendered.task, serde_json::to_value(original).unwrap());
}

#[test]
fn suggestions_that_break_the_template_are_discarded() {
    let action = action(
        json!({"agent": {"bot_id": AGENT}, "prompt": "", "user_prompt": "Say hi"}),
        json!({"type": "cron", "schedule": "0 30 8 * * *", "timezone": "UTC"}),
    );
    let extraction = extract(&action).unwrap();
    let refined = apply_suggestions(
        extraction.clone(),
        DraftSuggestions {
            text_variables: vec![TextSuggestion {
                text: "hi".to_owned(),
                key: "agent".to_owned(),
                label: "Greeting".to_owned(),
                description: "Clashes with the agent key.".to_owned(),
                fixed: false,
            }],
            ..DraftSuggestions::default()
        },
    );
    assert_eq!(refined, extraction);
}
