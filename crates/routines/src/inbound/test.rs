use super::*;
use ai_toolset::ToolSet as _;
use chrono::{Duration, Utc};
use std::sync::Mutex;

/// Records the user each call was made as.
#[derive(Default)]
struct RecordingService {
    users: Mutex<Vec<(&'static str, String)>>,
}

impl RecordingService {
    fn record(&self, call: &'static str, user: &MacroUserIdStr<'static>) {
        self.users
            .lock()
            .expect("lock should not be poisoned")
            .push((call, user.to_string()));
    }
    fn info(&self, id: Uuid) -> RoutineInfo {
        RoutineInfo {
            id,
            name: "Daily digest".to_owned(),
            enabled: true,
            trigger: serde_json::json!({}),
            task: serde_json::json!({}),
            next_run_at: None,
        }
    }
}

#[async_trait]
impl RoutineService for RecordingService {
    async fn create(
        &self,
        user: &MacroUserIdStr<'static>,
        _config: &RoutineConfiguration,
    ) -> anyhow::Result<RoutineInfo> {
        self.record("create", user);
        Ok(self.info(Uuid::nil()))
    }
    async fn list(&self, user: &MacroUserIdStr<'static>) -> anyhow::Result<Vec<RoutineInfo>> {
        self.record("list", user);
        Ok(vec![self.info(Uuid::nil())])
    }
    async fn read(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
    ) -> anyhow::Result<RoutineDetails> {
        self.record("read", user);
        Ok(RoutineDetails {
            routine: self.info(id),
            runs: Vec::new(),
        })
    }
    async fn update(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        _config: &RoutineConfiguration,
    ) -> anyhow::Result<RoutineInfo> {
        self.record("update", user);
        Ok(self.info(id))
    }
    async fn set_enabled(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        _enabled: bool,
    ) -> anyhow::Result<RoutineInfo> {
        self.record("set_enabled", user);
        Ok(self.info(id))
    }
    async fn delete(&self, user: &MacroUserIdStr<'static>, _id: Uuid) -> anyhow::Result<()> {
        self.record("delete", user);
        Ok(())
    }
    async fn run_now(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
    ) -> anyhow::Result<RoutineRunStarted> {
        self.record("run_now", user);
        Ok(RoutineRunStarted {
            routine_id: id,
            resource: None,
        })
    }
}

fn user(id: &str) -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from(id.to_owned()).expect("test user id should be valid")
}

fn configuration() -> serde_json::Value {
    serde_json::json!({
        "name": "Daily digest",
        "instructions": "Summarize my inbox.",
        "target": { "type": "model", "model": "test-model" },
        "schedule": { "type": "once", "at": (Utc::now() + Duration::hours(1)).to_rfc3339() },
    })
}

/// Call every routine tool once as `request_user`.
async fn call_every_tool(context: RoutineToolContext, request_user: &str) {
    let tools = routine_toolset();
    let id = Uuid::nil();
    let calls = [
        (
            "CreateRoutine",
            serde_json::json!({ "configuration": configuration() }),
        ),
        ("ListRoutines", serde_json::json!({})),
        ("ReadRoutine", serde_json::json!({ "routineId": id })),
        (
            "UpdateRoutine",
            serde_json::json!({ "routineId": id, "change": { "type": "enabled", "enabled": false } }),
        ),
        (
            "UpdateRoutine",
            serde_json::json!({ "routineId": id, "change": { "type": "configuration", "configuration": configuration() } }),
        ),
        ("RunRoutine", serde_json::json!({ "routineId": id })),
        ("DeleteRoutine", serde_json::json!({ "routineId": id })),
    ];
    for (name, arguments) in calls {
        tools
            .try_tool_call(
                context.clone(),
                RequestContext::new(user(request_user)),
                name,
                &arguments,
            )
            .await
            .expect("the tool exists and its arguments parse")
            .expect("the tool call succeeds");
    }
}

fn recorded(service: &RecordingService) -> Vec<(&'static str, String)> {
    service
        .users
        .lock()
        .expect("lock should not be poisoned")
        .clone()
}

#[tokio::test]
async fn routine_tools_act_as_the_request_user_without_a_prompter() {
    let service = Arc::new(RecordingService::default());
    let context = RoutineToolContext {
        service: Some(service.clone()),
        prompter: None,
    };

    call_every_tool(context, "macro|owner@example.com").await;

    let recorded = recorded(&service);
    assert_eq!(recorded.len(), 7);
    assert!(
        recorded
            .iter()
            .all(|(_, user)| user == "macro|owner@example.com"),
        "{recorded:?}"
    );
}

#[tokio::test]
async fn routine_tools_act_as_the_prompter_when_the_host_names_one() {
    let service = Arc::new(RecordingService::default());
    let context = RoutineToolContext {
        service: Some(service.clone()),
        prompter: Some(user("macro|prompter@example.com")),
    };

    call_every_tool(context, "macro|owner@example.com").await;

    let recorded = recorded(&service);
    assert_eq!(
        recorded.iter().map(|(call, _)| *call).collect::<Vec<_>>(),
        [
            "create",
            "list",
            "read",
            "set_enabled",
            "update",
            "run_now",
            "delete"
        ]
    );
    assert!(
        recorded
            .iter()
            .all(|(_, user)| user == "macro|prompter@example.com"),
        "{recorded:?}"
    );
}
