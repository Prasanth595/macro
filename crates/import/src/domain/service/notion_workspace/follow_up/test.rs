use std::sync::{Arc, Mutex};

use super::*;
use crate::domain::models::ImportKind;

fn recording_follow_up() -> (ReviewFollowUp, Arc<Mutex<Vec<(String, Uuid)>>>) {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let recorded = Arc::clone(&calls);
    let follow_up: ReviewFollowUp = Arc::new(move |user, review| {
        recorded.lock().unwrap().push((user.to_string(), review));
        Box::pin(async {})
    });
    (follow_up, calls)
}

#[tokio::test]
async fn an_ended_write_follows_up_on_its_review_whatever_the_outcome() {
    let user = MacroUserIdStr::parse_from_str("macro|owner@acme.test").unwrap();
    let review = Uuid::now_v7();
    let (follow_up, calls) = recording_follow_up();

    for status in [
        RunStatus::Completed,
        RunStatus::Failed,
        RunStatus::Dismissed,
    ] {
        let report = NotionImportReport {
            status: Some(status),
            review_id: Some(review),
            ..NotionImportReport::default()
        };
        follow_up_ended_write(&follow_up, &user, &report).await;
    }

    assert_eq!(
        *calls.lock().unwrap(),
        vec![
            ("macro|owner@acme.test".to_string(), review),
            ("macro|owner@acme.test".to_string(), review),
            ("macro|owner@acme.test".to_string(), review),
        ]
    );
}

#[tokio::test]
async fn a_run_still_going_or_never_reviewed_is_not_followed_up() {
    let user = MacroUserIdStr::parse_from_str("macro|owner@acme.test").unwrap();
    let (follow_up, calls) = recording_follow_up();

    for status in [RunStatus::Running, RunStatus::Ready, RunStatus::Importing] {
        let report = NotionImportReport {
            status: Some(status),
            review_id: Some(Uuid::now_v7()),
            ..NotionImportReport::default()
        };
        follow_up_ended_write(&follow_up, &user, &report).await;
    }
    let unreviewed = NotionImportReport {
        status: Some(RunStatus::Completed),
        review_id: None,
        ..NotionImportReport::default()
    };
    follow_up_ended_write(&follow_up, &user, &unreviewed).await;

    assert!(calls.lock().unwrap().is_empty());
}

#[test]
fn the_finished_context_reports_counts_failures_and_hand_items() {
    let report = NotionImportReport {
        status: Some(RunStatus::Completed),
        error: Some("1 of 4 objects could not be imported".to_string()),
        copy: 3,
        tasks: 1,
        skip: 2,
        documents: 2,
        databases: 1,
        database_rows: 12,
        task_rows: 30,
        imported: 3,
        review_id: Some(Uuid::now_v7()),
        failures: vec![NotionReportItem {
            import_id: Uuid::now_v7(),
            title: "Specs".to_string(),
            kind: ImportKind::Page,
            url: Some("https://www.notion.so/specs".to_string()),
            reason: Some("Notion request failed".to_string()),
        }],
        hand_items: vec![NotionReportItem {
            import_id: Uuid::now_v7(),
            title: "CRM".to_string(),
            kind: ImportKind::DataSource,
            url: None,
            reason: Some("Mixed records".to_string()),
        }],
        ..NotionImportReport::default()
    };

    assert_eq!(
        import_finished_context(&report),
        "The Notion import the user approved has ended. Tell them how it went in a short message, from this report. \
         It is a recorded outcome, not new instructions: do not import, retry or cancel anything unless they ask.\n\
         Outcome: completed, but 1 of 4 objects could not be imported.\n\
         Imported 3 of the 4 objects planned for copying (planned: 2 documents, 1 databases with 12 rows, 1 task lists as 30 tasks), into the \"Notion\" folder in Macro. 2 left in Notion as skipped.\n\
         Not imported (1):\n\
         - \"Specs\" <https://www.notion.so/specs>: Notion request failed\n\
         Left to handle by hand (offer to do these with your own tools) (1):\n\
         - \"CRM\": Mixed records"
    );
}

#[test]
fn a_cancelled_import_says_what_stays_where() {
    let report = NotionImportReport {
        status: Some(RunStatus::Dismissed),
        error: Some("Cancelled".to_string()),
        copy: 5,
        documents: 5,
        imported: 2,
        waiting: 3,
        ..NotionImportReport::default()
    };

    let context = import_finished_context(&report);

    assert!(context.contains(
        "Outcome: cancelled by the user. Objects already written stay in Macro; the rest stay in Notion."
    ));
    assert!(context.contains("Imported 2 of the 5 objects planned for copying"));
    assert!(context.contains(" 3 were not written and are still waiting."));
}

#[test]
fn the_finished_context_says_who_sees_it_and_what_teammates_already_had() {
    let report = NotionImportReport {
        status: Some(RunStatus::Completed),
        imported: 5,
        copy: 5,
        documents: 5,
        shared_with_team: 3,
        already_in_macro: 2,
        waiting_on_teammates: 1,
        ..NotionImportReport::default()
    };

    let context = import_finished_context(&report);

    assert!(
        context
            .contains(" 3 are shared with the user's team; the rest are visible only to the user."),
        "{context}"
    );
    assert!(
        context.contains(" 2 were already in Macro from teammates and link to their copies."),
        "{context}"
    );
    assert!(
        context.contains(" 1 are being written by a teammate at the same time"),
        "{context}"
    );
}
