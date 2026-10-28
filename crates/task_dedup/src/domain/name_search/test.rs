use async_trait::async_trait;

use super::*;
use crate::domain::models::TaskDedupError;

struct FailingSearch;

#[async_trait]
impl TaskNameSearch for FailingSearch {
    async fn similar_open_tasks(
        &self,
        _owner: &str,
        _team_id: Option<Uuid>,
        _name: &str,
    ) -> Result<Vec<TaskNameMatch>, TaskDedupError> {
        Err(TaskDedupError::Dependency(anyhow::anyhow!("database down")))
    }
}

struct HangingSearch;

#[async_trait]
impl TaskNameSearch for HangingSearch {
    async fn similar_open_tasks(
        &self,
        _owner: &str,
        _team_id: Option<Uuid>,
        _name: &str,
    ) -> Result<Vec<TaskNameMatch>, TaskDedupError> {
        std::future::pending().await
    }
}

#[tokio::test]
async fn a_failed_lookup_reports_no_similar_tasks() {
    let matches = similar_open_tasks_within_timeout(
        &FailingSearch,
        "macro|user@user.com",
        None,
        "Fix login bug",
    )
    .await;

    assert_eq!(matches, Vec::new());
}

#[tokio::test(start_paused = true)]
async fn a_slow_lookup_gives_up_after_the_timeout() {
    let matches = similar_open_tasks_within_timeout(
        &HangingSearch,
        "macro|user@user.com",
        None,
        "Fix login bug",
    )
    .await;

    assert_eq!(matches, Vec::new());
}
