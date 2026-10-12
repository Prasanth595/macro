//! Finding what was said earlier in a session, summarized or not.
//!
//! A summary keeps the model's context bounded and loses exact words. The
//! session keeps every entry a summary stood in for
//! ([`SessionState::archive`](super::session::SessionState::archive)), so the
//! model can find them again: `SearchHistory` reads them here, along with
//! what it still has in context.

use std::sync::Arc;

use agent::types::AssistantMessagePart;
use agent_session::domain::model::AgentSessionId;

use super::session::{HistoryEntry, SessionStore};

#[cfg(test)]
mod test;

/// The name `SearchHistory` goes by in the conversation it searches.
pub const SEARCH_HISTORY_TOOL: &str = "SearchHistory";

/// How much of a passage comes back before its match, in bytes.
const EXCERPT_BEFORE: usize = 300;
/// And after it, where what was found usually goes on.
const EXCERPT_AFTER: usize = 700;

/// One session's whole conversation, read where it lives.
#[derive(Clone)]
pub struct SessionHistory {
    store: Arc<SessionStore>,
    session: AgentSessionId,
}

impl SessionHistory {
    /// The conversation of `session`, as `store` holds it.
    #[must_use]
    pub fn new(store: Arc<SessionStore>, session: AgentSessionId) -> Self {
        Self { store, session }
    }

    /// Up to `limit` passages matching `query`, best first.
    #[must_use]
    pub fn search(&self, query: &str, limit: usize) -> HistorySearch {
        let Some(state) = self.store.get(&self.session) else {
            return HistorySearch::default();
        };
        search(state.archive.iter().chain(&state.history), query, limit)
    }
}

/// What a search found.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct HistorySearch {
    /// The passages, best first.
    pub matches: Vec<HistoryMatch>,
    /// How many turns the conversation has, for placing them.
    pub turns: usize,
}

/// A passage of the conversation that matched.
#[derive(Debug, PartialEq, Eq)]
pub struct HistoryMatch {
    /// The turn it belongs to, counting the conversation's prompts from 1.
    pub turn: usize,
    /// Where it came from.
    pub source: Source,
    /// The words around the match.
    pub excerpt: String,
}

/// Who said a passage.
#[derive(Debug, PartialEq, Eq)]
pub enum Source {
    /// The person prompting.
    User,
    /// The agent, in its reply.
    Agent,
    /// The agent calling a tool, by the tool's name; the passage is the call's input.
    ToolCall(String),
    /// What a tool returned, by the tool's name.
    ToolResult(String),
}

/// Search `entries` for `query`: a passage matching more of its words ranks
/// first, the whole phrase ranks above any of its words, and among equals
/// the most recent comes first. Case is ignored for ASCII letters.
#[must_use]
pub fn search<'a>(
    entries: impl IntoIterator<Item = &'a HistoryEntry>,
    query: &str,
    limit: usize,
) -> HistorySearch {
    let phrase = query.trim().to_ascii_lowercase();
    let mut terms: Vec<&str> = Vec::new();
    for term in phrase.split(|character: char| !character.is_alphanumeric()) {
        if !term.is_empty() && !terms.contains(&term) {
            terms.push(term);
        }
    }
    let mut turns = 0;
    let mut found = Vec::new();
    for entry in entries {
        let passages: Vec<(Source, String)> = match entry {
            // A summary is not what was said; what it stands for is in the
            // archive, word for word.
            HistoryEntry::Summary(_) => continue,
            HistoryEntry::User { prompt, .. } => {
                turns += 1;
                let mut text = prompt.text.clone();
                for attachment in &prompt.attachments {
                    text.push_str(&format!("\n[file: {}]", attachment.name));
                }
                vec![(Source::User, text)]
            }
            HistoryEntry::Assistant(parts) => parts.iter().filter_map(passage).collect(),
        };
        for (source, text) in passages {
            if let Some((score, at, len)) = best_match(&text, &phrase, &terms) {
                found.push((
                    score,
                    found.len(),
                    HistoryMatch {
                        turn: turns,
                        source,
                        excerpt: excerpt(&text, at, len),
                    },
                ));
            }
        }
    }
    found.sort_by(|(score, order, _), (other, other_order, _)| {
        other.cmp(score).then(other_order.cmp(order))
    });
    HistorySearch {
        matches: found
            .into_iter()
            .take(limit)
            .map(|(_, _, found)| found)
            .collect(),
        turns,
    }
}

/// What one assistant part says, and who said it. Reasoning is the agent
/// thinking, not the conversation, and is left out. So is every earlier
/// search: its query and the excerpts it returned repeat what it found, and
/// being newer they would rank above the passages themselves.
fn passage(part: &AssistantMessagePart) -> Option<(Source, String)> {
    Some(match part {
        AssistantMessagePart::Thinking { .. } => return None,
        AssistantMessagePart::ToolCall { name, .. }
        | AssistantMessagePart::ToolCallResponseJson { name, .. }
        | AssistantMessagePart::ToolCallErr { name, .. }
            if name == SEARCH_HISTORY_TOOL =>
        {
            return None;
        }
        AssistantMessagePart::Text { text } => (Source::Agent, text.clone()),
        AssistantMessagePart::ToolCall { name, json, .. }
        | AssistantMessagePart::McpToolCall { name, json, .. } => {
            (Source::ToolCall(name.clone()), json.to_string())
        }
        AssistantMessagePart::ToolCallResponseJson { name, json, .. } => {
            (Source::ToolResult(name.clone()), json.to_string())
        }
        AssistantMessagePart::ToolCallErr {
            name, description, ..
        } => (Source::ToolResult(name.clone()), description.clone()),
    })
}

/// How well `text` matches - one point per word found, and as many again
/// for the whole phrase - with where the match to show starts and how long
/// it is. `None` when no word is found.
fn best_match(text: &str, phrase: &str, terms: &[&str]) -> Option<(usize, usize, usize)> {
    // ASCII lowering keeps every byte where it was, so a position found in
    // the lowered text is the same position in the original.
    let haystack = text.to_ascii_lowercase();
    let mut score = 0;
    let mut first: Option<(usize, usize)> = None;
    for term in terms {
        if let Some(at) = haystack.find(term) {
            score += 1;
            if first.is_none_or(|(earliest, _)| at < earliest) {
                first = Some((at, term.len()));
            }
        }
    }
    let (at, len) = first?;
    if terms.len() > 1
        && let Some(whole) = haystack.find(phrase)
    {
        return Some((score + terms.len(), whole, phrase.len()));
    }
    Some((score, at, len))
}

/// The text around `at..at + len`, marked where it was cut.
fn excerpt(text: &str, at: usize, len: usize) -> String {
    let mut start = at.saturating_sub(EXCERPT_BEFORE);
    while !text.is_char_boundary(start) {
        start -= 1;
    }
    let mut end = (at + len + EXCERPT_AFTER).min(text.len());
    while !text.is_char_boundary(end) {
        end += 1;
    }
    let mut excerpt = String::new();
    if start > 0 {
        excerpt.push('…');
    }
    excerpt.push_str(&text[start..end]);
    if end < text.len() {
        excerpt.push('…');
    }
    excerpt
}
