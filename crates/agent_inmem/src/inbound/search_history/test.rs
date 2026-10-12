use std::sync::Arc;

use agent_client_protocol::schema::v1::RequestId;
use agent_session::domain::model::AgentSessionId;
use ai_toolset::{AsyncTool as _, RequestContext, ServiceContext};
use macro_user_id::user_id::MacroUserIdStr;

use super::*;
use crate::domain::session::{HistoryEntry, SessionState, SessionStore, UserPrompt};

fn request_context() -> RequestContext {
    RequestContext::new(
        MacroUserIdStr::try_from("macro|search-history-test@example.com".to_owned())
            .expect("test user id should be valid"),
    )
}

/// A session whose first turns a summary replaced.
fn summarized_session() -> SearchHistoryContext {
    let store = Arc::new(SessionStore::new());
    let session = AgentSessionId::new();
    let mut state = SessionState::new("anthropic/claude-sonnet-5-5".to_owned());
    state.archive = (1..=8)
        .map(|turn| HistoryEntry::User {
            prompt: UserPrompt::text(format!("invoice {turn} is paid")),
            request_id: RequestId::Number(turn),
        })
        .collect();
    state.history = vec![HistoryEntry::Summary(
        "Eight invoices were paid.".to_owned(),
    )];
    store.insert(session, state);
    SearchHistoryContext {
        history: Some(SessionHistory::new(store, session)),
    }
}

#[tokio::test]
async fn finds_what_a_summary_replaced_five_passages_at_a_time() {
    let response = SearchHistory {
        query: "invoice".to_owned(),
        limit: None,
    }
    .call(ServiceContext(summarized_session()), request_context())
    .await
    .expect("the search should succeed");

    assert_eq!(response.turns, 8);
    assert_eq!(response.matches.len(), 5);
    let first = &response.matches[0];
    assert_eq!(
        (first.turn, first.from, first.tool.as_deref()),
        (8, "user", None)
    );
    assert_eq!(first.excerpt, "invoice 8 is paid");
}

#[tokio::test]
async fn a_limit_is_kept_between_one_and_twenty() {
    for (limit, expected) in [(0, 1), (3, 3), (500, 8)] {
        let response = SearchHistory {
            query: "paid".to_owned(),
            limit: Some(limit),
        }
        .call(ServiceContext(summarized_session()), request_context())
        .await
        .expect("the search should succeed");
        assert_eq!(response.matches.len(), expected, "limit {limit}");
    }
}

#[tokio::test]
async fn a_query_without_words_or_a_turn_without_history_is_refused() {
    let empty = SearchHistory {
        query: " ... ".to_owned(),
        limit: None,
    }
    .call(ServiceContext(summarized_session()), request_context())
    .await;
    assert!(empty.is_err());

    let nowhere = SearchHistory {
        query: "invoice".to_owned(),
        limit: None,
    }
    .call(
        ServiceContext(SearchHistoryContext { history: None }),
        request_context(),
    )
    .await;
    assert!(nowhere.is_err());
}

#[test]
fn a_tool_passage_names_its_tool() {
    let passage = HistoryPassage::from(crate::domain::history_search::HistoryMatch {
        turn: 2,
        source: Source::ToolResult("ReadDocument".to_owned()),
        excerpt: "{}".to_owned(),
    });
    assert_eq!(
        serde_json::to_value(passage).expect("a passage serializes"),
        serde_json::json!({"turn": 2, "from": "tool_result", "tool": "ReadDocument", "excerpt": "{}"})
    );
}
