use super::*;
use ai_usage::{AiFeature, UsageEvent};
use serde_json::json;
use std::sync::Mutex;
use wiremock::{
    Mock, MockServer, ResponseTemplate,
    matchers::{header, method, path},
};

const ACCOUNT: &str = "0123456789abcdef0123456789abcdef";

#[derive(Default)]
struct Recorder(Mutex<Vec<UsageEvent>>);
impl UsageRecorder for Recorder {
    fn record(&self, event: UsageEvent) {
        self.0.lock().unwrap().push(event);
    }
}

fn input(intent: InputIntent, text: &str) -> ExtractInputRequest {
    ExtractInputRequest {
        text: text.into(),
        intent,
        revision: 9,
        reference_time: "2026-10-24T01:00:00Z".parse().unwrap(),
        time_zone: "America/Los_Angeles".into(),
        property_definitions: vec![],
    }
}
fn answer(kind: &str, value: Value) -> Value {
    json!({"type": kind, "value": value, "confidence": 0.99, "p_null": 0.01})
}
fn response(answers: Value) -> Value {
    json!({"success": true, "errors": [], "result": {"model": "clairic", "answers": answers, "truncated": false, "usage": {"input_tokens": 234, "output_tokens": 0}}})
}
async fn provider(body: Value) -> (MockServer, ClairicFieldExtractor, Arc<Recorder>) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(format!("/accounts/{ACCOUNT}/ai/run/{MODEL}")))
        .and(header("authorization", "Bearer test-token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(body))
        .expect(1)
        .mount(&server)
        .await;
    let recorder = Arc::new(Recorder::default());
    let extractor = ClairicFieldExtractor::with_base_url(
        ACCOUNT,
        "test-token",
        recorder.clone(),
        &server.uri(),
    )
    .unwrap();
    (server, extractor, recorder)
}
fn usage() -> UsageContext {
    UsageContext::system(AiFeature::DynamicCompletionsApi)
}

#[tokio::test]
async fn extracts_email_with_intent_specific_schema_raw_draft_and_metered_usage() {
    let draft = "email Julia\nCan we reschedule tomorrow?\nLet the investors know.";
    let (server, extractor, recorder) = provider(response(json!({
        "subject": answer("text", json!("reschedule tomorrow")),
        "body": answer("text", json!("Can we reschedule tomorrow?\nLet the investors know.")),
        "recipients": answer("list", json!(["Julia"]))
    })))
    .await;
    let fields = extractor
        .extract(&input(InputIntent::Email, draft), usage())
        .await
        .unwrap();
    assert_eq!(fields.recipients, ["Julia"]);
    assert!(fields.body.is_none()); // The domain copies this literal body without model inference.
    let requests = server.received_requests().await.unwrap();
    let body: Value = serde_json::from_slice(&requests[0].body).unwrap();
    assert_eq!(body["state"], draft);
    assert_eq!(body["reference_date"], "2026-10-23");
    let schema = body["fields"].as_object().unwrap();
    assert_eq!(schema.len(), 2);
    assert_eq!(schema["recipients"]["type"], "list");
    assert_eq!(schema["recipients"]["items"], "text");
    assert!(!schema.contains_key("body"));
    let events = recorder.0.lock().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].model, MODEL);
    assert_eq!(events[0].user, usage().user);
    assert_eq!(
        events[0].amount,
        UsageAmount::Tokens {
            input: 234,
            output: 0,
            cache_read: 0,
            cache_write: 0
        }
    );
}

#[tokio::test]
async fn extracts_computed_calendar_times_without_inventing_guest_invitations() {
    let (server, extractor, _) = provider(response(json!({
        "title": answer("text", json!("Call Julia")), "body": answer("text", Value::Null),
        "start": answer("datetime", json!("2026-10-24T19:00:00")),
        "end": answer("datetime", json!("2026-10-24T20:00:00")),
        "location": answer("text", Value::Null), "guests": answer("list", json!([]))
    })))
    .await;
    let fields = extractor
        .extract(
            &input(InputIntent::Calendar, "Call Julia tomorrow at 7"),
            usage(),
        )
        .await
        .unwrap();
    assert_eq!(fields.start.as_deref(), Some("2026-10-24T19:00:00"));
    assert!(fields.guests.is_empty());
    let requests = server.received_requests().await.unwrap();
    let body: Value = serde_json::from_slice(&requests[0].body).unwrap();
    assert_eq!(body["fields"]["start"]["type"], "datetime");
    assert!(body["fields"].get("guests").is_none());
    assert!(
        body["fields"]["start"]["instructions"]
            .as_str()
            .unwrap()
            .contains("tomorrow is Saturday 2026-10-24")
    );
    assert!(
        body["fields"]["start"]["instructions"]
            .as_str()
            .unwrap()
            .contains("prefer PM for 1 through 7")
    );
}

#[tokio::test]
async fn task_property_lists_map_to_catalog_names_without_requesting_nested_objects() {
    let draft = "notification click not going to target\nOn mobile the button does nothing\npriority urgent";
    let (server, extractor, _) = provider(response(json!({
        "title": answer("text", json!("notification click not going to target")),
        "body": answer("text", json!("On mobile the button does nothing\npriority urgent")),
        "due_date": answer("date", Value::Null),
        "property_0": answer("list", json!(["urgent"])),
        "property_1": answer("list", json!([]))
    })))
    .await;
    let mut request = input(InputIntent::Task, draft);
    request.property_definitions = vec![
        crate::domain::InputPropertyDefinition {
            name: "Priority".into(),
            options: vec!["Urgent".into(), "High".into()],
        },
        crate::domain::InputPropertyDefinition {
            name: "Status".into(),
            options: vec!["Todo".into(), "Done".into()],
        },
    ];
    let fields = extractor.extract(&request, usage()).await.unwrap();
    assert!(fields.due_date.is_none());
    assert_eq!(fields.properties.len(), 1);
    assert_eq!(fields.properties[0].name, "Priority");
    assert_eq!(fields.properties[0].values, ["urgent"]);
    let requests = server.received_requests().await.unwrap();
    let body: Value = serde_json::from_slice(&requests[0].body).unwrap();
    assert!(body["fields"].get("properties").is_none());
    assert_eq!(body["fields"]["property_0"]["type"], "list");
    assert!(
        body["fields"]["property_0"]["instructions"]
            .as_str()
            .unwrap()
            .contains("Priority")
    );
}

#[tokio::test]
async fn null_and_uncertain_answers_do_not_use_provider_guesses() {
    for answer in [
        json!({"type":"text", "value":null, "guess":"invented query", "confidence":0.99, "p_null":0.99}),
        json!({"type":"text", "value":"Keep this", "confidence":0.2, "p_null":0.1}),
    ] {
        let (_server, extractor, _) = provider(response(json!({"query":answer}))).await;
        let fields = extractor
            .extract(&input(InputIntent::Search, "Keep this"), usage())
            .await
            .unwrap();
        assert!(fields.query.is_none());
    }
}

#[tokio::test]
async fn unusable_answers_fail_but_still_record_provider_usage() {
    for answers in [
        json!({"query": answer("text", json!("invented"))}),
        json!({}),
        json!({"query": answer("list", json!(["launch"]))}),
        json!({"query": answer("unknown", json!("launch"))}),
        json!({"query": {"type":"text", "value":"launch", "confidence": 2.0}}),
    ] {
        let (_server, extractor, recorder) = provider(response(answers)).await;
        assert!(matches!(
            extractor
                .extract(&input(InputIntent::Search, "find launch"), usage())
                .await,
            Err(InputError::Extraction)
        ));
        assert_eq!(recorder.0.lock().unwrap().len(), 1);
    }
}

#[tokio::test]
async fn truncated_results_are_metered_and_rejected() {
    let mut body = response(json!({"query": answer("text", json!("launch"))}));
    body["result"]["truncated"] = json!(true);
    let (_server, extractor, recorder) = provider(body).await;
    assert!(matches!(
        extractor
            .extract(&input(InputIntent::Search, "find launch"), usage())
            .await,
        Err(InputError::Extraction)
    ));
    assert_eq!(recorder.0.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn http_failures_are_not_retried_before_domain_fallback() {
    for status in [401, 429, 503] {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(status))
            .expect(1)
            .mount(&server)
            .await;
        let recorder = Arc::new(Recorder::default());
        let extractor = ClairicFieldExtractor::with_base_url(
            ACCOUNT,
            "test-token",
            recorder.clone(),
            &server.uri(),
        )
        .unwrap();
        assert!(matches!(
            extractor
                .extract(&input(InputIntent::Search, "find launch"), usage())
                .await,
            Err(InputError::Extraction)
        ));
        assert!(recorder.0.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn ai_intent_does_not_send_an_empty_schema_to_cloudflare() {
    let server = MockServer::start().await;
    let extractor = ClairicFieldExtractor::with_base_url(
        ACCOUNT,
        "test-token",
        Arc::new(Recorder::default()),
        &server.uri(),
    )
    .unwrap();
    extractor
        .extract(&input(InputIntent::Ai, "Explain indexes"), usage())
        .await
        .unwrap();
    assert!(server.received_requests().await.unwrap().is_empty());
}

#[test]
fn configuration_validates_both_credentials_at_startup() {
    let recorder = || Arc::new(Recorder::default());
    assert!(
        ClairicFieldExtractor::from_config(
            &CloudflareAccountId::Runtime(" ".into()),
            &CloudflareApiToken::Runtime("".into()),
            recorder()
        )
        .unwrap()
        .is_none()
    );
    assert!(
        ClairicFieldExtractor::from_config(
            &CloudflareAccountId::Unset,
            &CloudflareApiToken::Unset,
            recorder()
        )
        .unwrap()
        .is_none()
    );
    assert!(matches!(
        ClairicFieldExtractor::from_config(
            &CloudflareAccountId::Unset,
            &CloudflareApiToken::Runtime("token".into()),
            recorder()
        ),
        Err(ClairicConfigError::Incomplete)
    ));
    for invalid in ["", "account/../other", "nothexaccount00000000000000000000"] {
        assert!(matches!(
            ClairicFieldExtractor::with_base_url(invalid, "token", recorder(), API_BASE),
            Err(ClairicConfigError::InvalidAccount)
        ));
    }
}

#[tokio::test]
async fn a_stalled_provider_returns_control_to_the_fallback() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_millis(200)))
        .expect(1)
        .mount(&server)
        .await;
    let mut extractor = ClairicFieldExtractor::with_base_url(
        ACCOUNT,
        "test-token",
        Arc::new(Recorder::default()),
        &server.uri(),
    )
    .unwrap();
    extractor.client = Client::builder()
        .timeout(Duration::from_millis(50))
        .build()
        .unwrap();
    assert!(matches!(
        extractor
            .extract(&input(InputIntent::Search, "find launch"), usage())
            .await,
        Err(InputError::Extraction)
    ));
}
