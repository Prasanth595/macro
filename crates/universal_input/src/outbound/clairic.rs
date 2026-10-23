//! Cloudflare Workers AI typed extraction. Drafts and response bodies are never logged.
use std::{collections::BTreeMap, sync::Arc, time::Duration};

use ai_usage::{UsageAmount, UsageContext, UsageRecorder};
use macro_env_var::maybe_env_var;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::domain::{
    ExtractInputRequest, FieldExtractor, InputError, InputIntent, InputPropertySuggestion,
    InputSuggestions,
};

#[cfg(test)]
mod test;

maybe_env_var! {
    /// Optional Workers AI account. Must be paired with `CLOUDFLARE_API_TOKEN`.
    pub struct CloudflareAccountId;
}
maybe_env_var! {
    /// Optional token with Workers AI access. Never sent to the frontend.
    pub struct CloudflareApiToken;
}

const API_BASE: &str = "https://api.cloudflare.com/client/v4";
const MODEL: &str = "@cf/cloudflare/clairic";
/// Fail over promptly instead of retrying a preview endpoint while the user types.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const MIN_CONFIDENCE: f64 = 0.5;

/// Startup failures for the optional Clairic integration.
#[derive(Debug, thiserror::Error)]
pub enum ClairicConfigError {
    /// Partial configuration is a startup error, rather than a per-request failure.
    #[error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must both be set or both unset")]
    Incomplete,
    /// Account IDs are 32 hexadecimal characters; they cannot contain URL components.
    #[error("CLOUDFLARE_ACCOUNT_ID must contain 32 hexadecimal characters")]
    InvalidAccount,
    /// A client could not be constructed.
    #[error(transparent)]
    HttpClient(#[from] reqwest::Error),
}

/// Metered Clairic extraction behind the same port as the generative extractor.
pub struct ClairicFieldExtractor {
    client: Client,
    endpoint: String,
    token: String,
    recorder: Arc<dyn UsageRecorder>,
}

impl ClairicFieldExtractor {
    /// Build an optional provider once at startup, validating paired credentials.
    pub fn from_config(
        account: &CloudflareAccountId,
        token: &CloudflareApiToken,
        recorder: Arc<dyn UsageRecorder>,
    ) -> Result<Option<Self>, ClairicConfigError> {
        match (
            account.value().filter(|value| !value.trim().is_empty()),
            token.value().filter(|value| !value.trim().is_empty()),
        ) {
            (None, None) => Ok(None),
            (Some(account), Some(token)) => {
                Self::with_base_url(account, token, recorder, API_BASE).map(Some)
            }
            _ => Err(ClairicConfigError::Incomplete),
        }
    }

    fn with_base_url(
        account: &str,
        token: &str,
        recorder: Arc<dyn UsageRecorder>,
        base: &str,
    ) -> Result<Self, ClairicConfigError> {
        let account = account.trim();
        if account.len() != 32 || !account.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(ClairicConfigError::InvalidAccount);
        }
        let token = token.trim();
        if token.is_empty() {
            return Err(ClairicConfigError::Incomplete);
        }
        Ok(Self {
            client: Client::builder().timeout(REQUEST_TIMEOUT).build()?,
            endpoint: format!(
                "{}/accounts/{account}/ai/run/{MODEL}",
                base.trim_end_matches('/')
            ),
            token: token.to_owned(),
            recorder,
        })
    }
}

impl FieldExtractor for ClairicFieldExtractor {
    #[tracing::instrument(name = "extract clairic", skip_all, err, fields(
        otel.kind = "client",
        gen_ai.operation.name = "extract",
        gen_ai.provider.name = "cloudflare",
        gen_ai.request.model = MODEL,
        gen_ai.usage.input_tokens = tracing::field::Empty,
        gen_ai.usage.output_tokens = tracing::field::Empty,
        http.response.status_code = tracing::field::Empty,
    ))]
    async fn extract(
        &self,
        input: &ExtractInputRequest,
        usage: UsageContext,
    ) -> Result<InputSuggestions, InputError> {
        let request = ExtractionRequest::new(input)?;
        // AI needs no extraction; Clairic requires at least one field.
        if request.fields.is_empty() {
            return Ok(InputSuggestions::default());
        }
        let response = self
            .client
            .post(&self.endpoint)
            .bearer_auth(&self.token)
            .json(&request)
            .send()
            .await
            .map_err(|error| {
                tracing::warn!(timeout = error.is_timeout(), "Clairic request failed");
                InputError::Extraction
            })?;
        tracing::Span::current().record("http.response.status_code", response.status().as_u16());
        if !response.status().is_success() {
            return Err(InputError::Extraction);
        }
        let envelope: CloudflareResponse =
            response.json().await.map_err(|_| InputError::Extraction)?;
        let result = envelope.result.ok_or(InputError::Extraction)?;
        // Record provider-reported usage even when answers are missing or truncated.
        self.recorder.record(usage.into_event(
            MODEL.to_owned(),
            UsageAmount::Tokens {
                input: result.usage.input_tokens,
                output: result.usage.output_tokens,
                cache_read: 0,
                cache_write: 0,
            },
        ));
        tracing::Span::current().record("gen_ai.usage.input_tokens", result.usage.input_tokens);
        tracing::Span::current().record("gen_ai.usage.output_tokens", result.usage.output_tokens);
        if !envelope.success || result.truncated {
            return Err(InputError::Extraction);
        }
        result.suggestions(input, &request.fields)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum FieldType {
    Text,
    Date,
    Datetime,
    List,
}

#[derive(Serialize)]
struct FieldSpec {
    #[serde(rename = "type")]
    kind: FieldType,
    instructions: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    items: Option<FieldType>,
}

#[derive(Serialize)]
struct ExtractionRequest<'a> {
    model: &'static str,
    state: &'a str,
    reference_date: String,
    fields: BTreeMap<String, FieldSpec>,
}

impl<'a> ExtractionRequest<'a> {
    fn new(input: &'a ExtractInputRequest) -> Result<Self, InputError> {
        let zone = input
            .time_zone
            .parse::<chrono_tz::Tz>()
            .map_err(|_| InputError::InvalidTimeZone)?;
        let local = input.reference_time.with_timezone(&zone);
        // Keep context out of state: text answers must come from the actual draft.
        let tomorrow = local
            .date_naive()
            .succ_opt()
            .ok_or(InputError::Extraction)?;
        let calendar = format!(
            "Reference local calendar: today is {}; tomorrow is {}. Current local time: {}. Time zone: {}.",
            local.format("%A %Y-%m-%d"),
            tomorrow.format("%A %Y-%m-%d"),
            local.format("%H:%M"),
            input.time_zone
        );
        let mut fields = BTreeMap::new();
        let literal_body = input.literal_body().is_some();
        for &name in input.intent.extraction_fields() {
            if (name == "body" && literal_body) || (name == "guests" && !input.requests_guests()) {
                continue;
            }
            let guidance = input
                .intent
                .typed_field_guidance(name)
                .ok_or(InputError::Extraction)?;
            if name == "properties" {
                // Clairic has no nested-object type: each available task property gets a list.
                for (index, definition) in input.property_definitions.iter().enumerate() {
                    fields.insert(
                        format!("property_{index}"),
                        FieldSpec {
                            kind: FieldType::List,
                            items: Some(FieldType::Text),
                            instructions: format!(
                                "{guidance}\nProperty definition (data): {}",
                                serde_json::to_string(definition)
                                    .map_err(|_| InputError::Extraction)?
                            ),
                        },
                    );
                }
                continue;
            }
            let kind = match name {
                "start" | "end" => FieldType::Datetime,
                "due_date" => FieldType::Date,
                "recipients" | "guests" => FieldType::List,
                _ => FieldType::Text,
            };
            fields.insert(
                name.to_owned(),
                FieldSpec {
                    kind,
                    items: (kind == FieldType::List).then_some(FieldType::Text),
                    instructions: if matches!(kind, FieldType::Date | FieldType::Datetime) {
                        format!("{guidance}\n{calendar}")
                    } else {
                        guidance.to_owned()
                    },
                },
            );
        }
        Ok(Self {
            model: "clairic",
            state: &input.text,
            reference_date: local.format("%Y-%m-%d").to_string(),
            fields,
        })
    }
}

#[derive(Deserialize)]
struct CloudflareResponse {
    success: bool,
    result: Option<ExtractionResponse>,
}

#[derive(Deserialize)]
struct ExtractionResponse {
    // Decode individual answers after metering, so malformed answers still count.
    answers: BTreeMap<String, Value>,
    truncated: bool,
    usage: TokenUsage,
}

#[derive(Deserialize)]
struct TokenUsage {
    input_tokens: u64,
    output_tokens: u64,
}

#[derive(Deserialize)]
struct Answer {
    #[serde(rename = "type")]
    kind: FieldType,
    value: Value,
    confidence: Option<f64>,
    p_null: Option<f64>,
}

impl Answer {
    fn value(&self, spec: &FieldSpec, draft: &str) -> Result<Value, InputError> {
        if self.kind != spec.kind
            || [self.confidence, self.p_null]
                .into_iter()
                .flatten()
                .any(|n| !(0.0..=1.0).contains(&n))
        {
            return Err(InputError::Extraction);
        }
        if self.value.is_null()
            || self.confidence.is_some_and(|n| n < MIN_CONFIDENCE)
            || self.p_null.is_some_and(|n| n >= 0.5)
        {
            return Ok(if spec.kind == FieldType::List {
                serde_json::json!([])
            } else {
                Value::Null
            });
        }
        let valid = match spec.kind {
            FieldType::Text => self
                .value
                .as_str()
                .is_some_and(|s| !s.is_empty() && draft.contains(s)),
            FieldType::List => self.value.as_array().is_some_and(|values| {
                values.iter().all(|value| {
                    value
                        .as_str()
                        .is_some_and(|s| !s.is_empty() && draft.contains(s))
                })
            }),
            FieldType::Date => self
                .value
                .as_str()
                .is_some_and(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()),
            FieldType::Datetime => self.value.as_str().is_some_and(|s| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").is_ok()
                    || chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").is_ok()
                    || chrono::DateTime::parse_from_rfc3339(s).is_ok()
            }),
        };
        if !valid {
            return Err(InputError::Extraction);
        }
        Ok(self.value.clone())
    }
}

impl ExtractionResponse {
    fn suggestions(
        &self,
        input: &ExtractInputRequest,
        specs: &BTreeMap<String, FieldSpec>,
    ) -> Result<InputSuggestions, InputError> {
        let mut fields = serde_json::Map::new();
        let mut properties = vec![];
        for (name, spec) in specs {
            let answer: Answer = serde_json::from_value(
                self.answers
                    .get(name)
                    .ok_or(InputError::Extraction)?
                    .clone(),
            )
            .map_err(|_| InputError::Extraction)?;
            let value = answer.value(spec, &input.text)?;
            if let Some(index) = name.strip_prefix("property_") {
                let index: usize = index.parse().map_err(|_| InputError::Extraction)?;
                let values: Vec<String> =
                    serde_json::from_value(value).map_err(|_| InputError::Extraction)?;
                if !values.is_empty() {
                    properties.push(InputPropertySuggestion {
                        name: input.property_definitions[index].name.clone(),
                        values,
                    });
                }
            } else {
                fields.insert(name.clone(), value);
            }
        }
        if input.intent == InputIntent::Task {
            fields.insert(
                "properties".to_owned(),
                serde_json::to_value(properties).map_err(|_| InputError::Extraction)?,
            );
        }
        serde_json::from_value(Value::Object(fields)).map_err(|_| InputError::Extraction)
    }
}
