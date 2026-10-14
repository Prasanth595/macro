use super::*;
use crate::domain::ports::ImportedDocumentPropertyValue;
use crate::domain::service::{
    is_notion_fetch_tool_name, parse_notion_fetch_result, prepare_notion_markdown,
};

#[test]
fn dispatches_the_documented_arguments_for_each_fetch_contract() {
    for tool in ["mcp__Notion__notion-fetch", "mcp__Notion__fetch"] {
        assert!(is_notion_fetch_tool_name(tool));
        assert_eq!(arguments(tool, "page-id"), json!({"id": "page-id"}));
    }
    let tool = "mcp__notion__notion-retrieve-page";
    assert!(is_notion_fetch_tool_name(tool));
    assert_eq!(arguments(tool, "page-id"), json!({"pageId": "page-id"}));
    assert!(!is_notion_fetch_tool_name("mcp__notion__notion-search"));
    assert!(!is_notion_fetch_tool_name(
        "mcp__notion__notion-retrieve-page-property-item"
    ));
}

#[test]
fn pipedream_body_title_and_properties_survive_mcp_text_wrapping() {
    // Pipedream components/notion/actions/retrieve-page, version 0.1.2.
    let response = json!({
        "page": {
            "object": "page", "id": "page-id",
            "properties": {
                "Project": {"type": "title", "title": [{"plain_text": "Road"}, {"text": {"content": "map"}}]},
                "Status": {"type": "status", "status": {"name": "In progress"}},
                "Tags": {"type": "multi_select", "multi_select": [{"name": "Launch"}]},
                "Estimate": {"type": "number", "number": 3},
                "Done": {"type": "checkbox", "checkbox": false},
                "Due": {"type": "date", "date": {"start": "2026-10-12"}},
                "Notes": {"type": "rich_text", "rich_text": [{"plain_text": "Owner confirmed"}]}
            }
        },
        "content": "# Launch plan\n\n- Ship the integration\n",
        "$summary": "Retrieved page Roadmap"
    });
    for wrapped in [
        response.clone(),
        Value::String(response.to_string()),
        json!([{"type": "text", "text": response.to_string()}]),
    ] {
        let parsed = parse_notion_fetch_result(wrapped);
        assert_eq!(parsed.title.as_deref(), Some("Roadmap"));
        assert_eq!(parsed.body, "# Launch plan\n\n- Ship the integration\n");
        assert!(!parsed.is_database);
        assert!(!parsed.truncated);
        assert_eq!(parsed.properties.tags, vec!["Launch"]);
        assert!(parsed.properties.values.iter().any(|p| p.name == "Estimate"
            && p.value == ImportedDocumentPropertyValue::Number { value: 3.0 }));
        assert!(parsed.properties.values.iter().any(|p| p.name == "Due"
            && p.value
                == ImportedDocumentPropertyValue::Date {
                    value: "2026-10-12".into()
                }));
        assert!(!parsed.properties.values.iter().any(|p| p.name == "Project"));
    }
}

#[test]
fn missing_body_database_and_truncation_cannot_be_imported_as_complete_pages() {
    let missing = parse_notion_fetch_result(
        json!({"page": {"object": "page"}, "$summary": "Retrieved a page"}),
    );
    assert!(prepare_notion_markdown(&missing.body).is_err());
    let empty = parse_notion_fetch_result(json!({"page": {"object": "page"}, "content": ""}));
    assert!(prepare_notion_markdown(&empty.body).is_err());
    let database = parse_notion_fetch_result(
        json!({"page": {"object": "database"}, "content": "Not page content"}),
    );
    assert!(database.is_database);
    let truncated = parse_notion_fetch_result(
        json!({"page": {"object": "page"}, "content": "Partial", "truncated": true}),
    );
    assert!(truncated.truncated);
}
