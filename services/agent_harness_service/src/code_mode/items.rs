//! Present what a code-mode run changed as completed tool calls in its session.
use agent_code_mode::domain::{
    CodeModeError, ExecutionIdentity, ExecutionPresenter, PresentedItem,
};
use agent_session::domain::{
    model::SessionToolPresentation, ports::AgentSessionNotificationRecipient,
};
use async_trait::async_trait;
use std::sync::{Arc, OnceLock};

#[cfg(test)]
mod test;

/// The internal tool the agent fold reads an item's card from. No agent can
/// call it; only these presentations carry its name.
const PRESENT_ITEM: &str = "mcp__macro_internal__PresentItem";

pub struct Items<H> {
    pub harness: Arc<H>,
}

#[async_trait]
impl<H: AgentSessionNotificationRecipient> ExecutionPresenter for Items<H> {
    async fn present(
        &self,
        identity: &ExecutionIdentity,
        item: &PresentedItem,
    ) -> Result<(), CodeModeError> {
        self.harness
            .present_tool(
                identity.session,
                identity.owner.clone(),
                presentation(identity, item),
            )
            .await
            .map_err(|_| CodeModeError::Unavailable)
    }
}

/// The presentation's id names its execution and activity, so the fold can
/// tell it from any call an agent made, and a retry is the same frames.
fn presentation(identity: &ExecutionIdentity, item: &PresentedItem) -> SessionToolPresentation {
    SessionToolPresentation {
        tool_call_id: format!("item_{}_{}", identity.execution, item.activity),
        title: PRESENT_ITEM.into(),
        raw_input: serde_json::json!({
            "executionId": identity.execution,
            "itemType": item.item.item_type,
            "itemId": item.item.id,
            "action": item.item.action,
            "title": item.item.title,
        }),
        raw_output: serde_json::json!({"message": "Presented to the user"}),
    }
}

/// Code mode is built before the harness that presents its items; this cell
/// is filled once at startup, before any agent work is served.
pub struct Late(pub Arc<OnceLock<Arc<dyn ExecutionPresenter>>>);

#[async_trait]
impl ExecutionPresenter for Late {
    async fn present(
        &self,
        identity: &ExecutionIdentity,
        item: &PresentedItem,
    ) -> Result<(), CodeModeError> {
        self.0
            .get()
            .ok_or(CodeModeError::Unavailable)?
            .present(identity, item)
            .await
    }
}
