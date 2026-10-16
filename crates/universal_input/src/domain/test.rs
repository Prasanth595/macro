use super::*;
use ai_billing::{DenyReason, DisabledAiAdmissionService};
use jev::domain::{JevError, Probability};
use std::sync::atomic::{AtomicUsize, Ordering};

struct Classifier(Arc<AtomicUsize>);
impl YesNoClassifier for Classifier {
    async fn classify(
        &self,
        _: UsageContext,
        input: &serde_json::Value,
        questions: &[YesNoQuestion],
    ) -> Result<Vec<Probability>, JevError> {
        self.0.fetch_add(1, Ordering::SeqCst);
        assert!(input["draft"].is_string());
        assert_eq!(questions.len(), 7);
        Ok((0..7)
            .map(|i| Probability::new(if i == 5 { 0.98 } else { 0.02 }).unwrap())
            .collect())
    }
}
struct Extractor(InputSuggestions);
impl FieldExtractor for Extractor {
    async fn extract(
        &self,
        _: &ExtractInputRequest,
        _: UsageContext,
    ) -> Result<InputSuggestions, InputError> {
        Ok(self.0.clone())
    }
}
struct Denied;
impl AiAdmissionService for Denied {
    fn admit<'a>(
        &'a self,
        _: &'a MacroUserIdStr<'_>,
        _: AiFeature,
    ) -> ai_billing::AdmissionFuture<'a> {
        Box::pin(async { Err(AiAdmissionError::Denied(DenyReason::AllowanceExhausted)) })
    }
}
fn user() -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from("macro|universal-input@example.com".to_owned()).unwrap()
}
fn request() -> ExtractInputRequest {
    ExtractInputRequest {
        text: "Call John at 3pm tomorrow".into(),
        intent: InputIntent::Calendar,
        revision: 7,
        reference_time: "2026-10-09T18:00:00Z".parse().unwrap(),
        time_zone: "America/New_York".into(),
        property_definitions: vec![],
    }
}
fn service(fields: InputSuggestions) -> UniversalInputService<Classifier, Extractor> {
    UniversalInputService::new(
        Some(Classifier(Arc::new(AtomicUsize::new(0)))),
        Extractor(fields),
        Arc::new(DisabledAiAdmissionService),
    )
}

#[tokio::test]
async fn event_duration_is_applied_in_the_users_timezone_even_when_model_end_is_wrong() {
    for (text, expected) in [
        ("Call Julia tomorrow at 7", "2026-10-10T20:00"),
        (
            "Call Julia tomorrow at 7 for 30 minutes",
            "2026-10-10T19:30",
        ),
        ("Call Julia tomorrow at 7 for 45 min", "2026-10-10T19:45"),
        (
            "Call Julia tomorrow at 7 for 1 hour 30 minutes",
            "2026-10-10T20:30",
        ),
        ("Call Julia tomorrow at 7 for 1.5 hours", "2026-10-10T20:30"),
        ("Call Julia in 30 minutes", "2026-10-10T20:00"),
        ("Call Julia in 1 hour 30 minutes", "2026-10-10T20:00"),
        ("Call Julia in 2 days", "2026-10-10T20:00"),
        (
            "Call Julia in 30 minutes for 15 minutes",
            "2026-10-10T19:15",
        ),
        (
            "Call Julia 30 minutes from now for 15 minutes",
            "2026-10-10T19:15",
        ),
        (
            "Call Julia after 2 hours for 30 minutes",
            "2026-10-10T19:30",
        ),
        ("Call Julia for 30 minutes in 1 hour", "2026-10-10T19:30"),
        ("Call Julia on 2026-10-10 at 7pm", "2026-10-10T20:00"),
        (
            "Call Julia on 2026-10-10 at 7pm for 30 minutes",
            "2026-10-10T19:30",
        ),
        ("Call Julia tomorrow 7pm-9pm", "2026-10-10T21:00"),
        ("Call Julia tomorrow 7:00-9:00", "2026-10-10T21:00"),
        ("Call Julia tomorrow from 7pm to 9pm", "2026-10-10T21:00"),
        (
            "Call Julia from 2026-10-10T19:00 to 2026-10-10T21:00",
            "2026-10-10T21:00",
        ),
    ] {
        let mut input = request();
        input.text = text.into();
        let response = service(InputSuggestions {
            start: Some("2026-10-10T19:00".into()),
            end: Some("2026-10-10T21:00".into()),
            ..Default::default()
        })
        .extract(user(), input)
        .await
        .unwrap();
        assert_eq!(
            response.suggestions.end.as_deref(),
            Some(expected),
            "{text}"
        );
    }
}

#[tokio::test]
async fn preserves_inferred_end_for_unsupported_or_partially_parsed_durations() {
    for (text, end) in [
        (
            "Retreat tomorrow at 7 for 1 day and 2 hours",
            "2026-10-11T21:00",
        ),
        ("Call Julia tomorrow at 7 for 1h30m", "2026-10-10T20:30"),
        (
            "Call Julia tomorrow at 7 for half an hour",
            "2026-10-10T19:30",
        ),
        (
            "Call Julia tomorrow at 7 for one hour and 30 minutes",
            "2026-10-10T20:30",
        ),
    ] {
        let mut input = request();
        input.text = text.into();
        let response = service(InputSuggestions {
            start: Some("2026-10-10T19:00".into()),
            end: Some(end.into()),
            ..Default::default()
        })
        .extract(user(), input)
        .await
        .unwrap();
        assert_eq!(response.suggestions.end.as_deref(), Some(end), "{text}");
    }
}

#[tokio::test]
async fn removes_only_exact_extracted_task_metadata_and_keeps_problem_prose() {
    let mut input = request();
    input.intent = InputIntent::Task;
    let response = service(InputSuggestions {
        body: Some("Priority: High\nPriority high for the launch\nDue tomorrow\nDue to an outage, clicks fail\nAssignees: Julia, Alex".into()),
        due_date: Some("2026-10-10".into()),
        properties: vec![
            InputPropertySuggestion { name: "Priority".into(), values: vec!["High".into()] },
            InputPropertySuggestion { name: "Assignees".into(), values: vec!["Alex".into(), "Julia".into()] },
        ],
        ..Default::default()
    }).extract(user(), input).await.unwrap();
    assert_eq!(
        response.suggestions.body.as_deref(),
        Some("Priority high for the launch\nDue to an outage, clicks fail")
    );
}

#[tokio::test]
async fn validates_field_catalog_bounds_before_inference_and_preserves_property_suggestions() {
    let mut input = request();
    input.property_definitions = (0..65)
        .map(|_| InputPropertyDefinition {
            name: "Priority".into(),
            options: vec![],
        })
        .collect();
    assert!(matches!(
        service(InputSuggestions::default())
            .extract(user(), input)
            .await,
        Err(InputError::InvalidProperties)
    ));
    let mut input = request();
    input.intent = InputIntent::Task;
    input.text = "notification click not going to target\npriority urgent".into();
    input.property_definitions = vec![InputPropertyDefinition {
        name: "Priority".into(),
        options: vec!["Urgent".into()],
    }];
    let response = service(InputSuggestions {
        properties: vec![InputPropertySuggestion {
            name: "Priority".into(),
            values: vec!["Urgent".into()],
        }],
        ..Default::default()
    })
    .extract(user(), input)
    .await
    .unwrap();
    assert_eq!(response.suggestions.properties[0].name, "Priority");
    assert_eq!(response.suggestions.properties[0].values, ["Urgent"]);
}

#[tokio::test]
async fn returns_seven_independent_scores_and_the_draft_revision() {
    let response = service(InputSuggestions::default())
        .classify(
            user(),
            ClassifyInputRequest {
                text: request().text,
                revision: 13,
            },
        )
        .await
        .unwrap();
    assert_eq!(response.revision, 13);
    assert_eq!(response.scores.len(), 7);
    assert_eq!(response.scores[5].intent, InputIntent::Calendar);
    assert_eq!(response.scores[5].score, 0.98);
}

#[tokio::test]
async fn admission_prevents_provider_calls() {
    let calls = Arc::new(AtomicUsize::new(0));
    let service = UniversalInputService::new(
        Some(Classifier(calls.clone())),
        Extractor(InputSuggestions::default()),
        Arc::new(Denied),
    );
    assert!(matches!(
        service
            .classify(
                user(),
                ClassifyInputRequest {
                    text: "hello".into(),
                    revision: 0
                }
            )
            .await,
        Err(InputError::Admission(_))
    ));
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert!(matches!(
        service.extract(user(), request()).await,
        Err(InputError::Admission(_))
    ));
}

#[tokio::test]
async fn rejects_empty_and_oversized_drafts_before_inference() {
    let service = service(InputSuggestions::default());
    for text in [" ".into(), "a".repeat(16_001)] {
        assert!(matches!(
            service
                .classify(user(), ClassifyInputRequest { text, revision: 0 })
                .await,
            Err(InputError::InvalidText)
        ));
    }
}

#[tokio::test]
async fn extraction_is_available_without_jev_configuration() {
    let service = UniversalInputService::<Classifier, _>::new(
        None,
        Extractor(InputSuggestions::default()),
        Arc::new(DisabledAiAdmissionService),
    );
    assert!(matches!(
        service
            .classify(
                user(),
                ClassifyInputRequest {
                    text: "hello".into(),
                    revision: 0
                }
            )
            .await,
        Err(InputError::Unavailable)
    ));
    assert!(service.extract(user(), request()).await.is_ok());
}

#[tokio::test]
async fn keeps_valid_local_event_times_and_never_adds_attendees() {
    let response = service(InputSuggestions {
        title: Some("Call John".into()),
        start: Some("2026-10-10T15:00".into()),
        end: Some("2026-10-10T16:00".into()),
        ..Default::default()
    })
    .extract(user(), request())
    .await
    .unwrap();
    assert_eq!(
        response.suggestions.start.as_deref(),
        Some("2026-10-10T15:00")
    );
    assert!(response.suggestions.guests.is_empty());
    assert_eq!(response.revision, 7);
}

#[tokio::test]
async fn rejects_invalid_timezones_and_ambiguous_or_nonexistent_wall_times() {
    let mut input = request();
    input.time_zone = "Not/AZone".into();
    assert!(matches!(
        service(InputSuggestions::default())
            .extract(user(), input)
            .await,
        Err(InputError::InvalidTimeZone)
    ));
    for start in ["2026-03-08T02:30", "2026-11-01T01:30", "not a date"] {
        let response = service(InputSuggestions {
            start: Some(start.into()),
            ..Default::default()
        })
        .extract(user(), request())
        .await
        .unwrap();
        assert!(response.suggestions.start.is_none());
    }
}

#[tokio::test]
async fn normalizes_seconds_and_offsets_to_the_users_local_event_time() {
    for start in [
        "2026-10-10T19:00:00",
        "2026-10-10T19:00:00.000",
        "2026-10-10T19:00:00-04:00",
        "2026-10-10T23:00:00Z",
        " 2026-10-10T19:00 ",
    ] {
        let response = service(InputSuggestions {
            start: Some(start.into()),
            end: Some("2026-10-11T00:00:00Z".into()),
            ..Default::default()
        })
        .extract(user(), request())
        .await
        .unwrap();
        assert_eq!(
            response.suggestions.start.as_deref(),
            Some("2026-10-10T19:00")
        );
        assert_eq!(
            response.suggestions.end.as_deref(),
            Some("2026-10-10T20:00")
        );
    }
}
