//! Agent drafts awaiting the recipient's approval.

use async_graphql::{Enum, ID, Object};
use model_notifications::{AgentReviewKind, AgentReviewRequestedMetadata};

use super::GraphqlAgentSessionRef;

/// What submitting an agent review does.
#[derive(Clone, Copy, Debug, Eq, Enum, PartialEq)]
pub enum GraphqlAgentReviewKind {
    /// Sends the drafted emails.
    Email,
    /// Creates the drafted calendar events.
    Calendar,
}

impl From<AgentReviewKind> for GraphqlAgentReviewKind {
    fn from(value: AgentReviewKind) -> Self {
        match value {
            AgentReviewKind::Email => Self::Email,
            AgentReviewKind::Calendar => Self::Calendar,
        }
    }
}

/// GraphQL wrapper for an agent review awaiting approval.
pub struct GraphqlAgentReviewRequestedMetadata(pub(super) AgentReviewRequestedMetadata);

/// Metadata for drafts an agent presented for the recipient to submit or
/// dismiss.
#[Object]
impl GraphqlAgentReviewRequestedMetadata {
    /// The session the review belongs to.
    async fn session(&self) -> GraphqlAgentSessionRef {
        GraphqlAgentSessionRef(self.0.session.clone())
    }

    /// The review awaiting a decision, within the session.
    async fn review_id(&self) -> ID {
        ID(self.0.review_id.to_string())
    }

    /// What submitting the review does.
    async fn review_kind(&self) -> GraphqlAgentReviewKind {
        self.0.review_kind.into()
    }

    /// The review's label, as the agent wrote it.
    async fn title(&self) -> &str {
        &self.0.title
    }

    /// How many drafts wait for a decision.
    async fn draft_count(&self) -> i32 {
        i32::try_from(self.0.draft_count).unwrap_or(i32::MAX)
    }

    /// Every drafted email replies to an existing message.
    async fn replies(&self) -> bool {
        self.0.replies
    }

    /// The first draft's subject or event title, when it has one.
    async fn preview(&self) -> Option<&str> {
        self.0.preview.as_deref()
    }
}
