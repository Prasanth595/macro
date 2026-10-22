use super::*;

const TEAMMATE_ID: &str = "macro|teammate@example.com";

/// A teammate's edit, as ingestion records it.
fn teammates_edit(
    id: u128,
    entity_type: ModelEntityType,
    entity_id: &str,
) -> activity::ActivityRecord {
    activity::ActivityRecord {
        id: Uuid::from_u128(id),
        actor: activity::Actor::new_from_user(MacroUserIdStr::parse_from_str(TEAMMATE_ID).unwrap()),
        subject_id: TEAMMATE_ID.to_owned(),
        entity_type,
        entity_id: entity_id.to_owned(),
        action: activity::RecordedAction::Known(activity::Action::Edited),
        occurred_at: chrono::DateTime::from_timestamp(i64::try_from(id).unwrap() * 100, 0)
            .expect("valid timestamp"),
    }
}

async fn team_page(harness: &TestHarness, cursor: Option<&str>) -> serde_json::Value {
    let cursor = cursor.map_or(String::new(), |cursor| format!(r#", cursor: "{cursor}""#));
    let response = harness
        .execute(&format!(
            r#"{{ user {{ activity(input: {{scope: TEAM, limit: 2{cursor}}}) {{ items {{ id actorId }} nextCursor }} }} }}"#
        ))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    response.data.into_json().unwrap()["user"]["activity"].clone()
}

#[tokio::test]
async fn team_activity_shows_teammates_rows_on_entities_the_viewer_can_see() {
    let harness = harness();
    let viewable_thread = Uuid::from_u128(81);
    let hidden_thread = Uuid::from_u128(82);
    harness
        .state
        .entity_access
        .viewable_email_threads
        .lock()
        .unwrap()
        .insert(viewable_thread);
    harness.activity_reader.set_records(vec![
        activity_record(
            7,
            ModelEntityType::Database,
            database_activity::VIEWABLE_DATABASE_ID,
            activity::RecordedAction::Known(activity::Action::Edited),
            700,
        ),
        // Viewing a form does not reveal who else responded to it.
        teammates_edit(6, ModelEntityType::Form, form_activity::RESPONDED_FORM_ID),
        teammates_edit(
            5,
            ModelEntityType::Database,
            "0199a000-0000-7000-8000-00000000d1d1",
        ),
        teammates_edit(4, ModelEntityType::Form, form_activity::EDITABLE_FORM_ID),
        teammates_edit(
            3,
            ModelEntityType::EmailThread,
            &viewable_thread.to_string(),
        ),
        teammates_edit(2, ModelEntityType::EmailThread, &hidden_thread.to_string()),
        teammates_edit(
            1,
            ModelEntityType::Database,
            database_activity::VIEWABLE_DATABASE_ID,
        ),
    ]);

    let first = team_page(&harness, None).await;
    assert_eq!(first["items"], serde_json::json!([]));
    let cursor = first["nextCursor"]
        .as_str()
        .expect("hidden rows never end the feed");

    let second = team_page(&harness, Some(cursor)).await;
    assert_eq!(
        second["items"],
        serde_json::json!([
            { "id": Uuid::from_u128(4).to_string(), "actorId": TEAMMATE_ID },
            { "id": Uuid::from_u128(3).to_string(), "actorId": TEAMMATE_ID },
        ])
    );
    let cursor = second["nextCursor"].as_str().expect("more rows exist");

    let last = team_page(&harness, Some(cursor)).await;
    assert_eq!(
        last["items"],
        serde_json::json!([{ "id": Uuid::from_u128(1).to_string(), "actorId": TEAMMATE_ID }])
    );
    assert!(last["nextCursor"].is_null());
}

#[tokio::test]
async fn team_activity_fails_rather_than_hiding_rows_when_access_checks_fail() {
    let harness = harness();
    // The test access service fails every document check.
    harness.activity_reader.set_records(vec![teammates_edit(
        1,
        ModelEntityType::Document,
        &Uuid::from_u128(91).to_string(),
    )]);

    let response = harness
        .execute(r#"{ user { activity(input: {scope: TEAM}) { items { id } } } }"#)
        .await;

    assert_eq!(
        response
            .errors
            .iter()
            .map(|error| error.message.as_str())
            .collect::<Vec<_>>(),
        ["activity feed is unavailable"]
    );
}
