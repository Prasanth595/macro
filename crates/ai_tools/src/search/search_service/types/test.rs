use super::*;

#[test]
fn searches_include_sessions_by_default_and_never_include_legacy_chats() {
    let filters = search_filters(&[], item_filters::EntityFilters::default());
    assert!(filters.agent_session_filters.include);
    assert_eq!(
        filters.chat_filters.chat_ids,
        vec![uuid::Uuid::nil().to_string()]
    );
    let filters = search_filters(
        &[SearchEntityType::AgentSessions],
        item_filters::EntityFilters::default(),
    );
    assert!(filters.agent_session_filters.include);
    assert_eq!(
        filters.document_filters.document_ids,
        vec![uuid::Uuid::nil().to_string()]
    );
    assert!(serde_json::from_str::<SearchEntityType>("\"chats\"").is_err());
}

#[test]
fn company_results_reach_the_model_with_their_id() {
    let company = models_search::crm_company::CrmCompanySearchResponseItem {
        id: uuid::Uuid::parse_str("0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b").unwrap(),
        team_id: uuid::Uuid::parse_str("0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c").unwrap(),
        name: Some("Atlas Labs".to_string()),
        name_highlighted: Some("<macro_em>Atlas</macro_em> Labs".to_string()),
        description: None,
        hidden: false,
        created_at: chrono::DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
        updated_at: chrono::DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
        domains: vec![],
    };

    let result =
        SessionAwareSearchResult::from_unified(UnifiedSearchResponseItem::Company(company))
            .unwrap();
    let json = serde_json::to_value(result).unwrap();

    assert_eq!(json["type"], "company");
    assert_eq!(json["id"], "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b");
    assert_eq!(json["name"], "Atlas Labs");
}
