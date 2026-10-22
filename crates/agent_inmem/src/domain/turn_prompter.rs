//! Who prompted the turn a session is running.
//!
//! A turn's tools act as the session's owner, whose access they spend. A
//! routine is the exception: it runs as the person who asked for it once the
//! session has ended, so it belongs to the turn's prompter, who in a session
//! somebody else owns is not the owner. The engine asks this before a turn so
//! the routine tools can act as that person.

use std::pin::Pin;

use agent_session::domain::model::AgentSessionId;
use macro_user_id::user_id::MacroUserIdStr;

/// Reads who prompted a session's current turn. Object-safe so the engine
/// holds it erased.
pub trait TurnPrompterSource: Send + Sync + 'static {
    /// The user who prompted the turn `session` is running; `None` when none
    /// is recorded, or a bot prompted on nobody's behalf.
    fn prompter(
        &self,
        session: AgentSessionId,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<Option<MacroUserIdStr<'static>>>> + Send + '_>>;
}

/// Knows no prompter, so every turn runs as its owner alone: tests, and
/// tooling with no session rows to read.
#[derive(Clone, Copy, Debug, Default)]
pub struct NoTurnPrompter;

impl TurnPrompterSource for NoTurnPrompter {
    fn prompter(
        &self,
        _session: AgentSessionId,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<Option<MacroUserIdStr<'static>>>> + Send + '_>>
    {
        Box::pin(async { Ok(None) })
    }
}
