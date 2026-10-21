use super::{AppResponse, connectable_catalog_entry};

fn app(slug: &str, auth_type: Option<&str>) -> AppResponse {
    AppResponse {
        categories: vec!["Developer Tools".to_owned()],
        name_slug: slug.to_owned(),
        name: slug.to_owned(),
        description: None,
        auth_type: auth_type.map(str::to_owned),
        img_src: "https://assets.pipedream.net/linear.png".to_owned(),
    }
}

#[test]
fn a_matching_slug_with_an_auth_flow_is_connectable() {
    let entry = connectable_catalog_entry("linear", app("linear", Some("oauth"))).expect("app");
    assert_eq!(entry.app_slug, "linear");
    assert_eq!(entry.categories, vec!["Developer Tools"]);
    assert_eq!(
        entry.icon_url.as_deref(),
        Some("https://assets.pipedream.net/linear.png")
    );
}

#[test]
fn an_app_without_an_auth_flow_is_not_connectable() {
    assert!(connectable_catalog_entry("webhook", app("webhook", Some("none"))).is_none());
}

#[test]
fn a_different_slug_than_the_one_asked_for_is_not_that_app() {
    assert!(connectable_catalog_entry("linear", app("slack", Some("oauth"))).is_none());
}

#[test]
fn app_categories_are_optional_for_older_directory_responses() {
    let app: AppResponse = serde_json::from_str(r#"{"name_slug":"linear","name":"Linear"}"#)
        .expect("valid app response");
    assert!(app.categories.is_empty());
}
