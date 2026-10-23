//! The deterministic half of sharing a routine: pull every person-specific
//! value out of a routine into a variable. Pure; the AI pass only renames,
//! describes and adds text variables on top of this.

use std::collections::BTreeMap;

use macro_uuid::Uuid;
use mention_utils::parse::{
    ParsedXmlText, PlainTextFormatter, RawSegment, XmlFormatter, XmlTag, raw_segments,
};
use mention_utils::serialize::template_variable;
use serde::Serialize;
use utoipa::ToSchema;

use super::ports::{DraftCandidate, DraftRequest, DraftSuggestions};
use super::render::validate_text;
use super::models::{
    BoundValue, Bindings, TaskTarget, TemplateDraft, TemplateEventFilter, TemplateRoutineTrigger,
    TemplateTask, TemplateTrigger, TemplateVariable, VariableKey, VariableKind, VariableMode,
    VariableRef,
};
use crate::domain::event_trigger::{ActionTrigger, EventEntityType, EventFilter, RoutineTrigger};
use crate::domain::models::{AgentTask, ResolvedTaskTarget, ScheduledAction};

#[cfg(test)]
mod test;

/// A proposed template plus the creator's own value for each variable. The
/// values go back to the creator only, so the share dialog can switch a
/// variable to fixed; they are never stored for variable slots.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct Extraction {
    pub draft: TemplateDraft,
    #[schema(value_type = BTreeMap<String, BoundValue>)]
    pub creator_values: Bindings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum ExtractError {
    #[error("the routine's task has no model or agent")]
    InvalidTask,
}

/// Build a template from `action` with a variable for its agent, each
/// schedule, each event filter id and each person, channel or document
/// mentioned in its instructions.
pub fn extract(action: &ScheduledAction) -> Result<Extraction, ExtractError> {
    let task: AgentTask =
        serde_json::from_value(action.task.clone()).map_err(|_| ExtractError::InvalidTask)?;
    let target = match task.resolve_target().map_err(|_| ExtractError::InvalidTask)? {
        ResolvedTaskTarget::Model { model } => TaskTarget::Model {
            model: model.clone(),
        },
        ResolvedTaskTarget::Agent { bot_id, model } => TaskTarget::Agent {
            bot_id,
            model: model.cloned(),
        },
    };
    let mut candidates = Candidates::default();
    candidates.push(
        VariableKind::Agent,
        BoundValue::Agent { target },
        VariableMode::Variable,
    );
    let user_prompt = candidates.instructions(&task.user_prompt);
    let trigger = candidates.trigger(&action.trigger);
    Ok(Extraction {
        draft: TemplateDraft {
            name: action.name.clone(),
            description: String::new(),
            task: TemplateTask {
                target: VariableRef::new(VariableKey::agent()),
                prompt: task.prompt,
                user_prompt,
            },
            trigger,
            variables: candidates.variables,
        },
        creator_values: candidates.values,
    })
}

#[derive(Default)]
struct Candidates {
    variables: Vec<TemplateVariable>,
    values: Bindings,
    by_entity: BTreeMap<String, VariableKey>,
    counts: BTreeMap<&'static str, usize>,
}

impl Candidates {
    fn push(&mut self, kind: VariableKind, value: BoundValue, mode: VariableMode) -> VariableKey {
        let (base, label, description) = defaults(kind);
        let count = self.counts.entry(base).or_default();
        *count += 1;
        let (key, label) = if *count == 1 {
            (base.to_owned(), label.to_owned())
        } else {
            (format!("{base}_{count}"), format!("{label} {count}"))
        };
        let key = VariableKey::try_from(key).expect("default keys are valid slugs");
        self.variables.push(TemplateVariable {
            key: key.clone(),
            label,
            description: description.to_owned(),
            kind,
            mode,
        });
        self.values.insert(key.clone(), value);
        key
    }

    /// One variable per distinct entity, however many places use it.
    fn entity(&mut self, kind: VariableKind, id: String, value: BoundValue) -> VariableKey {
        if let Some(key) = self.by_entity.get(&id) {
            return key.clone();
        }
        let key = self.push(kind, value, VariableMode::Variable);
        self.by_entity.insert(id, key.clone());
        key
    }

    fn instructions(&mut self, instructions: &str) -> String {
        let mut out = String::with_capacity(instructions.len());
        for segment in raw_segments(instructions) {
            let key = match &segment {
                RawSegment::Tag {
                    tag: XmlTag::User(user),
                    ..
                } => user.user_id.as_user().map(|user| {
                    self.entity(
                        VariableKind::User,
                        user.to_string(),
                        BoundValue::User {
                            user_id: user.to_string(),
                        },
                    )
                }),
                RawSegment::Tag {
                    tag: XmlTag::Document(document),
                    ..
                } => {
                    let id = document
                        .document_id
                        .as_deref()
                        .and_then(|id| id.parse::<Uuid>().ok());
                    let kind = match document.block_name.as_deref() {
                        Some("channel") => Some(VariableKind::Channel),
                        Some("md") => Some(VariableKind::Document),
                        _ => None,
                    };
                    id.zip(kind).map(|(id, kind)| {
                        self.entity(
                            kind,
                            id.to_string(),
                            BoundValue::Entity {
                                id,
                                name: document.document_name.to_string(),
                            },
                        )
                    })
                }
                RawSegment::Tag { .. } | RawSegment::Text(_) => None,
            };
            match (key, segment) {
                (Some(key), _) => out.push_str(
                    &template_variable(key.as_str()).expect("template variables serialize"),
                ),
                (None, RawSegment::Tag { raw, .. } | RawSegment::Text(raw)) => out.push_str(raw),
            }
        }
        out
    }

    fn trigger(&mut self, trigger: &ActionTrigger) -> TemplateTrigger {
        match trigger {
            ActionTrigger::Cron { schedule, timezone } => TemplateTrigger::Cron {
                schedule: self.schedule(schedule.as_str(), &timezone.to_string()),
            },
            ActionTrigger::Events { filters } => TemplateTrigger::Events {
                filters: self.filters(filters.as_slice()),
            },
            ActionTrigger::Multiple { triggers } => TemplateTrigger::Multiple {
                triggers: triggers
                    .as_slice()
                    .iter()
                    .map(|trigger| match trigger {
                        RoutineTrigger::Cron { schedule, timezone } => {
                            TemplateRoutineTrigger::Cron {
                                schedule: self.schedule(schedule.as_str(), &timezone.to_string()),
                            }
                        }
                        RoutineTrigger::Events { filters } => TemplateRoutineTrigger::Events {
                            filters: self.filters(filters.as_slice()),
                        },
                    })
                    .collect(),
            },
        }
    }

    /// Schedules are usually meant for everyone, so they start fixed.
    fn schedule(&mut self, cron: &str, timezone: &str) -> VariableRef {
        let value = BoundValue::Schedule {
            cron: cron.to_owned(),
            timezone: timezone.to_owned(),
        };
        VariableRef::new(self.push(
            VariableKind::Schedule,
            value.clone(),
            VariableMode::Fixed { value },
        ))
    }

    fn filters(&mut self, filters: &[EventFilter]) -> Vec<TemplateEventFilter> {
        filters
            .iter()
            .map(|filter| {
                let kind = match filter.events().first().map(|event| event.entity_type()) {
                    Some(EventEntityType::Channel) => VariableKind::Channel,
                    Some(EventEntityType::Document) | None => VariableKind::Document,
                    Some(entity_type) => VariableKind::EventEntity { entity_type },
                };
                let ids = filter.ids().map(|ids| {
                    ids.iter()
                        .map(|id| {
                            VariableRef::new(self.entity(
                                kind,
                                id.to_string(),
                                BoundValue::Entity {
                                    id: *id,
                                    name: String::new(),
                                },
                            ))
                        })
                        .collect()
                });
                TemplateEventFilter {
                    events: filter.events().to_vec(),
                    ids,
                    condition: filter.condition().cloned(),
                }
            })
            .collect()
    }
}

/// Key base, label and description for a fresh variable of `kind`.
fn defaults(kind: VariableKind) -> (&'static str, &'static str, &'static str) {
    match kind {
        VariableKind::Agent => ("agent", "Agent", "The agent or model that runs this routine."),
        VariableKind::Schedule => ("schedule", "Schedule", "When this routine runs."),
        VariableKind::Text => ("text", "Text", "Text this routine uses."),
        VariableKind::User => ("person", "Person", "A person this routine mentions."),
        VariableKind::Channel => ("channel", "Channel", "A channel this routine uses."),
        VariableKind::Document => ("document", "Document", "A document this routine uses."),
        VariableKind::EventEntity {
            entity_type: EventEntityType::EmailThread,
        } => (
            "email_thread",
            "Email thread",
            "An email thread this routine watches.",
        ),
        VariableKind::EventEntity {
            entity_type: EventEntityType::Call,
        } => ("call", "Call", "A call this routine watches."),
        VariableKind::EventEntity {
            entity_type: EventEntityType::Channel,
        } => ("channel", "Channel", "A channel this routine watches."),
        VariableKind::EventEntity {
            entity_type: EventEntityType::Document,
        } => ("document", "Document", "A document this routine watches."),
    }
}

const MAX_LABEL_LEN: usize = 80;
const MAX_SUGGESTED_DESCRIPTION_LEN: usize = 300;

/// What the drafting model sees of `extraction`: instructions with `{key}`
/// in place of variables, and each candidate with the creator's value as a
/// hint. This is the creator's own call, so their values may be included.
pub fn draft_request(extraction: &Extraction) -> DraftRequest {
    DraftRequest {
        name: extraction.draft.name.clone(),
        instructions: plain_instructions(&extraction.draft.task.user_prompt),
        candidates: extraction
            .draft
            .variables
            .iter()
            .map(|variable| DraftCandidate {
                key: variable.key.clone(),
                kind: variable.kind,
                hint: extraction
                    .creator_values
                    .get(&variable.key)
                    .and_then(value_hint),
            })
            .collect(),
    }
}

fn value_hint(value: &BoundValue) -> Option<String> {
    match value {
        BoundValue::Entity { name, .. } if !name.is_empty() => Some(name.clone()),
        BoundValue::User { user_id } => Some(user_id.clone()),
        BoundValue::Schedule { cron, timezone } => Some(format!("{cron} ({timezone})")),
        BoundValue::Text { text } => Some(text.clone()),
        BoundValue::Entity { .. } | BoundValue::Agent { .. } => None,
    }
}

/// Instructions as plain text, with `{key}` for each variable.
pub fn plain_instructions(instructions: &str) -> String {
    match ParsedXmlText::parse(instructions) {
        Ok(parsed) => PlainTextFormatter::format_xml_text(parsed).0,
        Err(_) => instructions.to_owned(),
    }
}

/// Apply the drafting model's suggestions on top of the deterministic
/// extraction. The model's output is untrusted: unknown keys are ignored,
/// text variables must quote the instructions exactly, and if the result is
/// not a valid template the deterministic one is returned unchanged.
pub fn apply_suggestions(extraction: Extraction, suggestions: DraftSuggestions) -> Extraction {
    let mut refined = extraction.clone();
    if let Some(name) = suggestions.name.filter(|name| fits(name, MAX_LABEL_LEN)) {
        refined.draft.name = name;
    }
    if let Some(description) = suggestions
        .description
        .filter(|description| fits(description, MAX_SUGGESTED_DESCRIPTION_LEN))
    {
        refined.draft.description = description;
    }
    for suggestion in suggestions.variables {
        let Some(variable) = refined
            .draft
            .variables
            .iter_mut()
            .find(|variable| variable.key.as_str() == suggestion.key)
        else {
            continue;
        };
        if fits(&suggestion.label, MAX_LABEL_LEN) {
            variable.label = suggestion.label;
        }
        if fits(&suggestion.description, MAX_SUGGESTED_DESCRIPTION_LEN) {
            variable.description = suggestion.description;
        }
        if variable.kind != VariableKind::Agent {
            variable.mode = match (suggestion.fixed, refined.creator_values.get(&variable.key)) {
                (true, Some(value)) => VariableMode::Fixed {
                    value: value.clone(),
                },
                _ => VariableMode::Variable,
            };
        }
    }
    for suggestion in suggestions.text_variables {
        let Ok(key) = VariableKey::try_from(suggestion.key) else {
            continue;
        };
        let text = suggestion.text;
        if refined.draft.variable(&key).is_some()
            || !fits(&suggestion.label, MAX_LABEL_LEN)
            || validate_text(&key, &text).is_err()
        {
            continue;
        }
        let Some(instructions) = replace_text(&refined.draft.task.user_prompt, &text, &key) else {
            continue;
        };
        refined.draft.task.user_prompt = instructions;
        let value = BoundValue::Text { text };
        refined.draft.variables.push(TemplateVariable {
            key: key.clone(),
            label: suggestion.label,
            description: suggestion
                .description
                .chars()
                .take(MAX_SUGGESTED_DESCRIPTION_LEN)
                .collect(),
            kind: VariableKind::Text,
            mode: if suggestion.fixed {
                VariableMode::Fixed {
                    value: value.clone(),
                }
            } else {
                VariableMode::Variable
            },
        });
        refined.creator_values.insert(key, value);
    }
    match refined.draft.validate() {
        Ok(()) => refined,
        Err(error) => {
            tracing::warn!(error = %error, "discarding template suggestions that don't validate");
            extraction
        }
    }
}

fn fits(text: &str, max: usize) -> bool {
    !text.trim().is_empty() && text.chars().count() <= max
}

/// Replace every occurrence of `text` in the plain-text parts of
/// `instructions` with a variable node. `None` when it never occurs.
fn replace_text(instructions: &str, text: &str, key: &VariableKey) -> Option<String> {
    let node = template_variable(key.as_str()).expect("template variables serialize");
    let mut found = false;
    let mut out = String::with_capacity(instructions.len());
    for segment in raw_segments(instructions) {
        match segment {
            RawSegment::Text(plain) if plain.contains(text) => {
                found = true;
                out.push_str(&plain.replace(text, &node));
            }
            RawSegment::Tag { raw, .. } | RawSegment::Text(raw) => out.push_str(raw),
        }
    }
    found.then_some(out)
}
