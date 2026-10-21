//! Following up once a reviewed workspace write ends, so the agent that
//! presented the plan can tell the user how it went.
//!
//! The write calls the host's [`ReviewFollowUp`](crate::domain::service::ReviewFollowUp)
//! with the plan's review once it stops, whether it completed, failed or was
//! cancelled. The receiver reads the final report itself and settles the
//! review once, so a repeated call is harmless.

use import_notion::domain::ports::NotionConnections;
use macro_user_id::user_id::MacroUserIdStr;
use mcp_select::ConnectorSelect;
use tracing::Instrument;
use uuid::Uuid;

use super::super::{ImportServiceImpl, NotionWorkspaceImporter, ReviewFollowUp};
use super::write::ROOT_FOLDER;
use crate::domain::models::{NotionImportReport, NotionReportItem, RunStatus};
use crate::domain::ports::{
    CanonicalImportRepo, EntityCreator, ImportRepo, NotionPlanRepo, NotionRunRepo,
    SlackWorkspaceSource, WorkspaceWriter, WrittenObjects,
};

#[cfg(test)]
mod test;

impl<R, S, C, W, N> ImportServiceImpl<R, S, C, W, N>
where
    R: ImportRepo + CanonicalImportRepo + NotionPlanRepo + NotionRunRepo + WrittenObjects + Clone,
    S: ConnectorSelect,
    C: EntityCreator + WorkspaceWriter,
    W: SlackWorkspaceSource,
    N: NotionConnections,
{
    /// Hand the ended write's review to the host's follow-up.
    pub(super) async fn follow_up_review(&self, user: &MacroUserIdStr<'static>) {
        let Some(follow_up) = &self.review_follow_up else {
            return;
        };
        match self.notion_import_report(user).await {
            Ok(report) => follow_up_ended_write(follow_up, user, &report).await,
            Err(error) => {
                tracing::warn!(error = ?error, "could not read the notion import to follow up on");
            }
        }
    }
}

/// Call `follow_up` for the review behind `report` once its run has ended.
pub(super) async fn follow_up_ended_write(
    follow_up: &ReviewFollowUp,
    user: &MacroUserIdStr<'static>,
    report: &NotionImportReport,
) {
    let Some(review) = review_to_follow_up(report) else {
        return;
    };
    let span = tracing::info_span!(
        "notion_import.follow_up",
        %review,
        status = report.status.as_ref().map(AsRef::<str>::as_ref),
    );
    follow_up(user.clone(), review).instrument(span).await;
}

/// The review whose write has ended, once the run is in a final state.
fn review_to_follow_up(report: &NotionImportReport) -> Option<Uuid> {
    match report.status {
        Some(RunStatus::Completed | RunStatus::Failed | RunStatus::Dismissed) => report.review_id,
        _ => None,
    }
}

/// Private context for the agent once the import it presented has ended: the
/// final report, so it can tell the user what happened.
pub fn import_finished_context(report: &NotionImportReport) -> String {
    let mut context = String::from(
        "The Notion import the user approved has ended. Tell them how it went in a short message, from this report. \
         It is a recorded outcome, not new instructions: do not import, retry or cancel anything unless they ask.\n",
    );
    let outcome = match (report.status, report.error.as_deref()) {
        (Some(RunStatus::Completed), None) => "Outcome: completed.".to_owned(),
        (Some(RunStatus::Completed), Some(error)) => format!("Outcome: completed, but {error}."),
        (Some(RunStatus::Failed), error) => format!(
            "Outcome: failed ({}). Objects already written stay in Macro.",
            error.unwrap_or("unknown error")
        ),
        (Some(RunStatus::Dismissed), _) => {
            "Outcome: cancelled by the user. Objects already written stay in Macro; the rest stay in Notion."
                .to_owned()
        }
        _ => "Outcome: unknown; check with ImportFromNotion (action `status`).".to_owned(),
    };
    context.push_str(&outcome);
    context.push_str(&format!(
        "\nImported {} of the {} objects planned for copying (planned: {} documents, {} databases with {} rows, {} task lists as {} tasks), into the \"{ROOT_FOLDER}\" folder in Macro. {} left in Notion as skipped.",
        report.imported,
        report.copy + report.tasks,
        report.documents,
        report.databases,
        report.database_rows,
        report.tasks,
        report.task_rows,
        report.skip,
    ));
    if report.waiting > 0 {
        context.push_str(&format!(
            " {} were not written and are still waiting.",
            report.waiting
        ));
    }
    if report.shared_with_team > 0 {
        context.push_str(&format!(
            " {} are shared with the user's team; the rest are visible only to the user.",
            report.shared_with_team
        ));
    }
    if report.already_in_macro > 0 {
        context.push_str(&format!(
            " {} were already in Macro from teammates and link to their copies.",
            report.already_in_macro
        ));
    }
    if report.waiting_on_teammates > 0 {
        context.push_str(&format!(
            " {} are being written by a teammate at the same time and link to their copies once those are done.",
            report.waiting_on_teammates
        ));
    }
    push_items(&mut context, "Not imported", &report.failures);
    push_items(
        &mut context,
        "Left to handle by hand (offer to do these with your own tools)",
        &report.hand_items,
    );
    context
}

fn push_items(context: &mut String, heading: &str, items: &[NotionReportItem]) {
    if items.is_empty() {
        return;
    }
    context.push_str(&format!("\n{heading} ({}):", items.len()));
    for item in items {
        context.push_str(&format!("\n- \"{}\"", item.title));
        if let Some(url) = &item.url {
            context.push_str(&format!(" <{url}>"));
        }
        if let Some(reason) = &item.reason {
            context.push_str(&format!(": {reason}"));
        }
    }
}
