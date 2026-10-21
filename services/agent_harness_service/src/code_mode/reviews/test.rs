use super::*;
use serde_json::json;

#[test]
fn review_validation_uses_existing_action_contracts() {
    let tools = ai_tools::code_mode_tools();
    let email = json!({"subject":"Review", "body":"**Markdown**", "to":[{"email":"recipient@example.com"}]});
    assert!(validate_draft(&tools, ReviewKind::Email, &email).is_ok());
    assert!(
        validate_draft(
            &tools,
            ReviewKind::Email,
            &json!({"subject":"missing body"})
        )
        .is_err()
    );
    assert!(
        validate_draft(
            &tools,
            ReviewKind::Calendar,
            &json!({"title":"missing time"})
        )
        .is_err()
    );
}

fn notification_fixture(kind: ReviewKind, draft: Value) -> ReviewRecord {
    ReviewRecord {
        id: ReviewId(macro_uuid::generate_uuid_v7()),
        session_id: AgentSessionId::new_from_uuid(macro_uuid::generate_uuid_v7()),
        execution_id: None,
        presented_at: Some(1),
        kind,
        title: "Fixture review".into(),
        revision: 1,
        updated_at: 1,
        items: vec![ReviewItem {
            id: macro_uuid::generate_uuid_v7(),
            draft: draft.clone(),
            status: ReviewItemStatus::Completed,
            result: Some(draft),
            error: None,
        }],
        notification_id: Some(macro_uuid::generate_uuid_v7()),
        notification_attempt_at: None,
        settled_at: None,
        approved_by_agent: None,
    }
}

#[test]
fn notifications_keep_action_details_on_review() {
    for (kind, draft, expected) in [
        (
            ReviewKind::Email,
            json!({"subject":"Project update", "body":"private body"}),
            "Project update",
        ),
        (
            ReviewKind::Calendar,
            json!({"title":"Planning", "description":"private notes"}),
            "Planning",
        ),
    ] {
        let mut record = notification_fixture(kind, draft);
        record.items[0].result = Some(json!({"provider":"raw response omitted"}));
        record.items.push(ReviewItem {
            status: ReviewItemStatus::Unknown,
            ..record.items[0].clone()
        });
        let text = notification_summary(&record);
        assert!(!text.contains(expected));
        assert!(text.contains("1 completed; 1 outcome unconfirmed;"));
        assert!(text.contains("outcome unconfirmed"));
        assert!(text.contains("no further sending or scheduling is requested"));
        assert!(!text.contains("private"));
        assert!(!text.contains("provider"));
    }
}

#[test]
fn notifications_bound_unicode_stacks_and_preserve_the_saved_reference() {
    let mut record = notification_fixture(
        ReviewKind::Email,
        json!({"subject":"🙂".repeat(4000), "body":"é\n".repeat(4000)}),
    );
    record.title = "Long\nreview 🙂".repeat(4000);
    record.items = vec![record.items[0].clone(); 100];
    let text = notification_summary(&record);
    assert!(text.len() <= 8 * 1024);
    assert!(text.contains("Review updated: Long review 🙂"));
    assert!(text.contains("100 completed;"));
    assert!(text.contains(&record.id.0.to_string()));
}

#[test]
fn hundred_uncertain_actions_produce_one_bounded_context_summary() {
    let mut record = notification_fixture(ReviewKind::Email, json!({"subject":"Hi #1"}));
    record.items[0].status = ReviewItemStatus::Unknown;
    record.items = vec![record.items[0].clone(); 100];
    let action = agent_runtime_protocol::domain::action::AgentAction::context_prompt(
        notification_summary(&record),
    );
    let agent_runtime_protocol::domain::action::AgentAction::Prompt(prompt) = action else {
        panic!("context travels through the normal prompt queue");
    };
    assert!(prompt.prompt.is_empty());
    let context = prompt.private_context.unwrap();
    assert!(context.contains("100 outcome unconfirmed;"));
    assert!(context.contains(&record.id.0.to_string()));
    assert!(!context.contains("Hi #1"));
    assert!(context.len() < 1024);
}

#[test]
fn an_import_review_carries_one_notion_draft_with_its_left_out_and_reshared_rows() {
    let tools = ai_tools::code_mode_tools();
    assert!(validate_draft(&tools, ReviewKind::Import, &json!({"source": "notion"})).is_ok());
    assert!(
        validate_draft(
            &tools,
            ReviewKind::Import,
            &json!({"source": "notion", "excluded": ["01a15623-f76d-7ea0-955d-a9ecb91a520e"]})
        )
        .is_ok()
    );
    assert!(
        validate_draft(
            &tools,
            ReviewKind::Import,
            &json!({
                "source": "notion",
                "excluded": [],
                "shared": ["01a15623-f76d-7ea0-955d-a9ecb91a520e"],
                "personal": ["01a15623-f76d-7ea0-955d-a9ecb91a520f"]
            })
        )
        .is_ok(),
        "the owner's sharing changes travel with the draft"
    );
    for draft in [
        json!({"source": "linear"}),
        json!({"source": "notion", "excluded": ["not a uuid"]}),
        json!({"source": "notion", "personal": ["not a uuid"]}),
        json!({"source": "notion", "write": "everything"}),
        json!({}),
    ] {
        assert!(
            validate_draft(&tools, ReviewKind::Import, &draft).is_err(),
            "{draft}"
        );
    }
}

#[test]
fn an_approved_import_tells_the_agent_to_follow_progress_not_to_import_again() {
    let record = notification_fixture(ReviewKind::Import, json!({"source": "notion"}));
    let summary = notification_summary(&record);
    assert!(summary.contains("1 completed"), "{summary}");
    assert!(
        summary.contains("report progress with ImportFromNotion (action `status`) rather than importing anything yourself"),
        "{summary}"
    );
    assert!(
        !summary.contains("no further sending or scheduling"),
        "{summary}"
    );
}

#[test]
fn a_settled_import_continues_the_session_on_its_final_report() {
    let mut record = notification_fixture(ReviewKind::Import, json!({"source": "notion"}));
    record.settled_at = Some(2);
    let report = NotionImportReport {
        status: Some(RunStatus::Completed),
        copy: 2,
        documents: 2,
        imported: 2,
        review_id: Some(record.id.0),
        ..NotionImportReport::default()
    };

    let action = agent_runtime_protocol::domain::action::AgentAction::context_prompt(
        settled_import_summary(&record, &report),
    );

    let agent_runtime_protocol::domain::action::AgentAction::Prompt(prompt) = action else {
        panic!("the follow-up travels through the normal prompt queue");
    };
    assert!(prompt.prompt.is_empty(), "the transcript shows no prompt");
    let context = prompt.private_context.unwrap();
    assert!(
        context.starts_with("The Notion import the user approved has ended."),
        "{context}"
    );
    assert!(context.contains("Outcome: completed."), "{context}");
    assert!(
        context.contains("Imported 2 of the 2 objects planned for copying"),
        "{context}"
    );
    assert!(
        context.ends_with(&format!("Saved review: {}.", record.id.0)),
        "{context}"
    );
}

#[test]
fn a_settled_import_whose_report_moved_on_reports_no_stale_counts() {
    let mut record = notification_fixture(ReviewKind::Import, json!({"source": "notion"}));
    record.settled_at = Some(2);
    let report = NotionImportReport {
        status: Some(RunStatus::Completed),
        imported: 9,
        review_id: Some(macro_uuid::generate_uuid_v7()),
        ..NotionImportReport::default()
    };

    let summary = settled_import_summary(&record, &report);

    assert!(
        summary.contains("a newer import plan has replaced its report"),
        "{summary}"
    );
    assert!(!summary.contains("Imported 9"), "{summary}");
}
