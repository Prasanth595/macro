use super::*;

#[test]
fn a_ready_plan_tells_the_agent_to_present_it_for_review() {
    let report = NotionImportReport {
        status: Some(RunStatus::Ready),
        pages: 40,
        data_sources: 3,
        copy: 38,
        tasks: 1,
        skip: 3,
        hand: 1,
        documents: 36,
        databases: 2,
        database_rows: 412,
        task_rows: 33,
        shared_with_team: 30,
        hand_items: vec![crate::domain::models::NotionReportItem {
            import_id: uuid::Uuid::nil(),
            title: "CRM".to_string(),
            kind: crate::domain::models::ImportKind::DataSource,
            url: None,
            reason: Some("Mixed records".to_string()),
        }],
        ..NotionImportReport::default()
    };

    assert_eq!(
        message(NotionImportAction::Plan, &report),
        "The plan is ready: of the 40 pages and 3 databases Notion shared, it imports 36 pages as documents, 2 databases with 412 rows, 1 task lists as 33 tasks; 30 of them shared with the user's team, 9 visible only to the user; 3 skipped, 1 to handle by hand. Tell the user these numbers as they are, then present the plan now with PresentReview (kind \"import\", a short title such as \"Import from Notion\", drafts [{\"source\":\"notion\"}]). Nothing is written until they approve it; they can change who sees each object on the card. Objects to handle by hand (with your own tools, after the import): \"CRM\" (Mixed records)."
    );
}

#[test]
fn roots_parse_from_notion_urls_and_an_empty_list_means_everything() {
    assert_eq!(scope(&[]).unwrap(), ImportScope::Everything);
    assert_eq!(scope(&["  ".to_string()]).unwrap(), ImportScope::Everything);
    assert_eq!(
        scope(&["https://www.notion.so/Q3-plan-3fb607323e2e80629886fc0c028d50a7".to_string()])
            .unwrap(),
        ImportScope::Roots {
            ids: vec![NotionId::parse("3fb607323e2e80629886fc0c028d50a7").unwrap()],
        }
    );
    assert!(scope(&["not a page".to_string()]).is_err());
}

#[test]
fn while_planning_the_agent_hears_how_much_notion_has_shown_so_far() {
    let report = NotionImportReport {
        status: Some(RunStatus::Running),
        scanned: Some(crate::domain::models::ScanCounts {
            pages: 40,
            data_sources: 12,
        }),
        ..NotionImportReport::default()
    };

    assert_eq!(
        message(NotionImportAction::Status, &report),
        "Still reading Notion and planning; this continues in the background. 40 pages and 12 databases found so far. Check again with action `status` in a minute."
    );
}

#[test]
fn before_the_first_search_page_the_agent_hears_planning_has_started() {
    let report = NotionImportReport {
        status: Some(RunStatus::Running),
        ..NotionImportReport::default()
    };

    assert_eq!(
        message(NotionImportAction::Plan, &report),
        "Still reading Notion and planning; this continues in the background. Check again with action `status` in a minute."
    );
}

#[test]
fn the_agent_hears_how_much_is_already_in_macro_and_by_whom() {
    let report = NotionImportReport {
        status: Some(RunStatus::Ready),
        pages: 12,
        copy: 2,
        documents: 2,
        already_in_macro: 10,
        already_imported_by: vec![
            crate::domain::models::NotionImporter {
                by: "ana@acme.test".to_string(),
                count: 7,
            },
            crate::domain::models::NotionImporter {
                by: "bo@acme.test".to_string(),
                count: 3,
            },
        ],
        ..NotionImportReport::default()
    };

    assert_eq!(
        message(NotionImportAction::Plan, &report),
        "The plan is ready: of the 12 pages and 0 databases Notion shared, it imports 2 pages as documents; 0 of them shared with the user's team, 2 visible only to the user; 0 skipped, 0 to handle by hand. 10 more are already in Macro, imported and shared with the team by ana@acme.test (7), bo@acme.test (3); they link to those copies and are not imported again. Tell the user these numbers as they are, then present the plan now with PresentReview (kind \"import\", a short title such as \"Import from Notion\", drafts [{\"source\":\"notion\"}]). Nothing is written until they approve it; they can change who sees each object on the card."
    );
}

#[test]
fn objects_waiting_on_a_teammate_are_explained_while_and_after_importing() {
    let report = NotionImportReport {
        status: Some(RunStatus::Completed),
        imported: 4,
        waiting_on_teammates: 2,
        ..NotionImportReport::default()
    };

    assert_eq!(
        message(NotionImportAction::Status, &report),
        "The import finished: 4 objects imported. 2 are being imported by a teammate at the same time and link to their copies once those are written."
    );
}
