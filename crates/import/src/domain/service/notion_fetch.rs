//! Normalize the documented native and Pipedream Notion fetch contracts.
//! Pipedream's `notion-retrieve-page` returns `{ page, content }`, where
//! `page` is Notion API metadata and `content` is the page body as Markdown.

use super::{ParsedNotionPage, imported_notion_properties};
use serde_json::{Map, Value, json};

#[cfg(test)]
mod test;

pub(super) fn arguments(tool_name: &str, target: &str) -> Value {
    if tool_name.rsplit_once("__").map(|(_, name)| name) == Some("notion-retrieve-page") {
        json!({ "pageId": target })
    } else {
        json!({ "id": target })
    }
}

fn rich_text(value: &Value) -> Option<String> {
    Some(
        value
            .as_array()?
            .iter()
            .filter_map(|part| {
                part.get("plain_text")
                    .and_then(Value::as_str)
                    .or_else(|| part.pointer("/text/content").and_then(Value::as_str))
            })
            .collect(),
    )
}

pub(super) fn parse_pipedream_page(map: &Map<String, Value>) -> Option<ParsedNotionPage> {
    let page = map.get("page")?.as_object()?;
    let body = map.get("content")?.as_str()?;
    let mut title = None;
    let mut properties = Map::new();
    if let Some(raw) = page.get("properties").and_then(Value::as_object) {
        for (name, property) in raw {
            let Some(kind) = property.get("type").and_then(Value::as_str) else {
                continue;
            };
            let value = &property[kind];
            let normalized = match kind {
                "title" => {
                    title = rich_text(value).filter(|title| !title.trim().is_empty());
                    None
                }
                "rich_text" => rich_text(value).map(Value::String),
                "checkbox" | "number" | "url" | "email" | "phone_number" => Some(value.clone()),
                "select" | "status" => value.get("name").cloned(),
                "multi_select" => value.as_array().map(|values| {
                    Value::Array(
                        values
                            .iter()
                            .filter_map(|value| value.get("name").cloned())
                            .collect(),
                    )
                }),
                "date" => {
                    if let Some(start) = value.get("start").filter(|start| start.is_string()) {
                        properties.insert(format!("date:{name}:start"), start.clone());
                    }
                    None
                }
                _ => None,
            };
            if let Some(value) = normalized {
                properties.insert(name.clone(), value);
            }
        }
    }
    Some(ParsedNotionPage {
        title,
        body: body.to_string(),
        properties: imported_notion_properties(&properties),
        // Never turn a database, data source, or malformed object into a document.
        is_database: page.get("object").and_then(Value::as_str) != Some("page"),
        truncated: map
            .get("truncated")
            .and_then(Value::as_bool)
            .unwrap_or(false)
            || page
                .get("truncated")
                .and_then(Value::as_bool)
                .unwrap_or(false),
    })
}
