use std::sync::Arc;

use agent::types::AssistantMessagePart;
use agent_client_protocol::schema::v1::RequestId;
use agent_runtime_protocol::domain::action::PromptAttachment;
use agent_session::domain::model::AgentSessionId;

use super::*;
use crate::domain::session::{SessionState, UserPrompt};

/// A prompt, under its text as the id of the request that carried it.
fn prompted(prompt: UserPrompt) -> HistoryEntry {
    HistoryEntry::User {
        request_id: RequestId::Str(prompt.text.clone()),
        prompt,
    }
}

fn user(text: &str) -> HistoryEntry {
    prompted(UserPrompt::text(text))
}

fn agent(text: &str) -> HistoryEntry {
    HistoryEntry::Assistant(vec![AssistantMessagePart::Text {
        text: text.to_owned(),
    }])
}

fn found(search: &HistorySearch) -> Vec<(usize, &Source, &str)> {
    search
        .matches
        .iter()
        .map(|found| (found.turn, &found.source, found.excerpt.as_str()))
        .collect()
}

#[test]
fn more_of_the_words_rank_first_the_phrase_above_them_and_the_latest_among_equals() {
    let entries = [
        user("the launch is on Tuesday"),
        agent("noted: launch Tuesday"),
        user("the launch plan needs a budget"),
        agent("I will draft the launch plan"),
        user("what about the budget"),
    ];

    let search = search(&entries, "Launch Plan", 10);

    assert_eq!(search.turns, 3);
    assert_eq!(
        found(&search),
        [
            (2, &Source::Agent, "I will draft the launch plan"),
            (2, &Source::User, "the launch plan needs a budget"),
            (1, &Source::Agent, "noted: launch Tuesday"),
            (1, &Source::User, "the launch is on Tuesday"),
        ],
        "the phrase twice, newest first, then the word alone"
    );
}

#[test]
fn tool_calls_and_results_are_searched_by_what_they_carried() {
    let entries = [
        user("find the Q3 numbers"),
        HistoryEntry::Assistant(vec![
            AssistantMessagePart::Thinking {
                thinking: "revenue is probably in the deck".to_owned(),
            },
            AssistantMessagePart::ToolCall {
                name: "ReadDocument".to_owned(),
                json: serde_json::json!({"documentId": "doc-42"}),
                id: "call-1".to_owned(),
            },
            AssistantMessagePart::ToolCallResponseJson {
                name: "ReadDocument".to_owned(),
                json: serde_json::json!({"revenue": "4.2M"}),
                id: "call-1".to_owned(),
            },
        ]),
    ];

    let call = search(&entries, "doc-42", 5);
    assert_eq!(
        found(&call),
        [(
            1,
            &Source::ToolCall("ReadDocument".to_owned()),
            r#"{"documentId":"doc-42"}"#
        )]
    );
    let result = search(&entries, "revenue", 5);
    assert_eq!(
        found(&result),
        [(
            1,
            &Source::ToolResult("ReadDocument".to_owned()),
            r#"{"revenue":"4.2M"}"#
        )],
        "reasoning is not the conversation"
    );
}

#[test]
fn a_summary_is_not_what_was_said() {
    let entries = [
        HistoryEntry::Summary("The user chose blue.".to_owned()),
        user("blue it is"),
    ];

    assert_eq!(
        found(&search(&entries, "blue", 5)),
        [(1, &Source::User, "blue it is")]
    );
}

#[test]
fn attached_files_are_found_by_name() {
    let mut prompt = UserPrompt::text("here it is");
    prompt.attachments.push(PromptAttachment::new(
        "https://static.example/file/1",
        "contract.pdf",
    ));

    let search = search(&[prompted(prompt)], "contract", 5);
    assert_eq!(
        found(&search),
        [(1, &Source::User, "here it is\n[file: contract.pdf]")]
    );
}

#[test]
fn an_excerpt_is_cut_around_its_match_on_character_boundaries() {
    let text = format!("{}needle{}", "é".repeat(400), "ü".repeat(800));

    let search = search(&[user(&text)], "needle", 1);
    let excerpt = &search.matches[0].excerpt;

    assert!(excerpt.starts_with('…') && excerpt.ends_with('…'));
    assert!(excerpt.contains("needle"));
    assert!(excerpt.len() < text.len());
}

#[test]
fn the_limit_bounds_what_comes_back_and_nothing_found_is_nothing() {
    let entries: Vec<_> = (0..10).map(|turn| user(&format!("note {turn}"))).collect();

    assert_eq!(search(&entries, "note", 3).matches.len(), 3);
    assert!(search(&entries, "absent", 3).matches.is_empty());
    assert!(search(&entries, " ?! ", 3).matches.is_empty());
}

#[test]
fn a_session_is_searched_through_what_summaries_replaced_and_what_followed() {
    let store = Arc::new(SessionStore::new());
    let session = AgentSessionId::new();
    let mut state = SessionState::new("anthropic/claude-sonnet-5-5".to_owned());
    state.archive = vec![user("the vendor is Acme"), agent("noted")];
    state.history = vec![
        HistoryEntry::Summary("A vendor was chosen.".to_owned()),
        user("email the vendor"),
    ];
    store.insert(session, state);

    let search = SessionHistory::new(store, session).search("vendor", 5);

    assert_eq!(search.turns, 2);
    assert_eq!(
        found(&search),
        [
            (2, &Source::User, "email the vendor"),
            (1, &Source::User, "the vendor is Acme"),
        ]
    );
}
