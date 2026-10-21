//! SDK activity carried by the internal code tool's receipt, independent of harness.

use serde::Deserialize;

use super::{
    ActivityCard, ActivityRow, ActivityStatus, CardAction, CardItemType, ItemFacts, ToolDetail,
    ToolName, item_card,
};

// Read only the presentation fields of agent_code_mode's ExecutionReceipt.
// The wasm fold cannot depend on the execution service and its native runtime.
#[derive(Deserialize)]
struct Operation {
    id: u64,
    label: String,
    status: Status,
    /// Read on its own, so an item this version cannot open still leaves
    /// its step.
    #[serde(default)]
    item: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum Status {
    Running,
    Completed,
    Failed,
    Unknown,
}

/// The workspace item a completed operation created or changed, as code
/// mode recorded it.
#[derive(Deserialize)]
struct Item {
    #[serde(rename = "type")]
    item_type: CardItemType,
    id: String,
    action: CardAction,
    #[serde(default)]
    title: Option<String>,
}

pub(super) fn rows(
    id: &str,
    name: &ToolName,
    detail: &ToolDetail,
    closed: bool,
) -> Option<Vec<ActivityRow>> {
    if !matches!(name, ToolName::Mcp { server, tool } if server == "macro_internal" && tool == "ExecuteCode")
    {
        return None;
    }
    let output = match detail {
        ToolDetail::Macro { output, .. } => output.as_ref(),
        ToolDetail::Other { result, .. } => result.as_ref(),
        _ => None,
    }?;
    let activity: Vec<Operation> = serde_json::from_value(output.get("activity")?.clone()).ok()?;
    if activity.is_empty() {
        return None;
    }
    Some(
        activity
            .into_iter()
            .take(128)
            .map(|operation| ActivityRow {
                id: format!("{id}:{}", operation.id),
                label: operation.label,
                detail: None,
                card: matches!(operation.status, Status::Completed)
                    .then(|| card(operation.item?))
                    .flatten(),
                status: match operation.status {
                    Status::Running if !closed => ActivityStatus::Running,
                    Status::Completed => ActivityStatus::Completed,
                    Status::Failed => ActivityStatus::Failed,
                    Status::Running | Status::Unknown => ActivityStatus::Interrupted,
                },
            })
            .collect(),
    )
}

/// The card a completed operation earns: the same card the Macro tool that
/// does the same would have.
fn card(item: serde_json::Value) -> Option<ActivityCard> {
    let item = serde_json::from_value::<Item>(item).ok()?;
    Some(item_card(
        item.item_type,
        item.id,
        item.action,
        ItemFacts {
            title: item.title,
            ..ItemFacts::default()
        },
    ))
}
