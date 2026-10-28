use super::*;
use crate::inbound::toolset::edit_document::test::{
    FakeDocumentService, FakeEditingWorker, FakeEntityAccessService, request_context, tool_context,
};

#[tokio::test]
async fn native_canvas_tool_rejects_legacy_payloads_before_creating_metadata() {
    for (file_content, is_task) in [(r#"{"version":2,"document":{}}"#, false), ("", true)] {
        let context = tool_context(
            FakeDocumentService::new("canvas"),
            FakeEditingWorker::default(),
        );
        let tool = CreateDocument {
            document_name: "Fresh Canvas".into(),
            file_extension: "canvas".into(),
            file_content: file_content.into(),
            is_task,
            project_id: None,
        };
        // The shared fake panics if creation is reached.
        assert!(tool.call(context, request_context()).await.is_err());
    }
}

const CREATED_TASK_ID: &str = "0199f5a0-0000-7000-8000-000000000001";

/// Returns `matches` for every name and records the names it was asked about.
struct FixedTaskNames {
    matches: Vec<TaskNameMatch>,
    names: std::sync::Mutex<Vec<String>>,
}

#[async_trait::async_trait]
impl task_dedup::TaskNameSearch for FixedTaskNames {
    async fn similar_open_tasks(
        &self,
        _owner: &str,
        _team_id: Option<uuid::Uuid>,
        name: &str,
    ) -> Result<Vec<TaskNameMatch>, task_dedup::TaskDedupError> {
        self.names.lock().unwrap().push(name.to_string());
        Ok(self.matches.clone())
    }
}

struct FailingTaskNames;

#[async_trait::async_trait]
impl task_dedup::TaskNameSearch for FailingTaskNames {
    async fn similar_open_tasks(
        &self,
        _owner: &str,
        _team_id: Option<uuid::Uuid>,
        _name: &str,
    ) -> Result<Vec<TaskNameMatch>, task_dedup::TaskDedupError> {
        Err(task_dedup::TaskDedupError::Dependency(anyhow::anyhow!(
            "database down"
        )))
    }
}

fn task_creation_context(
    task_names: std::sync::Arc<dyn task_dedup::TaskNameSearch>,
) -> ServiceContext<DocumentToolContext<FakeDocumentService, FakeEntityAccessService, FakeEditingWorker>> {
    let mut context = tool_context(
        FakeDocumentService::creating(CREATED_TASK_ID),
        FakeEditingWorker::default(),
    );
    context.0.task_names = task_names;
    context
}

fn new_task(name: &str) -> CreateDocument {
    CreateDocument {
        document_name: name.into(),
        file_extension: "md".into(),
        file_content: String::new(),
        is_task: true,
        project_id: None,
    }
}

#[tokio::test]
async fn task_creation_lists_open_tasks_with_similar_names() {
    let task_names = std::sync::Arc::new(FixedTaskNames {
        matches: vec![TaskNameMatch {
            task_id: "0199f5a0-0000-7000-8000-000000000002".into(),
            task_name: "Fix the login bug".into(),
            name_similarity: 0.71,
        }],
        names: Default::default(),
    });

    let response = new_task("Fix login bug")
        .call(task_creation_context(task_names.clone()), request_context())
        .await
        .unwrap();

    assert_eq!(response.document_id.to_string(), CREATED_TASK_ID);
    assert_eq!(
        serde_json::to_value(&response).unwrap(),
        serde_json::json!({
            "documentId": CREATED_TASK_ID,
            "similarOpenTasks": [{
                "taskId": "0199f5a0-0000-7000-8000-000000000002",
                "taskName": "Fix the login bug",
                "nameSimilarity": 0.71_f32,
            }],
        })
    );
    assert_eq!(*task_names.names.lock().unwrap(), vec!["Fix login bug"]);
}

#[tokio::test]
async fn task_creation_omits_similar_tasks_when_none_match() {
    let response = new_task("Write the quarterly board update")
        .call(
            task_creation_context(std::sync::Arc::new(FixedTaskNames {
                matches: Vec::new(),
                names: Default::default(),
            })),
            request_context(),
        )
        .await
        .unwrap();

    assert_eq!(
        serde_json::to_value(&response).unwrap(),
        serde_json::json!({ "documentId": CREATED_TASK_ID })
    );
}

#[tokio::test]
async fn task_creation_never_lists_the_created_task() {
    let response = new_task("Fix login bug")
        .call(
            task_creation_context(std::sync::Arc::new(FixedTaskNames {
                matches: vec![TaskNameMatch {
                    task_id: CREATED_TASK_ID.into(),
                    task_name: "Fix login bug".into(),
                    name_similarity: 1.0,
                }],
                names: Default::default(),
            })),
            request_context(),
        )
        .await
        .unwrap();

    assert_eq!(response.similar_open_tasks, Vec::new());
}

#[tokio::test]
async fn task_creation_succeeds_when_the_similar_task_lookup_fails() {
    let response = new_task("Fix login bug")
        .call(
            task_creation_context(std::sync::Arc::new(FailingTaskNames)),
            request_context(),
        )
        .await
        .unwrap();

    assert_eq!(response.document_id.to_string(), CREATED_TASK_ID);
    assert_eq!(response.similar_open_tasks, Vec::new());
}

#[tokio::test]
async fn documents_that_are_not_tasks_skip_the_lookup() {
    let task_names = std::sync::Arc::new(FixedTaskNames {
        matches: Vec::new(),
        names: Default::default(),
    });
    let note = CreateDocument {
        is_task: false,
        ..new_task("Meeting notes")
    };

    note.call(task_creation_context(task_names.clone()), request_context())
        .await
        .unwrap();

    assert_eq!(*task_names.names.lock().unwrap(), Vec::<String>::new());
}
