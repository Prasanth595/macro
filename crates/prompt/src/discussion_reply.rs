//! Behavior for an agent session turn whose reply is posted into the channel
//! or document thread the prompt came from.

use crate::types::StaticPrompt;

static TITLE: &str = "Replying in a Discussion";

static INSTRUCTIONS: &str = include_str!("discussion_reply.md");

static INTENT: &str = "When the reply is posted into the channel or document thread the prompt \
came from, the model ends any reply that creates or links an item with \"Do you want me to \
share this with the members of the channel?\" — always, since linking does not grant access — \
then, on a yes, calls ShareWithChannel and replies only \"Okay.\". Meetings it sets up get a \
Macro call made with ExecuteCode while drafting, whose link the draft shows, rather than \
Google Meet.";

/// The section added to an agent session's system prompt for a turn whose
/// reply is posted into a channel or document thread.
pub static PROMPT: StaticPrompt<'static> = StaticPrompt::borrowed(TITLE, INSTRUCTIONS, INTENT);

#[cfg(test)]
mod test;
