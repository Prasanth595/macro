//! A caller's access to templates and to the values they choose, through the
//! entity-access service and the same target validation a routine save uses.

use agent_session::domain::routines::RoutineSessionError;
use anyhow::Result;
use entity_access::domain::{
    models::{AccessError, EntityType, ViewAccessLevel, ViewOnly},
    ports::EntityAccessService,
};
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;

use crate::domain::event_trigger::EventEntityType;
use crate::domain::models::{AgentTask, AgentTaskAgent};
use crate::domain::ports::TaskTargetValidator;
use crate::domain::target_validation::TargetValidationError;
use crate::domain::templates::models::{BoundValue, TaskTarget, VariableKey, VariableKind};
use crate::domain::templates::ports::{AccessLevel, BindingAccess, TemplateGrants};
use crate::domain::templates::render::{parse_schedule, validate_text};

#[cfg(test)]
mod test;

pub struct TemplateBindingAccess<Access, Targets> {
    access: Access,
    targets: Targets,
}

impl<Access, Targets> TemplateBindingAccess<Access, Targets> {
    pub fn new(access: Access, targets: Targets) -> Self {
        Self { access, targets }
    }
}

impl<Access: EntityAccessService, Targets: TaskTargetValidator> TemplateBindingAccess<Access, Targets> {
    async fn agent(&self, user: &MacroUserIdStr<'static>, target: &TaskTarget) -> Result<Option<String>> {
        let (model, agent) = match target {
            TaskTarget::Model { model } => (Some(model.clone()), None),
            TaskTarget::Agent { bot_id, model } => {
                (model.clone(), Some(AgentTaskAgent { bot_id: *bot_id }))
            }
        };
        let task = serde_json::to_value(AgentTask {
            model,
            agent,
            prompt: String::new(),
            user_prompt: String::new(),
        })?;
        match self.targets.validate_task(&task, user).await {
            Ok(()) => Ok(None),
            Err(error)
                if error.downcast_ref::<TargetValidationError>().is_some()
                    || error.downcast_ref::<RoutineSessionError>().is_some_and(|error| {
                        matches!(
                            error,
                            RoutineSessionError::Forbidden
                                | RoutineSessionError::PersonaUnavailable
                                | RoutineSessionError::ModelMismatch
                                | RoutineSessionError::InvalidCommand
                        )
                    }) =>
            {
                Ok(Some("You can't run routines with this agent.".to_owned()))
            }
            Err(error) => Err(error),
        }
    }

    async fn entity(
        &self,
        user: &MacroUserIdStr<'static>,
        kind: VariableKind,
        id: Uuid,
    ) -> Result<Option<String>> {
        let id = id.to_string();
        let (result, noun) = match kind {
            VariableKind::Channel
            | VariableKind::EventEntity {
                entity_type: EventEntityType::Channel,
            } => (
                self.access
                    .generate_entity_access_receipt::<ViewOnly>(user, None, &id, EntityType::Channel)
                    .await
                    .map(drop),
                "channel",
            ),
            VariableKind::Document
            | VariableKind::EventEntity {
                entity_type: EventEntityType::Document,
            } => (self.view(user, &id, EntityType::Document).await, "document"),
            VariableKind::EventEntity {
                entity_type: EventEntityType::EmailThread,
            } => (
                self.view(user, &id, EntityType::EmailThread).await,
                "email thread",
            ),
            VariableKind::EventEntity {
                entity_type: EventEntityType::Call,
            } => (self.view(user, &id, EntityType::Call).await, "call"),
            VariableKind::Agent | VariableKind::Schedule | VariableKind::Text | VariableKind::User => {
                return Ok(Some("This value doesn't fit this variable.".to_owned()));
            }
        };
        match result {
            Ok(()) => Ok(None),
            Err(
                AccessError::Unauthorized
                | AccessError::UnauthorizedWithMessage(_)
                | AccessError::NotFound(_)
                | AccessError::BadRequest(_),
            ) => Ok(Some(format!("You don't have access to this {noun}."))),
            // Never turn infrastructure errors into denial.
            Err(error) => Err(anyhow::anyhow!("failed to check access: {error}")),
        }
    }

    async fn view(
        &self,
        user: &MacroUserIdStr<'static>,
        id: &str,
        entity_type: EntityType,
    ) -> Result<(), AccessError> {
        self.access
            .generate_entity_access_receipt::<ViewAccessLevel>(user, None, id, entity_type)
            .await
            .map(drop)
    }
}

impl<Access: EntityAccessService, Targets: TaskTargetValidator> TemplateGrants
    for TemplateBindingAccess<Access, Targets>
{
    async fn access_level(
        &self,
        user: &MacroUserIdStr<'static>,
        template_id: Uuid,
    ) -> Result<Option<AccessLevel>> {
        self.access
            .get_access_level(
                Some(user),
                &template_id.to_string(),
                EntityType::RoutineTemplate,
            )
            .await
            .map_err(|error| anyhow::anyhow!("failed to check template access: {error}"))
    }
}

impl<Access: EntityAccessService, Targets: TaskTargetValidator> BindingAccess
    for TemplateBindingAccess<Access, Targets>
{
    async fn check(
        &self,
        user: &MacroUserIdStr<'static>,
        kind: VariableKind,
        value: &BoundValue,
    ) -> Result<Option<String>> {
        // Keys only label errors here; any valid slug will do.
        let key = VariableKey::agent();
        match (kind, value) {
            (VariableKind::Agent, BoundValue::Agent { target }) => self.agent(user, target).await,
            (VariableKind::Schedule, BoundValue::Schedule { cron, timezone }) => {
                Ok(parse_schedule(&key, cron, timezone)
                    .err()
                    .map(|_| "This schedule isn't valid.".to_owned()))
            }
            (VariableKind::Text, BoundValue::Text { text }) => Ok(validate_text(&key, text)
                .err()
                .map(|_| "Use up to 500 characters, without angle brackets.".to_owned())),
            (VariableKind::User, BoundValue::User { user_id }) => {
                Ok(MacroUserIdStr::parse_from_str(user_id)
                    .err()
                    .map(|_| "This isn't a Macro user.".to_owned()))
            }
            (
                VariableKind::Channel | VariableKind::Document | VariableKind::EventEntity { .. },
                BoundValue::Entity { id, .. },
            ) => self.entity(user, kind, *id).await,
            _ => Ok(Some("This value doesn't fit this variable.".to_owned())),
        }
    }
}
