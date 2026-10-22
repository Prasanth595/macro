//! [`TurnPrompterSource`] over the session row.
//!
//! The harness records who prompted a turn on the session row before it
//! delivers the prompt, for the egress proxy's approvals; the same record
//! tells this runtime whom a routine asked for in the turn belongs to.

use std::pin::Pin;

use agent_session::domain::model::AgentSessionId;
use agent_session::domain::ports::AgentSessionRepo;
use macro_user_id::user_id::MacroUserIdStr;

use crate::domain::turn_prompter::TurnPrompterSource;

/// The prompter the harness recorded for the session's current turn.
pub struct RecordedTurnPrompter<Sessions> {
    sessions: Sessions,
}

impl<Sessions> RecordedTurnPrompter<Sessions> {
    /// Read prompters from `sessions`' rows.
    pub fn new(sessions: Sessions) -> Self {
        Self { sessions }
    }
}

impl<Sessions: AgentSessionRepo> TurnPrompterSource for RecordedTurnPrompter<Sessions> {
    fn prompter(
        &self,
        session: AgentSessionId,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<Option<MacroUserIdStr<'static>>>> + Send + '_>>
    {
        Box::pin(async move {
            Ok(self
                .sessions
                .turn_prompter(session)
                .await?
                .and_then(|prompter| prompter.user))
        })
    }
}
