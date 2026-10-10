//! Model-callable search over the session's own conversation.

use ai_toolset::{
    AsyncTool, RequestContext, ServiceContext, ToolAnnotated, ToolAnnotations, ToolCallError,
    ToolResult,
};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::domain::history_search::{HistoryMatch, SessionHistory, Source};

/// How many passages come back when the model does not say.
const DEFAULT_LIMIT: usize = 5;
/// The most passages one search returns.
const MAX_LIMIT: usize = 20;

/// Context required by [`SearchHistory`].
#[derive(Clone)]
pub struct SearchHistoryContext {
    /// The session's conversation. `None` leaves nothing to search.
    pub history: Option<SessionHistory>,
}

/// Search the conversation so far, including what was summarized.
#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(
    title = "SearchHistory",
    description = "Search this conversation's earlier messages, tool calls and tool results by their words, including the parts summarized out of your context. Use it when you need exact wording, numbers, identifiers or results from earlier in the conversation that your context no longer shows."
)]
pub struct SearchHistory {
    /// Words to look for.
    #[schemars(
        description = "Words to look for. Passages with more of them rank first, and the exact phrase ranks above its words apart."
    )]
    pub query: String,
    /// How many passages to return.
    #[serde(default)]
    #[schemars(description = "How many passages to return, from 1 to 20. Defaults to 5.")]
    pub limit: Option<usize>,
}

/// What the search found, best first.
#[derive(Debug, Serialize, JsonSchema)]
pub struct SearchHistoryResponse {
    /// The passages that matched, best first.
    pub matches: Vec<HistoryPassage>,
    /// How many turns the conversation has had, for placing them.
    pub turns: usize,
}

/// One passage that matched.
#[derive(Debug, Serialize, JsonSchema)]
pub struct HistoryPassage {
    /// The turn it belongs to, counting the conversation's messages from 1.
    pub turn: usize,
    /// Who it came from: `user`, `agent`, `tool_call` or `tool_result`.
    pub from: &'static str,
    /// The tool, for a tool call or result.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool: Option<String>,
    /// The words around the match; `…` marks where they were cut.
    pub excerpt: String,
}

impl From<HistoryMatch> for HistoryPassage {
    fn from(found: HistoryMatch) -> Self {
        let (from, tool) = match found.source {
            Source::User => ("user", None),
            Source::Agent => ("agent", None),
            Source::ToolCall(tool) => ("tool_call", Some(tool)),
            Source::ToolResult(tool) => ("tool_result", Some(tool)),
        };
        Self {
            turn: found.turn,
            from,
            tool,
            excerpt: found.excerpt,
        }
    }
}

impl ToolAnnotated for SearchHistory {
    const ANNOTATIONS: ToolAnnotations = ToolAnnotations::read_only("Search conversation");
}

#[async_trait]
impl AsyncTool<SearchHistoryContext> for SearchHistory {
    type Output = SearchHistoryResponse;

    #[tracing::instrument(skip_all, err)]
    async fn call(
        &self,
        service_context: ServiceContext<SearchHistoryContext>,
        _request_context: RequestContext,
    ) -> ToolResult<Self::Output> {
        let history = service_context
            .history
            .as_ref()
            .ok_or_else(|| ToolCallError {
                description: "There is no conversation to search here.".to_owned(),
                internal_error: anyhow::anyhow!("the turn carried no session history"),
            })?;
        if !self.query.chars().any(char::is_alphanumeric) {
            return Err(ToolCallError {
                description: "SearchHistory needs words to look for.".to_owned(),
                internal_error: anyhow::anyhow!("empty SearchHistory query"),
            });
        }
        let limit = self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let found = history.search(&self.query, limit);
        Ok(SearchHistoryResponse {
            matches: found
                .matches
                .into_iter()
                .map(HistoryPassage::from)
                .collect(),
            turns: found.turns,
        })
    }
}

#[cfg(test)]
mod test;
