//! Turn a template and a complete set of bindings into the exact
//! configuration the routine create endpoint accepts. Pure: access to the
//! bound entities is checked before this runs.

use std::str::FromStr;

use chrono_tz::Tz;
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use mention_utils::parse::{RawSegment, XmlTag, raw_segments};
use mention_utils::serialize::{ChannelMentionParams, channel_mention, document_mention, user_mention};

use super::models::{
    BoundValue, Bindings, MAX_TEXT_VALUE_LEN, TaskTarget, TemplateDraft, TemplateEventFilter,
    TemplateRoutineTrigger, TemplateTrigger, VariableKey, VariableKind, VariableRef,
};
use crate::domain::event_trigger::{
    ActionTrigger, EventFilter, EventFilters, RoutineTrigger, RoutineTriggers,
};
use crate::domain::models::{
    ActionConfiguration, ActionKind, AgentTask, AgentTaskAgent, Schedule,
};

#[cfg(test)]
mod test;

/// Why bindings could not be rendered into a routine.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RenderError {
    #[error("{0} has no value")]
    Missing(VariableKey),
    #[error("{0} is used but not declared")]
    Undeclared(VariableKey),
    #[error("the value for {0} does not fit its kind")]
    WrongKind(VariableKey),
    #[error("the schedule for {0} is not a valid cron expression")]
    InvalidSchedule(VariableKey),
    #[error("the timezone for {0} is not valid")]
    InvalidTimezone(VariableKey),
    #[error("{0} is not a valid person")]
    InvalidUser(VariableKey),
    #[error("{0} needs text of at most 500 characters, without angle brackets")]
    InvalidText(VariableKey),
    #[error("the rendered trigger is not valid: {0}")]
    InvalidTrigger(String),
}

/// Check a free-text value. Angle brackets would let a value smuggle a
/// mention or other node into the instructions.
pub fn validate_text(key: &VariableKey, text: &str) -> Result<(), RenderError> {
    if text.trim().is_empty()
        || text.chars().count() > MAX_TEXT_VALUE_LEN
        || text.contains(['<', '>'])
    {
        return Err(RenderError::InvalidText(key.clone()));
    }
    Ok(())
}

/// Parse a schedule value the way the routine trigger will.
pub fn parse_schedule(
    key: &VariableKey,
    cron: &str,
    timezone: &str,
) -> Result<(Schedule, Tz), RenderError> {
    let schedule = Schedule::from_cron(cron.to_owned())
        .map_err(|_| RenderError::InvalidSchedule(key.clone()))?;
    let timezone = Tz::from_str(timezone).map_err(|_| RenderError::InvalidTimezone(key.clone()))?;
    Ok((schedule, timezone))
}

/// Render `draft` with `bindings` into a new, enabled routine named `name`.
pub fn render(
    draft: &TemplateDraft,
    name: String,
    bindings: &Bindings,
) -> Result<ActionConfiguration, RenderError> {
    let renderer = Renderer { draft, bindings };
    let (model, agent) = match renderer.value(&draft.task.target.key)? {
        BoundValue::Agent {
            target: TaskTarget::Model { model },
        } => (Some(model.clone()), None),
        BoundValue::Agent {
            target: TaskTarget::Agent { bot_id, model },
        } => (model.clone(), Some(AgentTaskAgent { bot_id: *bot_id })),
        _ => return Err(RenderError::WrongKind(draft.task.target.key.clone())),
    };
    let task = AgentTask {
        model,
        agent,
        prompt: draft.task.prompt.clone(),
        user_prompt: renderer.instructions()?,
    };
    Ok(ActionConfiguration {
        name,
        trigger: renderer.trigger()?,
        kind: ActionKind::Agent,
        task: serde_json::to_value(task).expect("agent tasks serialize"),
        enabled: true,
    })
}

struct Renderer<'a> {
    draft: &'a TemplateDraft,
    bindings: &'a Bindings,
}

impl Renderer<'_> {
    fn value(&self, key: &VariableKey) -> Result<&BoundValue, RenderError> {
        self.bindings
            .get(key)
            .ok_or_else(|| RenderError::Missing(key.clone()))
    }

    fn kind(&self, key: &VariableKey) -> Result<VariableKind, RenderError> {
        self.draft
            .variable(key)
            .map(|variable| variable.kind)
            .ok_or_else(|| RenderError::Undeclared(key.clone()))
    }

    fn instructions(&self) -> Result<String, RenderError> {
        let mut out = String::with_capacity(self.draft.task.user_prompt.len());
        for segment in raw_segments(&self.draft.task.user_prompt) {
            match segment {
                RawSegment::Tag {
                    tag: XmlTag::TemplateVariable(variable),
                    raw,
                } => match VariableKey::try_from(variable.key.into_owned()) {
                    Ok(key) => out.push_str(&self.instruction_value(&key)?),
                    // Not a slot any template could declare; keep it as written.
                    Err(_) => out.push_str(raw),
                },
                RawSegment::Tag { raw, .. } | RawSegment::Text(raw) => out.push_str(raw),
            }
        }
        Ok(out)
    }

    fn instruction_value(&self, key: &VariableKey) -> Result<String, RenderError> {
        let kind = self.kind(key)?;
        let rendered = match (kind, self.value(key)?) {
            (VariableKind::Text, BoundValue::Text { text }) => {
                validate_text(key, text)?;
                Ok(text.clone())
            }
            (VariableKind::User, BoundValue::User { user_id }) => {
                let user = MacroUserIdStr::parse_from_str(user_id)
                    .map_err(|_| RenderError::InvalidUser(key.clone()))?;
                user_mention(&user)
            }
            (VariableKind::Channel, BoundValue::Entity { id, name }) => {
                channel_mention(&id.to_string(), name, ChannelMentionParams::default())
            }
            (VariableKind::Document, BoundValue::Entity { id, name }) => {
                document_mention(&id.to_string(), name)
            }
            _ => return Err(RenderError::WrongKind(key.clone())),
        };
        Ok(rendered.expect("mention payloads serialize"))
    }

    fn trigger(&self) -> Result<ActionTrigger, RenderError> {
        match &self.draft.trigger {
            TemplateTrigger::Cron { schedule } => {
                let (schedule, timezone) = self.schedule(schedule)?;
                Ok(ActionTrigger::Cron { schedule, timezone })
            }
            TemplateTrigger::Events { filters } => Ok(ActionTrigger::Events {
                filters: self.filters(filters)?,
            }),
            TemplateTrigger::Multiple { triggers } => {
                let triggers = triggers
                    .iter()
                    .map(|trigger| match trigger {
                        TemplateRoutineTrigger::Cron { schedule } => {
                            let (schedule, timezone) = self.schedule(schedule)?;
                            Ok(RoutineTrigger::Cron { schedule, timezone })
                        }
                        TemplateRoutineTrigger::Events { filters } => Ok(RoutineTrigger::Events {
                            filters: self.filters(filters)?,
                        }),
                    })
                    .collect::<Result<Vec<_>, RenderError>>()?;
                Ok(ActionTrigger::Multiple {
                    triggers: RoutineTriggers::try_from(triggers)
                        .map_err(|error| RenderError::InvalidTrigger(error.to_owned()))?,
                })
            }
        }
    }

    fn schedule(&self, schedule: &VariableRef) -> Result<(Schedule, Tz), RenderError> {
        match self.value(&schedule.key)? {
            BoundValue::Schedule { cron, timezone } => parse_schedule(&schedule.key, cron, timezone),
            _ => Err(RenderError::WrongKind(schedule.key.clone())),
        }
    }

    fn filters(&self, filters: &[TemplateEventFilter]) -> Result<EventFilters, RenderError> {
        let filters = filters
            .iter()
            .map(|filter| {
                let ids = filter
                    .ids
                    .as_ref()
                    .map(|ids| {
                        ids.iter()
                            .map(|id| self.entity_id(id))
                            .collect::<Result<Vec<_>, _>>()
                    })
                    .transpose()?;
                EventFilter::new(filter.events.clone(), ids)
                    .map(|built| built.with_condition(filter.condition.clone()))
                    .map_err(|error| RenderError::InvalidTrigger(error.to_string()))
            })
            .collect::<Result<Vec<_>, RenderError>>()?;
        EventFilters::try_from(filters).map_err(|error| RenderError::InvalidTrigger(error.to_string()))
    }

    fn entity_id(&self, id: &VariableRef) -> Result<Uuid, RenderError> {
        match self.value(&id.key)? {
            BoundValue::Entity { id, .. } => Ok(*id),
            _ => Err(RenderError::WrongKind(id.key.clone())),
        }
    }
}
