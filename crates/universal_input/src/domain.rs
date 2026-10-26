//! Composer inference policy, independent of HTTP and provider implementations.
use std::{future::Future, sync::Arc};

use ai_billing::{AiAdmissionError, AiAdmissionService};
use ai_usage::{AiFeature, UsageContext};
use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use jev::domain::{YesNoClassifier, YesNoQuestion};
use macro_user_id::user_id::MacroUserIdStr;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[cfg(test)]
mod test;

mod fallback;
pub use fallback::FallbackFieldExtractor;
mod typed_guidance;

/// Domain-owned guidance for how the inference port interprets a draft.
pub const FIELD_EXTRACTION_GUIDANCE: &str = include_str!("domain/extract_fields_prompt.txt");

/// A destination the composer can prepare, but never execute through inference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum InputIntent {
    /// Ask an AI assistant to answer or generate content.
    Ai,
    /// Find existing content in Macro.
    Search,
    /// Compose an outgoing email.
    Email,
    /// Save a Markdown note.
    Note,
    /// Create a tracked task.
    Task,
    /// Schedule a calendar event.
    Calendar,
    /// Send a chat message to people or a channel.
    Message,
}

impl InputIntent {
    /// Only the fields relevant to this destination may be extracted.
    pub fn extraction_fields(self) -> &'static [&'static str] {
        match self {
            Self::Ai => &[],
            Self::Search => &["query", "search_scope", "search_from", "search_in"],
            Self::Email => &["subject", "body", "recipients"],
            Self::Note => &["title"],
            Self::Task => &["title", "body", "due_date", "properties"],
            Self::Calendar => &[
                "title",
                "body",
                "start",
                "end",
                "start_assumption",
                "location",
                "guests",
            ],
            Self::Message => &["body", "recipients"],
        }
    }

    /// Intent-specific interpretation policy, supplied through the inference port.
    pub fn extraction_guidance(self) -> &'static str {
        match self {
            Self::Ai => "Return an empty JSON object.",
            Self::Search => include_str!("domain/extract_search_prompt.txt"),
            Self::Email => include_str!("domain/extract_email_prompt.txt"),
            Self::Note => include_str!("domain/extract_note_prompt.txt"),
            Self::Task => include_str!("domain/extract_task_prompt.txt"),
            Self::Calendar => include_str!("domain/extract_calendar_prompt.txt"),
            Self::Message => include_str!("domain/extract_message_prompt.txt"),
        }
    }
}

/// Fixed questions keep the public API from becoming an arbitrary model proxy.
pub const INTENT_QUESTIONS: [(InputIntent, &str); 7] = [
    (
        InputIntent::Ai,
        "Is the author directly asking an AI assistant to answer, explain, research, generate or draft content? 'Ask AI to draft an email to Julia' is YES. Questions or requests in the body after an email/chat addressing line are for that recipient, not AI. Directly composing an email, message, note, task or event is NO.",
    ),
    (
        InputIntent::Search,
        "Is the author trying to find existing content in Macro (documents, emails, tasks, messages), rather than asking for an explanation or web research?",
    ),
    (
        InputIntent::Email,
        "Is the author composing an email to send? A leading 'email Julia', 'email to john@example.com' or 'send an email to Julia' is YES; following lines are email body even with action requests, bugs or rescheduling dates. Judge the requested channel, not the body topic. 'Remind me to email Julia tomorrow', 'create a task to email Julia' and asking AI to draft an email are NO. A greeting alone is insufficient.",
    ),
    (
        InputIntent::Note,
        "Is this content to keep as a Markdown note or document, such as observations, prose, an outline or reference material, rather than a question, a message to someone, or an action to perform? Bug reports, broken behavior, user problems, and reports with a priority or severity should be tracked as tasks instead of notes, even without an explicit fix instruction.",
    ),
    (
        InputIntent::Task,
        "Is this a to-do, deliverable, bug report or actionable problem to track? Bare broken behavior and 'user unable to click on notification; priority high' are YES. 'Remind me to email Julia tomorrow' is YES. A leading 'email Julia' or 'DM Julia' is NO, even with actionable requests, bugs or dates in its body. Asking AI to draft content is NO. 'Finish report by Friday' is a task; 'Call John at 3pm tomorrow' is a calendar event.",
    ),
    (
        InputIntent::Calendar,
        "Is this an activity to put on a calendar at a particular time, such as 'Call John at 3pm tomorrow'? Timed calls are YES even without 'schedule'. A deliverable with a deadline is NO. A leading email/chat addressing instruction is NO: dates, meetings or rescheduling in its outgoing body do not create an event.",
    ),
    (
        InputIntent::Message,
        "Is the author composing a chat message or asking to DM someone or post to a channel, rather than composing email or asking an AI for help? There should be evidence of a chat recipient or conversational message intent.",
    ),
];

/// A draft snapshot. Revisions are opaque to the server and echoed to the client.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ClassifyInputRequest {
    /// Current draft text to classify without executing it.
    pub text: String,
    /// Opaque client revision used to discard stale predictions.
    pub revision: u32,
}

/// Independent yes/no probabilities; these do not sum to one.
#[derive(Debug, Serialize, ToSchema)]
pub struct IntentScore {
    /// Destination evaluated by the classifier.
    pub intent: InputIntent,
    /// Independent probability between zero and one.
    pub score: f32,
}

/// Ranked-type evidence for a particular client draft revision.
#[derive(Debug, Serialize, ToSchema)]
pub struct ClassifyInputResponse {
    /// Revision echoed from the classification request.
    pub revision: u32,
    /// Independent scores in the fixed intent-question order.
    pub scores: Vec<IntentScore>,
}

/// Draft snapshot and local context used to suggest editable destination fields.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ExtractInputRequest {
    /// Original draft text; inference must not execute its instructions.
    pub text: String,
    /// Destination whose fields should be extracted.
    pub intent: InputIntent,
    /// Opaque client revision used to discard stale suggestions.
    pub revision: u32,
    /// Reference instant for interpreting relative dates.
    pub reference_time: DateTime<Utc>,
    /// IANA timezone for interpreting local dates and clock times.
    pub time_zone: String,
    /// Available task fields and display values, never authorized entity IDs.
    #[serde(default)]
    pub property_definitions: Vec<InputPropertyDefinition>,
}

/// A task property and the display values available for extraction.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InputPropertyDefinition {
    /// Property display name from the client's catalog.
    pub name: String,
    /// Allowed display values; an empty list permits free-text suggestions.
    #[serde(default)]
    pub options: Vec<String>,
}

/// Suggested display values to resolve against a real task-property catalog.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InputPropertySuggestion {
    /// Property display name, never an authorized identifier.
    pub name: String,
    /// Suggested display values, never authorized entity identifiers.
    pub values: Vec<String>,
}

/// Suggestions are text, never authorized recipient, channel or calendar IDs.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InputSuggestions {
    /// Suggested note, task, or event title.
    pub title: Option<String>,
    /// Suggested Markdown content or outgoing message body.
    pub body: Option<String>,
    /// Suggested outgoing email subject.
    pub subject: Option<String>,
    /// Person or channel names for the client to resolve.
    #[serde(default)]
    pub recipients: Vec<String>,
    /// Terms to find existing Macro content.
    pub query: Option<String>,
    /// Verbatim noun naming the requested search category, such as messages or tasks.
    pub search_scope: Option<String>,
    /// Explicit sender, speaker, or task-creator names for the client to resolve.
    #[serde(default)]
    pub search_from: Vec<String>,
    /// Explicit channel names for the client to resolve.
    #[serde(default)]
    pub search_in: Vec<String>,
    /// Local wall-clock values, interpreted in the request's IANA timezone.
    pub start: Option<String>,
    /// Verbatim clock phrase whose missing AM/PM required an editable assumption.
    pub start_assumption: Option<String>,
    /// Event end as a local wall-clock value in the request's timezone.
    pub end: Option<String>,
    /// Task deadline as a local ISO date.
    pub due_date: Option<String>,
    /// Human-readable event venue or meeting URL.
    pub location: Option<String>,
    /// Only populated when an invitation was explicitly requested.
    #[serde(default)]
    pub guests: Vec<String>,
    /// Display names/values that the client resolves against available task fields.
    #[serde(default)]
    pub properties: Vec<InputPropertySuggestion>,
}

/// Validated field suggestions for a particular destination and draft revision.
#[derive(Debug, Serialize, ToSchema)]
pub struct ExtractInputResponse {
    /// Revision echoed from the extraction request.
    pub revision: u32,
    /// Destination echoed from the extraction request.
    pub intent: InputIntent,
    /// Editable fields after domain normalization and source-preservation rules.
    pub suggestions: InputSuggestions,
}

/// Input validation, admission, and provider failures exposed by inference.
#[derive(Debug, thiserror::Error)]
pub enum InputError {
    /// Draft text is empty or exceeds the supported character limit.
    #[error("Enter between 1 and 16000 characters")]
    InvalidText,
    /// The requested IANA timezone is not recognized.
    #[error("Choose a valid timezone")]
    InvalidTimeZone,
    /// The supplied task-property catalog exceeds supported bounds.
    #[error("Choose valid task field definitions")]
    InvalidProperties,
    /// Classification or the requested inference provider is unavailable.
    #[error("Automatic detection is unavailable; choose a type to continue")]
    Unavailable,
    /// A provider failed to return usable field suggestions.
    #[error("Could not extract fields; fill them in to continue")]
    Extraction,
    /// Shared AI admission policy rejected the request.
    #[error(transparent)]
    Admission(#[from] AiAdmissionError),
}

/// The capability needed to suggest fields without tools or writes.
pub trait FieldExtractor: Send + Sync {
    /// Suggest destination fields without tools or writes, recording attributed usage.
    fn extract(
        &self,
        input: &ExtractInputRequest,
        usage: UsageContext,
    ) -> impl Future<Output = Result<InputSuggestions, InputError>> + Send;
}

/// Read-only inference use cases with admission checks and domain normalization.
pub struct UniversalInputService<C, E> {
    classifier: Option<C>,
    extractor: E,
    admission: Arc<dyn AiAdmissionService>,
}

impl<C: YesNoClassifier, E: FieldExtractor> UniversalInputService<C, E> {
    /// Compose classification and extraction ports with the shared admission policy.
    pub fn new(
        classifier: Option<C>,
        extractor: E,
        admission: Arc<dyn AiAdmissionService>,
    ) -> Self {
        Self {
            classifier,
            extractor,
            admission,
        }
    }

    /// Classify a bounded draft after admission, returning independent intent scores.
    #[tracing::instrument(name = "universal_input.classify", skip_all, err,
        fields(revision = input.revision, draft_chars = input.text.chars().count()))]
    pub async fn classify(
        &self,
        user: MacroUserIdStr<'static>,
        input: ClassifyInputRequest,
    ) -> Result<ClassifyInputResponse, InputError> {
        validate_text(&input.text)?;
        let classifier = self.classifier.as_ref().ok_or(InputError::Unavailable)?;
        self.admission
            .admit(&user, AiFeature::DynamicCompletionsApi)
            .await?;
        let questions = INTENT_QUESTIONS
            .iter()
            .map(|(_, text)| {
                YesNoQuestion::try_from(*text).expect("fixed intent question is valid")
            })
            .collect::<Vec<_>>();
        let scores = classifier
            .classify(
                UsageContext::new(AiFeature::DynamicCompletionsApi, user),
                &serde_json::json!({ "draft": input.text }),
                &questions,
            )
            .await
            .map_err(|_| InputError::Unavailable)?;
        if scores.len() != INTENT_QUESTIONS.len() {
            return Err(InputError::Unavailable);
        }
        Ok(ClassifyInputResponse {
            revision: input.revision,
            scores: INTENT_QUESTIONS
                .iter()
                .zip(scores)
                .map(|((intent, _), score)| IntentScore {
                    intent: *intent,
                    score: score.get(),
                })
                .collect(),
        })
    }

    /// Extract fields after admission and apply source, timezone, and duration rules.
    #[tracing::instrument(name = "universal_input.extract", skip_all, err,
        fields(intent = ?input.intent, revision = input.revision, draft_chars = input.text.chars().count()))]
    pub async fn extract(
        &self,
        user: MacroUserIdStr<'static>,
        input: ExtractInputRequest,
    ) -> Result<ExtractInputResponse, InputError> {
        validate_text(&input.text)?;
        if input.property_definitions.len() > 64
            || input.property_definitions.iter().any(|field| {
                field.name.len() > 120
                    || field.options.len() > 64
                    || field.options.iter().any(|option| option.len() > 120)
            })
        {
            return Err(InputError::InvalidProperties);
        }
        let zone = input
            .time_zone
            .parse::<chrono_tz::Tz>()
            .map_err(|_| InputError::InvalidTimeZone)?;
        self.admission
            .admit(&user, AiFeature::DynamicCompletionsApi)
            .await?;
        let mut suggestions = self
            .extractor
            .extract(
                &input,
                UsageContext::new(AiFeature::DynamicCompletionsApi, user),
            )
            .await?;
        if input.intent == InputIntent::Note {
            suggestions.body = Some(input.text.clone());
        }
        if input.intent == InputIntent::Email && suggestions.subject.is_none() {
            suggestions.subject = suggestions.body.as_deref().and_then(|body| {
                body.lines()
                    .map(str::trim)
                    .find(|line| !line.is_empty())
                    .map(|line| line.chars().take(80).collect())
            });
        }
        // Validate extracted values without reinterpreting the draft's language.
        let missing_end = suggestions.end.is_none();
        normalize_event_times(&mut suggestions, zone);
        if input.intent == InputIntent::Calendar {
            if missing_end || suggestions.end.is_some() {
                suggestions.end = event_end(&suggestions, zone);
            }
            normalize_event_times(&mut suggestions, zone);
            suggestions.start_assumption = suggestions.start_assumption.filter(|phrase| {
                suggestions.start.is_some() && !phrase.is_empty() && input.text.contains(phrase)
            });
        }
        Ok(ExtractInputResponse {
            revision: input.revision,
            intent: input.intent,
            suggestions,
        })
    }
}

fn event_end(fields: &InputSuggestions, zone: chrono_tz::Tz) -> Option<String> {
    let start = NaiveDateTime::parse_from_str(fields.start.as_deref()?, "%Y-%m-%dT%H:%M").ok()?;
    if let Some(end) = fields.end.as_deref() {
        let end = NaiveDateTime::parse_from_str(end, "%Y-%m-%dT%H:%M").ok()?;
        if end < start {
            return None;
        }
        if end > start {
            return Some(end.format("%Y-%m-%dT%H:%M").to_string());
        }
    }
    // A missing or zero-length end receives the product's one-hour default.
    let end = zone
        .from_local_datetime(&start)
        .single()?
        .checked_add_signed(chrono::Duration::hours(1))?;
    Some(end.format("%Y-%m-%dT%H:%M").to_string())
}

fn normalize_event_times(fields: &mut InputSuggestions, zone: chrono_tz::Tz) {
    for value in [&mut fields.start, &mut fields.end] {
        *value = value
            .as_deref()
            .and_then(|text| normalize_event_time(text, zone));
    }
}

fn normalize_event_time(text: &str, zone: chrono_tz::Tz) -> Option<String> {
    let text = text.trim();
    let local = DateTime::parse_from_rfc3339(text)
        .map(|date| date.with_timezone(&zone).naive_local())
        .ok()
        .or_else(|| {
            ["%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S%.f"]
                .iter()
                .find_map(|format| NaiveDateTime::parse_from_str(text, format).ok())
        })?;
    zone.from_local_datetime(&local).single()?;
    Some(local.format("%Y-%m-%dT%H:%M").to_string())
}

fn validate_text(text: &str) -> Result<(), InputError> {
    if text.trim().is_empty() || text.chars().count() > 16_000 {
        return Err(InputError::InvalidText);
    }
    Ok(())
}
