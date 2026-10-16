//! Composer inference policy, independent of HTTP and provider implementations.
use std::{
    future::Future,
    sync::{Arc, OnceLock},
};

use ai_billing::{AiAdmissionError, AiAdmissionService};
use ai_usage::{AiFeature, UsageContext};
use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use jev::domain::{YesNoClassifier, YesNoQuestion};
use macro_user_id::user_id::MacroUserIdStr;
use regex::Regex;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[cfg(test)]
mod test;

/// Domain-owned guidance for how the inference port interprets a draft.
pub const FIELD_EXTRACTION_GUIDANCE: &str = include_str!("domain/extract_fields_prompt.txt");

/// A destination the composer can prepare, but never execute through inference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum InputIntent {
    Ai,
    Search,
    Email,
    Note,
    Task,
    Calendar,
    Message,
}

impl InputIntent {
    /// Only the fields relevant to this destination may be extracted.
    pub fn extraction_fields(self) -> &'static [&'static str] {
        match self {
            Self::Ai => &[],
            Self::Search => &["query"],
            Self::Email => &["subject", "body", "recipients"],
            Self::Note => &["title", "body"],
            Self::Task => &["title", "body", "due_date", "properties"],
            Self::Calendar => &["title", "body", "start", "end", "location", "guests"],
            Self::Message => &["body", "recipients"],
        }
    }

    /// Intent-specific interpretation policy, supplied through the inference port.
    pub fn extraction_guidance(self) -> &'static str {
        match self {
            Self::Ai => "Return an empty JSON object.",
            Self::Search => "Extract query: the terms to find existing Macro content.",
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
    pub text: String,
    pub revision: u32,
}

/// Independent yes/no probabilities; these do not sum to one.
#[derive(Debug, Serialize, ToSchema)]
pub struct IntentScore {
    pub intent: InputIntent,
    pub score: f32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ClassifyInputResponse {
    pub revision: u32,
    pub scores: Vec<IntentScore>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ExtractInputRequest {
    pub text: String,
    pub intent: InputIntent,
    pub revision: u32,
    pub reference_time: DateTime<Utc>,
    pub time_zone: String,
    /// Available task fields and display values, never authorized entity IDs.
    #[serde(default)]
    pub property_definitions: Vec<InputPropertyDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InputPropertyDefinition {
    pub name: String,
    #[serde(default)]
    pub options: Vec<String>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InputPropertySuggestion {
    pub name: String,
    pub values: Vec<String>,
}

/// Suggestions are text, never authorized recipient, channel or calendar IDs.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InputSuggestions {
    pub title: Option<String>,
    pub body: Option<String>,
    pub subject: Option<String>,
    #[serde(default)]
    pub recipients: Vec<String>,
    pub query: Option<String>,
    /// Local wall-clock values, interpreted in the request's IANA timezone.
    pub start: Option<String>,
    pub end: Option<String>,
    pub due_date: Option<String>,
    pub location: Option<String>,
    /// Only populated when an invitation was explicitly requested.
    #[serde(default)]
    pub guests: Vec<String>,
    /// Display names/values that the client resolves against available task fields.
    #[serde(default)]
    pub properties: Vec<InputPropertySuggestion>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ExtractInputResponse {
    pub revision: u32,
    pub intent: InputIntent,
    pub suggestions: InputSuggestions,
}

#[derive(Debug, thiserror::Error)]
pub enum InputError {
    #[error("Enter between 1 and 16000 characters")]
    InvalidText,
    #[error("Choose a valid timezone")]
    InvalidTimeZone,
    #[error("Choose valid task field definitions")]
    InvalidProperties,
    #[error("Automatic detection is unavailable; choose a type to continue")]
    Unavailable,
    #[error("Could not extract fields; fill them in to continue")]
    Extraction,
    #[error(transparent)]
    Admission(#[from] AiAdmissionError),
}

/// The capability needed to suggest fields without tools or writes.
pub trait FieldExtractor: Send + Sync {
    fn extract(
        &self,
        input: &ExtractInputRequest,
        usage: UsageContext,
    ) -> impl Future<Output = Result<InputSuggestions, InputError>> + Send;
}

pub struct UniversalInputService<C, E> {
    classifier: Option<C>,
    extractor: E,
    admission: Arc<dyn AiAdmissionService>,
}

impl<C: YesNoClassifier, E: FieldExtractor> UniversalInputService<C, E> {
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

    #[tracing::instrument(skip_all, err)]
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

    #[tracing::instrument(skip_all, err)]
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
        // Reject nonexistent/ambiguous wall times rather than silently shifting an event at DST.
        for value in [&mut suggestions.start, &mut suggestions.end] {
            *value = value
                .as_deref()
                .and_then(|text| normalize_event_time(text, zone));
        }
        if input.intent == InputIntent::Calendar {
            suggestions.end = event_end(&input.text, &suggestions, zone);
        }
        if input.intent == InputIntent::Task {
            suggestions.body = task_body(&suggestions);
        }
        Ok(ExtractInputResponse {
            revision: input.revision,
            intent: input.intent,
            suggestions,
        })
    }
}

fn task_body(fields: &InputSuggestions) -> Option<String> {
    static DUE_LINE: OnceLock<Regex> = OnceLock::new();
    let due_line = DUE_LINE.get_or_init(|| Regex::new(
        r"(?i)^due(?:\s+date)?\s*:?\s*(?:today|tomorrow|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})$"
    ).expect("fixed due metadata expression"));
    let body = fields
        .body
        .as_deref()?
        .lines()
        .filter(|line| {
            let text = line.trim().to_lowercase();
            let property_line = fields.properties.iter().any(|field| {
                if field.values.is_empty() {
                    return false;
                }
                let name = field.name.to_lowercase();
                let Some(rest) = text.strip_prefix(&name) else {
                    return false;
                };
                if !rest.starts_with([' ', ':', '=']) {
                    return false;
                }
                let mut values = rest
                    .trim_start_matches([' ', ':', '='])
                    .split([',', ';'])
                    .map(|value| value.trim().to_owned())
                    .collect::<Vec<_>>();
                let mut extracted = field
                    .values
                    .iter()
                    .map(|value| value.trim().to_lowercase())
                    .collect::<Vec<_>>();
                values.sort();
                extracted.sort();
                values == extracted
            });
            !property_line && !(fields.due_date.is_some() && due_line.is_match(&text))
        })
        .collect::<Vec<_>>()
        .join("\n");
    (!body.trim().is_empty()).then_some(body)
}

fn event_end(text: &str, fields: &InputSuggestions, zone: chrono_tz::Tz) -> Option<String> {
    static DURATION: OnceLock<Regex> = OnceLock::new();
    static START_OFFSET: OnceLock<Regex> = OnceLock::new();
    static EXPLICIT_END: OnceLock<Regex> = OnceLock::new();
    static OTHER_DURATION: OnceLock<Regex> = OnceLock::new();
    let explicit_end = EXPLICIT_END.get_or_init(|| {
        Regex::new(r"(?i)(?:\b(?:until|ends?(?:\s+at)?|to)\s+(?:\d{4}-\d{2}-\d{2}[T\s])?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|(?:^|[\s(])\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b)")
            .expect("fixed end-time expression")
    });
    if explicit_end.is_match(text) {
        return fields.end.clone();
    }
    let start_offset = START_OFFSET.get_or_init(|| {
        Regex::new(
            r"(?ix)\b(?:
          (?:in|after)\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?)
            (?:\s+(?:and\s+)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?))*
          |\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?)
            (?:\s+(?:and\s+)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?))*
            \s+(?:from\s+now|later)
        )\b",
        )
        .expect("fixed start-offset expression")
    });
    // Relative starts are interpreted by the extractor, never added to the duration.
    let duration_text = start_offset.replace_all(text, " ");
    let duration = DURATION.get_or_init(|| {
        Regex::new(r"(?i)\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b")
            .expect("fixed duration expression")
    });
    let captures = duration.captures_iter(&duration_text).collect::<Vec<_>>();
    let other_duration = OTHER_DURATION.get_or_init(|| {
        Regex::new(r"(?i)\b(?:hours?|hrs?|minutes?|mins?|days?|weeks?|duration)\b|\bfor\s+\d+(?:\.\d+)?\s*[hm](?:\b|\d)")
            .expect("fixed other-duration expression")
    });
    let unparsed_duration = duration.replace_all(&duration_text, " ");
    if other_duration.is_match(&unparsed_duration) {
        // Preserve the inferred end when duration wording is only partially understood.
        return fields.end.clone();
    }
    let minutes = captures.iter().try_fold(0.0, |total, capture| {
        let amount = capture[1].parse::<f64>().ok()?;
        let unit = capture[2].to_ascii_lowercase();
        Some(total + amount * if unit.starts_with('h') { 60.0 } else { 1.0 })
    })?;
    let minutes = if captures.is_empty() { 60.0 } else { minutes };
    if !minutes.is_finite() || minutes <= 0.0 || minutes > i32::MAX as f64 {
        return None;
    }
    let start = NaiveDateTime::parse_from_str(fields.start.as_deref()?, "%Y-%m-%dT%H:%M").ok()?;
    let end = zone
        .from_local_datetime(&start)
        .single()?
        .checked_add_signed(chrono::Duration::seconds((minutes * 60.0).round() as i64))?;
    Some(end.format("%Y-%m-%dT%H:%M").to_string())
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
