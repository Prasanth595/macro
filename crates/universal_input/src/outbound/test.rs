use super::clairic::{ClairicFieldExtractor, CloudflareAccountId, CloudflareApiToken};
use super::*;
use ai_usage::{AiFeature, NoOpUsageRecorder};

#[tokio::test]
#[ignore = "requires configured model provider credentials"]
async fn search_query_excludes_consumed_filters_without_losing_the_topic() {
    let recorder: Arc<dyn UsageRecorder> = Arc::new(NoOpUsageRecorder);
    let extractor = crate::domain::FallbackFieldExtractor::new(
        ClairicFieldExtractor::from_config(
            &CloudflareAccountId::new().unwrap_or(CloudflareAccountId::Unset),
            &CloudflareApiToken::new().unwrap_or(CloudflareApiToken::Unset),
            recorder.clone(),
        )
        .unwrap(),
        AgentFieldExtractor::new(recorder),
    );
    for (text, query, from, channel) in [
        (
            "search channels for messages from Person A",
            None,
            "Person A",
            None,
        ),
        (
            "search channels for messages from user@example.com",
            None,
            "user@example.com",
            None,
        ),
        (
            "search channels for messages from user@example.com in #team",
            None,
            "user@example.com",
            Some("#team"),
        ),
        (
            "search channels for messages from user@example.com about budget",
            Some("budget"),
            "user@example.com",
            None,
        ),
        (
            "search messages from user@example.com about growth in 2026",
            Some("growth in 2026"),
            "user@example.com",
            None,
        ),
    ] {
        let input = ExtractInputRequest {
            text: text.into(),
            intent: InputIntent::Search,
            revision: 1,
            reference_time: "2026-10-27T12:00:00Z".parse().unwrap(),
            time_zone: "UTC".into(),
            property_definitions: vec![],
        };
        let suggestions = extractor
            .extract(
                &input,
                UsageContext::system(AiFeature::DynamicCompletionsApi),
            )
            .await
            .unwrap();
        let InputSuggestions::Search(fields) = suggestions else {
            panic!("expected search suggestions");
        };
        assert_eq!(fields.query.as_deref(), query, "{text}");
        assert_eq!(fields.search_from, [from], "{text}");
        assert_eq!(
            fields.search_in,
            channel.into_iter().map(str::to_owned).collect::<Vec<_>>(),
            "{text}"
        );
        assert!(
            matches!(
                fields.search_scope.as_deref(),
                Some("channels" | "messages")
            ),
            "{text}"
        );
    }
}
