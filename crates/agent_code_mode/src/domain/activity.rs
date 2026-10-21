//! Bounded, advisory activity derived from the generated SDK operation catalog.
use super::{ActivityItem, ExecutionActivity, ExecutionRecord, PresentedItem, RecordedCallStatus};
use serde::Deserialize;
use std::{collections::BTreeMap, sync::LazyLock};

static OPERATIONS: LazyLock<BTreeMap<String, String>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("operations.json")).expect("generated operation catalog")
});

/// The longest item id and title a card keeps; the SDK sends titles no longer.
const MAX_ITEM_ID: usize = 128;
const MAX_ITEM_TITLE: usize = 100;
/// The most items one run presents, as the SDK reports no more.
pub(super) const MAX_PRESENTED_ITEMS: usize = 32;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Activity {
    id: u64,
    service: String,
    operation: String,
    status: String,
    /// Read on its own, so an item this version cannot read still lets the
    /// operation finish.
    #[serde(default)]
    item: Option<serde_json::Value>,
}

/// Record one SDK event. Returns the item a running operation reports on
/// completing, for the session to show.
pub(super) fn observe(
    record: &mut ExecutionRecord,
    value: serde_json::Value,
) -> Option<PresentedItem> {
    if value == serde_json::json!({"truncated": true}) {
        record.activity_truncated = true;
        return None;
    }
    let event = serde_json::from_value::<Activity>(value).ok()?;
    let label = OPERATIONS.get(&format!("{}.{}", event.service, event.operation))?;
    let status = match event.status.as_str() {
        "started" => RecordedCallStatus::Running,
        "completed" => RecordedCallStatus::Completed,
        "failed" => RecordedCallStatus::Failed,
        _ => return None,
    };
    if let Some(existing) = record.activity.iter_mut().find(|item| item.id == event.id) {
        if existing.label == *label && existing.status == RecordedCallStatus::Running {
            existing.status = status;
            if status == RecordedCallStatus::Completed {
                return event.item.and_then(item).map(|item| PresentedItem {
                    activity: event.id,
                    item,
                });
            }
        }
    } else if status == RecordedCallStatus::Running {
        if record.activity.len() < 128 {
            record.activity.push(ExecutionActivity {
                id: event.id,
                label: label.clone(),
                status,
            });
        } else {
            record.activity_truncated = true;
        }
    }
    None
}

/// An item as a card can carry it: an id of plain characters, and a title
/// trimmed to a line.
fn item(value: serde_json::Value) -> Option<ActivityItem> {
    let mut item = serde_json::from_value::<ActivityItem>(value).ok()?;
    let plain = |character: char| character.is_ascii_alphanumeric() || "-_".contains(character);
    if item.id.is_empty() || item.id.len() > MAX_ITEM_ID || !item.id.chars().all(plain) {
        return None;
    }
    item.title = item.title.and_then(|title| {
        let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
        (!title.is_empty()).then(|| title.chars().take(MAX_ITEM_TITLE).collect())
    });
    Some(item)
}

pub(super) fn finish(record: &mut ExecutionRecord) {
    for activity in &mut record.activity {
        if activity.status == RecordedCallStatus::Running {
            activity.status = RecordedCallStatus::Unknown;
        }
    }
}
