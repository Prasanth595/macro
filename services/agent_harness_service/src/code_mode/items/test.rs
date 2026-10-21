use super::*;
use agent_code_mode::domain::{ActivityItem, ActivityItemAction, ActivityItemType, ExecutionId};
use agent_session::domain::model::AgentSessionId;
use macro_user_id::user_id::MacroUserIdStr;
use serde_json::json;

fn identity() -> ExecutionIdentity {
    let session = agent_session::testing::test_agent_session(AgentSessionId::new_from_uuid(
        macro_uuid::generate_uuid_v7(),
    ));
    ExecutionIdentity {
        execution: ExecutionId::mint(),
        session: session.id,
        owner: MacroUserIdStr::parse_from_str("macro|items@macro.local").unwrap(),
        agent_id: session.bot_id,
        turn: macro_uuid::generate_uuid_v7(),
    }
}

#[test]
fn an_item_is_presented_under_its_execution_and_activity() {
    let identity = identity();
    let item = PresentedItem {
        activity: 7,
        item: ActivityItem {
            item_type: ActivityItemType::Document,
            id: "0199f3a2-1b2c-7d4e-8f90-a1b2c3d4e5f6".into(),
            action: ActivityItemAction::Created,
            title: Some("Q3 plan".into()),
        },
    };
    let presented = presentation(&identity, &item);
    assert_eq!(
        presented.tool_call_id,
        format!("item_{}_7", identity.execution)
    );
    assert_eq!(presented.title, "mcp__macro_internal__PresentItem");
    assert_eq!(
        presented.raw_input,
        json!({
            "executionId": identity.execution,
            "itemType": "document",
            "itemId": "0199f3a2-1b2c-7d4e-8f90-a1b2c3d4e5f6",
            "action": "created",
            "title": "Q3 plan",
        })
    );
}

#[tokio::test]
async fn an_unfilled_cell_presents_nothing() {
    let late = Late(Arc::new(OnceLock::new()));
    let item = PresentedItem {
        activity: 1,
        item: ActivityItem {
            item_type: ActivityItemType::Channel,
            id: "0199f3a2-1b2c-7d4e-8f90-a1b2c3d4e5f6".into(),
            action: ActivityItemAction::Created,
            title: None,
        },
    };
    assert!(matches!(
        late.present(&identity(), &item).await,
        Err(CodeModeError::Unavailable)
    ));
}
