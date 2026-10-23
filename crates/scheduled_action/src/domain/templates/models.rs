use std::collections::{BTreeMap, BTreeSet};

use bot_id::BotId;
use chrono::{DateTime, Utc};
use jev::domain::YesNoQuestion;
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use mention_utils::parse::{RawSegment, XmlTag, raw_segments};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::domain::event_trigger::{EventEntityType, EventName};
use crate::domain::models::RoutineModelId;

#[cfg(test)]
mod test;

/// The variable every template has: the agent or model that runs it. It is
/// never fixed, because an activator may not be allowed to use the creator's.
pub const AGENT_VARIABLE: &str = "agent";
pub const MAX_VARIABLES: usize = 50;
const MAX_KEY_LEN: usize = 64;
const MAX_NAME_LEN: usize = 200;
const MAX_DESCRIPTION_LEN: usize = 1_000;
const MAX_INSTRUCTIONS_LEN: usize = 100_000;
pub const MAX_TEXT_VALUE_LEN: usize = 500;

/// A stable slug naming a variable within one template: `urgent_channel`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, ToSchema)]
#[serde(try_from = "String", into = "String")]
#[schema(value_type = String)]
pub struct VariableKey(String);

impl VariableKey {
    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn agent() -> Self {
        Self(AGENT_VARIABLE.to_owned())
    }
}

impl TryFrom<String> for VariableKey {
    type Error = TemplateError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        let valid = !value.is_empty()
            && value.len() <= MAX_KEY_LEN
            && value.starts_with(|c: char| c.is_ascii_lowercase())
            && value
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
        if !valid {
            return Err(TemplateError::InvalidKey(value));
        }
        Ok(Self(value))
    }
}

impl From<VariableKey> for String {
    fn from(key: VariableKey) -> Self {
        key.0
    }
}

impl std::fmt::Display for VariableKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// `{"$var": "<key>"}`: where a template holds a variable instead of a value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct VariableRef {
    #[serde(rename = "$var")]
    pub key: VariableKey,
}

impl VariableRef {
    pub fn new(key: VariableKey) -> Self {
        Self { key }
    }
}

/// What a variable stands for, and so which picker fills it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VariableKind {
    /// The routine's target: an agent, or a model on Macro's runtime.
    Agent,
    /// A cron schedule and its timezone.
    Schedule,
    /// Free text, such as a company or an email domain.
    Text,
    User,
    Channel,
    Document,
    /// An email thread or call watched by an event trigger.
    EventEntity {
        entity_type: EventEntityType,
    },
}

impl VariableKind {
    /// Kinds that appear in the instructions and render as text or a mention.
    fn fits_instructions(self) -> bool {
        matches!(
            self,
            Self::Text | Self::User | Self::Channel | Self::Document
        )
    }

    /// Kinds that can stand for an id in an event filter of `entity_type`.
    fn fits_event_ids(self, entity_type: EventEntityType) -> bool {
        match self {
            Self::Channel => entity_type == EventEntityType::Channel,
            Self::Document => entity_type == EventEntityType::Document,
            Self::EventEntity { entity_type: kind } => kind == entity_type,
            Self::Agent | Self::Schedule | Self::Text | Self::User => false,
        }
    }
}

/// The agent or model a routine runs on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TaskTarget {
    Model {
        model: RoutineModelId,
    },
    Agent {
        #[schema(value_type = String, format = Uuid)]
        bot_id: BotId,
        /// Overrides the agent's default model.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        model: Option<RoutineModelId>,
    },
}

/// A value for one variable: fixed by the creator, or chosen at activation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BoundValue {
    Agent {
        target: TaskTarget,
    },
    Schedule {
        cron: String,
        timezone: String,
    },
    Text {
        text: String,
    },
    User {
        user_id: String,
    },
    /// A channel, document, email thread or call. `name` is the label its
    /// mention shows; access is always checked by `id`.
    Entity {
        #[schema(value_type = String, format = Uuid)]
        id: Uuid,
        #[serde(default)]
        name: String,
    },
}

impl BoundValue {
    /// Whether this value can fill a variable of `kind`, by shape only.
    pub fn fits(&self, kind: VariableKind) -> bool {
        matches!(
            (self, kind),
            (Self::Agent { .. }, VariableKind::Agent)
                | (Self::Schedule { .. }, VariableKind::Schedule)
                | (Self::Text { .. }, VariableKind::Text)
                | (Self::User { .. }, VariableKind::User)
                | (
                    Self::Entity { .. },
                    VariableKind::Channel
                        | VariableKind::Document
                        | VariableKind::EventEntity { .. }
                )
        )
    }
}

/// Whether each activator fills a variable in, or everyone gets the
/// creator's value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VariableMode {
    Variable,
    Fixed { value: BoundValue },
}

/// A named slot in a template.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TemplateVariable {
    pub key: VariableKey,
    pub label: String,
    /// One line, written for the person activating the template.
    pub description: String,
    pub kind: VariableKind,
    pub mode: VariableMode,
}

/// The routine's task with its target replaced by the agent variable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TemplateTask {
    pub target: VariableRef,
    #[serde(default)]
    pub prompt: String,
    /// Markdown instructions with `<m-template-variable>` nodes in place of
    /// person-specific values.
    pub user_prompt: String,
}

/// An event filter whose ids may be variables. Filters without ids are
/// already relative to whoever owns the routine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TemplateEventFilter {
    pub events: Vec<EventName>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ids: Option<Vec<VariableRef>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>)]
    pub condition: Option<YesNoQuestion>,
}

/// One entry of a template's trigger list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum TemplateRoutineTrigger {
    Cron { schedule: VariableRef },
    Events { filters: Vec<TemplateEventFilter> },
}

/// A routine trigger with variables where values would appear. Mirrors
/// `ActionTrigger`; a cron entry's schedule and timezone are one variable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum TemplateTrigger {
    Cron {
        schedule: VariableRef,
    },
    Events {
        filters: Vec<TemplateEventFilter>,
    },
    Multiple {
        triggers: Vec<TemplateRoutineTrigger>,
    },
}

impl TemplateTrigger {
    fn schedule_refs(&self) -> Vec<&VariableRef> {
        match self {
            Self::Cron { schedule } => vec![schedule],
            Self::Events { .. } => Vec::new(),
            Self::Multiple { triggers } => triggers
                .iter()
                .filter_map(|trigger| match trigger {
                    TemplateRoutineTrigger::Cron { schedule } => Some(schedule),
                    TemplateRoutineTrigger::Events { .. } => None,
                })
                .collect(),
        }
    }

    pub fn event_filters(&self) -> Vec<&TemplateEventFilter> {
        match self {
            Self::Cron { .. } => Vec::new(),
            Self::Events { filters } => filters.iter().collect(),
            Self::Multiple { triggers } => triggers
                .iter()
                .flat_map(|trigger| match trigger {
                    TemplateRoutineTrigger::Events { filters } => filters.iter().collect(),
                    TemplateRoutineTrigger::Cron { .. } => Vec::new(),
                })
                .collect(),
        }
    }
}

/// Everything a template holds except identity and bookkeeping. This is what
/// extraction proposes, the creator edits, and activation renders.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct TemplateDraft {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub task: TemplateTask,
    pub trigger: TemplateTrigger,
    pub variables: Vec<TemplateVariable>,
}

impl TemplateDraft {
    pub fn variable(&self, key: &VariableKey) -> Option<&TemplateVariable> {
        self.variables.iter().find(|variable| &variable.key == key)
    }

    /// Keys of the variables the instructions use, in order of appearance.
    pub fn instruction_keys(&self) -> Vec<VariableKey> {
        instruction_keys(&self.task.user_prompt)
    }

    /// Check the draft is internally consistent: every reference names a
    /// declared variable of a kind that fits where it is used, every
    /// variable is used, and fixed values match their kinds.
    pub fn validate(&self) -> Result<(), TemplateError> {
        if self.name.trim().is_empty() || self.name.len() > MAX_NAME_LEN {
            return Err(TemplateError::InvalidName);
        }
        if self.description.len() > MAX_DESCRIPTION_LEN {
            return Err(TemplateError::InvalidDescription);
        }
        if self.task.user_prompt.len() > MAX_INSTRUCTIONS_LEN {
            return Err(TemplateError::InstructionsTooLong);
        }
        if self.variables.len() > MAX_VARIABLES {
            return Err(TemplateError::TooManyVariables);
        }
        let mut keys = BTreeSet::new();
        for variable in &self.variables {
            if !keys.insert(&variable.key) {
                return Err(TemplateError::DuplicateKey(variable.key.clone()));
            }
            if variable.label.trim().is_empty() || variable.label.len() > MAX_NAME_LEN {
                return Err(TemplateError::InvalidLabel(variable.key.clone()));
            }
            if variable.description.len() > MAX_DESCRIPTION_LEN {
                return Err(TemplateError::InvalidLabel(variable.key.clone()));
            }
            let is_agent = variable.kind == VariableKind::Agent;
            if is_agent != (variable.key.as_str() == AGENT_VARIABLE) {
                return Err(TemplateError::AgentVariable);
            }
            if let VariableMode::Fixed { value } = &variable.mode {
                if is_agent || !value.fits(variable.kind) {
                    return Err(TemplateError::FixedValueMismatch(variable.key.clone()));
                }
            }
        }
        if self.task.target.key.as_str() != AGENT_VARIABLE
            || self.variable(&VariableKey::agent()).is_none()
        {
            return Err(TemplateError::AgentVariable);
        }

        let mut used = BTreeSet::from([VariableKey::agent()]);
        let kind_of = |key: &VariableKey| {
            self.variable(key)
                .map(|variable| variable.kind)
                .ok_or_else(|| TemplateError::UnknownVariable(key.clone()))
        };
        for key in self.instruction_keys() {
            if !kind_of(&key)?.fits_instructions() {
                return Err(TemplateError::MisplacedVariable(key));
            }
            used.insert(key);
        }
        for schedule in self.trigger.schedule_refs() {
            if kind_of(&schedule.key)? != VariableKind::Schedule {
                return Err(TemplateError::MisplacedVariable(schedule.key.clone()));
            }
            used.insert(schedule.key.clone());
        }
        for filter in self.trigger.event_filters() {
            for id in filter.ids.iter().flatten() {
                let kind = kind_of(&id.key)?;
                if !filter
                    .events
                    .iter()
                    .any(|event| kind.fits_event_ids(event.entity_type()))
                {
                    return Err(TemplateError::MisplacedVariable(id.key.clone()));
                }
                used.insert(id.key.clone());
            }
        }
        if let Some(unused) = self
            .variables
            .iter()
            .find(|variable| !used.contains(&variable.key))
        {
            return Err(TemplateError::UnusedVariable(unused.key.clone()));
        }
        Ok(())
    }
}

/// Keys of the `<m-template-variable>` nodes in `instructions`, in order.
pub fn instruction_keys(instructions: &str) -> Vec<VariableKey> {
    raw_segments(instructions)
        .into_iter()
        .filter_map(|segment| match segment {
            RawSegment::Tag {
                tag: XmlTag::TemplateVariable(variable),
                ..
            } => VariableKey::try_from(variable.key.into_owned()).ok(),
            _ => None,
        })
        .collect()
}

/// A stored template.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct RoutineTemplate {
    #[schema(value_type = String, format = Uuid)]
    pub id: Uuid,
    #[schema(value_type = String)]
    pub owner: MacroUserIdStr<'static>,
    /// The routine it was made from. Absent once that routine is deleted.
    #[schema(value_type = Option<String>, format = Uuid)]
    pub source_action_id: Option<Uuid>,
    #[serde(flatten)]
    pub draft: TemplateDraft,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// The bindings an activation used, keyed by variable.
pub type Bindings = BTreeMap<VariableKey, BoundValue>;

/// Where an activated routine came from, stored on the routine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct TemplateProvenance {
    #[schema(value_type = String, format = Uuid)]
    pub template_id: Uuid,
    #[schema(value_type = BTreeMap<String, BoundValue>)]
    pub bindings: Bindings,
}

/// Malformed or inconsistent template content. Safe to show to the caller.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum TemplateError {
    #[error("variable keys use lowercase letters, digits and underscores: {0:?}")]
    InvalidKey(String),
    #[error("a template needs a name of at most 200 characters")]
    InvalidName,
    #[error("a template description is at most 1000 characters")]
    InvalidDescription,
    #[error("the instructions are too long")]
    InstructionsTooLong,
    #[error("a template has at most 50 variables")]
    TooManyVariables,
    #[error("variable {0} is declared twice")]
    DuplicateKey(VariableKey),
    #[error("variable {0} needs a short label and description")]
    InvalidLabel(VariableKey),
    #[error("a template has exactly one agent variable, named agent, and it is never fixed")]
    AgentVariable,
    #[error("the fixed value of {0} does not match its kind")]
    FixedValueMismatch(VariableKey),
    #[error("variable {0} is used but not declared")]
    UnknownVariable(VariableKey),
    #[error("variable {0} is used where its kind does not fit")]
    MisplacedVariable(VariableKey),
    #[error("variable {0} is declared but never used")]
    UnusedVariable(VariableKey),
}
