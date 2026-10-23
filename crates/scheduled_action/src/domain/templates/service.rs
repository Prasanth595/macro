//! Sharing a routine as a template, viewing it, filling it in with AI and
//! activating it as the viewer's own routine.

use std::collections::{BTreeMap, HashSet};
use std::sync::Arc;

use anyhow::{Result, bail};
use bot_id::MACRO_NEW_BOT_ID;
use chrono::Utc;
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use models_permissions::share_permission::access_level::AccessLevel as ShareAccessLevel;
use models_permissions::share_permission::channel_share_permission::UpdateOperation;
use models_permissions::share_permission::{SharePermissionV2, UpdateSharePermissionRequestV2};
use tracing::{Instrument, Span};

use super::extract::{apply_suggestions, draft_request, extract, plain_instructions};
use super::models::{
    Bindings, BoundValue, RoutineTemplate, TaskTarget, TemplateDraft, TemplateError,
    TemplateProvenance, TemplateVariable, VariableKind, VariableMode,
};
use super::ports::{
    ActivateTemplateRequest, BindingAccess, BindingProblem, Confidence, CreateTemplateRequest,
    ExtractedTemplate, FillProposals, FillRequest, FillTemplateRequest, FillTemplateResponse,
    FillVariable, FilledVariable, ProvenanceTemplate, RebindTemplateRequest, RoutineProvenance,
    RoutineTemplateRepo, RoutineTemplateService, TemplateDrafter, TemplateGrants, AccessLevel, TemplateFiller, TemplateView,
    TemplatedRoutines,
};
use super::render::{RenderError, render};
use crate::domain::models::{ActionConfiguration, ScheduledAction};
use crate::domain::ports::ScheduledActionRepo;

#[cfg(test)]
mod test;

/// Most channel grants one sharing request may change.
const MAX_CHANNEL_GRANTS_PER_UPDATE: usize = 100;
const MAX_FILL_INSTRUCTION_LEN: usize = 1_000;
const MAX_ROUTINE_NAME_LEN: usize = 200;

/// Expected failures, mapped to status codes by the router.
#[derive(Debug, thiserror::Error)]
pub enum TemplatePolicyError {
    #[error("routine template not found")]
    NotFound,
    #[error("routine not found")]
    RoutineNotFound,
    #[error(transparent)]
    Invalid(#[from] TemplateError),
    #[error(transparent)]
    Render(#[from] RenderError),
    #[error("some variables can't be used as given")]
    InvalidBindings(Vec<BindingProblem>),
    #[error("this routine was edited after activation; its variables can no longer be changed")]
    NotRebindable,
    #[error("templates are shared with people and channels only")]
    UnsupportedSharing,
    #[error("an instruction is at most 1000 characters")]
    InstructionTooLong,
}

pub struct RoutineTemplateServiceImpl<Templates, Actions, Routines, Access, Drafter, Filler> {
    templates: Arc<Templates>,
    actions: Arc<Actions>,
    routines: Arc<Routines>,
    access: Access,
    drafter: Drafter,
    filler: Filler,
}

impl<Templates, Actions, Routines, Access, Drafter, Filler>
    RoutineTemplateServiceImpl<Templates, Actions, Routines, Access, Drafter, Filler>
where
    Templates: RoutineTemplateRepo,
    Actions: ScheduledActionRepo,
    Routines: TemplatedRoutines,
    Access: TemplateGrants + BindingAccess,
    Drafter: TemplateDrafter,
    Filler: TemplateFiller,
{
    pub fn new(
        templates: Arc<Templates>,
        actions: Arc<Actions>,
        routines: Arc<Routines>,
        access: Access,
        drafter: Drafter,
        filler: Filler,
    ) -> Self {
        Self {
            templates,
            actions,
            routines,
            access,
            drafter,
            filler,
        }
    }

    /// A routine `user` owns. Routines are owner-only, as everywhere else.
    async fn owned_action(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
    ) -> Result<ScheduledAction> {
        match self.actions.get_action(&id).await? {
            Some(action) if action.owner.is_user(user) => Ok(action),
            _ => Err(TemplatePolicyError::RoutineNotFound.into()),
        }
    }

    /// The template, when `user` holds at least `required` on it. A
    /// template they can't see is indistinguishable from a missing one.
    async fn granted(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        required: AccessLevel,
    ) -> Result<RoutineTemplate> {
        let level = self.access.access_level(user, id).await?;
        if level.is_none_or(|level| level < required) {
            return Err(TemplatePolicyError::NotFound.into());
        }
        self.templates
            .get_template(id)
            .await?
            .ok_or_else(|| TemplatePolicyError::NotFound.into())
    }

    /// `user`'s value for each variable: theirs when given, else the fixed
    /// value. Every value is checked against `user`'s own access.
    async fn checked_bindings(
        &self,
        user: &MacroUserIdStr<'static>,
        draft: &TemplateDraft,
        supplied: &Bindings,
    ) -> Result<Bindings> {
        let mut bindings = Bindings::new();
        let mut problems = Vec::new();
        for variable in &draft.variables {
            let value = supplied.get(&variable.key).or(match &variable.mode {
                VariableMode::Fixed { value } => Some(value),
                VariableMode::Variable => None,
            });
            let problem = match value {
                None => Some("Choose a value.".to_owned()),
                Some(value) => self.problem(user, variable, value).await?,
            };
            match (problem, value) {
                (None, Some(value)) => {
                    bindings.insert(variable.key.clone(), value.clone());
                }
                (problem, _) => problems.push(BindingProblem {
                    key: variable.key.clone(),
                    problem: problem.unwrap_or_default(),
                }),
            }
        }
        if !problems.is_empty() {
            return Err(TemplatePolicyError::InvalidBindings(problems).into());
        }
        Ok(bindings)
    }

    async fn problem(
        &self,
        user: &MacroUserIdStr<'static>,
        variable: &TemplateVariable,
        value: &BoundValue,
    ) -> Result<Option<String>> {
        if !value.fits(variable.kind) {
            return Ok(Some("This value doesn't fit this variable.".to_owned()));
        }
        self.access.check(user, variable.kind, value).await
    }

    fn routine_name(name: Option<String>, template: &RoutineTemplate) -> String {
        name.map(|name| name.trim().to_owned())
            .filter(|name| !name.is_empty())
            .map(|name| name.chars().take(MAX_ROUTINE_NAME_LEN).collect())
            .unwrap_or_else(|| template.draft.name.clone())
    }

    /// Whether `action` still reads exactly as `draft` rendered `bindings`.
    fn still_rendered(action: &ScheduledAction, draft: &TemplateDraft, bindings: &Bindings) -> bool {
        render(draft, action.name.clone(), bindings).is_ok_and(|rendered| {
            rendered.task == action.task && rendered.trigger == action.trigger
        })
    }

    /// When none of the activator's agents fit, Macro runs the routine.
    async fn macro_agent(
        &self,
        user: &MacroUserIdStr<'static>,
        variable: &TemplateVariable,
    ) -> Result<Option<FilledVariable>> {
        let value = BoundValue::Agent {
            target: TaskTarget::Agent {
                bot_id: MACRO_NEW_BOT_ID,
                model: None,
            },
        };
        Ok(self
            .problem(user, variable, &value)
            .await?
            .is_none()
            .then(|| FilledVariable {
                key: variable.key.clone(),
                value: Some(value),
                reason: Some("None of your agents fit this routine, so Macro runs it.".to_owned()),
                confidence: Some(Confidence::Check),
                problem: None,
            }))
    }

}

impl<Templates, Actions, Routines, Access, Drafter, Filler> RoutineTemplateService
    for RoutineTemplateServiceImpl<Templates, Actions, Routines, Access, Drafter, Filler>
where
    Templates: RoutineTemplateRepo,
    Actions: ScheduledActionRepo,
    Routines: TemplatedRoutines,
    Access: TemplateGrants + BindingAccess,
    Drafter: TemplateDrafter,
    Filler: TemplateFiller,
{
    #[tracing::instrument(
        name = "routine_template.extract",
        err,
        skip(self, user),
        fields(variable_count, model_outcome)
    )]
    async fn extract(
        &self,
        user: &MacroUserIdStr<'static>,
        source_action_id: Uuid,
    ) -> Result<ExtractedTemplate> {
        let action = self.owned_action(user, source_action_id).await?;
        let extraction = tracing::info_span!("routine_template.extract.candidates")
            .in_scope(|| extract(&action))?;
        let model_span = tracing::info_span!("routine_template.extract.model");
        let extraction = match self
            .drafter
            .suggest(user, draft_request(&extraction))
            .instrument(model_span)
            .await
        {
            Ok(suggestions) => {
                Span::current().record("model_outcome", "applied");
                apply_suggestions(extraction, suggestions)
            }
            Err(error) => {
                // The deterministic draft still shares fine.
                Span::current().record("model_outcome", "failed");
                tracing::warn!(error = ?error, "template drafting model failed");
                extraction
            }
        };
        Span::current().record("variable_count", extraction.draft.variables.len());
        let existing_template_id = self
            .templates
            .owned_template_for_action(user, source_action_id)
            .await?
            .map(|template| template.id);
        Ok(ExtractedTemplate {
            extraction,
            existing_template_id,
        })
    }

    #[tracing::instrument(
        name = "routine_template.create",
        err,
        skip(self, user, request),
        fields(source_action_id = %request.source_action_id, template_id)
    )]
    async fn create(
        &self,
        user: &MacroUserIdStr<'static>,
        request: CreateTemplateRequest,
    ) -> Result<RoutineTemplate> {
        self.owned_action(user, request.source_action_id).await?;
        request.draft.validate().map_err(TemplatePolicyError::from)?;
        let now = Utc::now();
        let template = RoutineTemplate {
            id: Uuid::now_v7(),
            owner: user.clone(),
            source_action_id: Some(request.source_action_id),
            draft: request.draft,
            created_at: now,
            updated_at: now,
        };
        Span::current().record("template_id", tracing::field::display(template.id));
        self.templates.create_template(&template).await?;
        Ok(template)
    }

    #[tracing::instrument(name = "routine_template.update", err, skip(self, user, draft))]
    async fn update(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        draft: TemplateDraft,
    ) -> Result<RoutineTemplate> {
        self.granted(user, id, AccessLevel::Owner).await?;
        draft.validate().map_err(TemplatePolicyError::from)?;
        self.templates
            .update_template(id, &draft, Utc::now())
            .await?
            .ok_or_else(|| TemplatePolicyError::NotFound.into())
    }

    #[tracing::instrument(name = "routine_template.delete", err, skip(self, user))]
    async fn delete(&self, user: &MacroUserIdStr<'static>, id: Uuid) -> Result<()> {
        self.granted(user, id, AccessLevel::Owner).await?;
        self.templates.delete_template(id).await
    }

    #[tracing::instrument(name = "routine_template.get", err, skip(self, user))]
    async fn get(&self, user: &MacroUserIdStr<'static>, id: Uuid) -> Result<TemplateView> {
        let template = self.granted(user, id, AccessLevel::View).await?;
        let your_activations = self.templates.activations_by(id, user).await?;
        let activation_count = self.templates.activation_count(id).await?;
        Ok(TemplateView {
            template,
            your_activations,
            activation_count,
        })
    }

    #[tracing::instrument(
        name = "routine_template.fill",
        err,
        skip(self, user, request),
        fields(
            template_id = %id,
            variable_count,
            filled_count,
            check_count,
            invalid_count,
            tool_call_count,
            outcome,
        )
    )]
    async fn fill(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        request: FillTemplateRequest,
    ) -> Result<FillTemplateResponse> {
        let instruction = request
            .instruction
            .map(|instruction| instruction.trim().to_owned())
            .filter(|instruction| !instruction.is_empty());
        if instruction
            .as_ref()
            .is_some_and(|instruction| instruction.chars().count() > MAX_FILL_INSTRUCTION_LEN)
        {
            return Err(TemplatePolicyError::InstructionTooLong.into());
        }
        let template = self.granted(user, id, AccessLevel::View).await?;
        let draft = &template.draft;
        Span::current().record("variable_count", draft.variables.len());

        // A usable fixed value needs no model; an unusable one is filled
        // like any other variable.
        let mut settled = BTreeMap::new();
        let mut open = Vec::new();
        for variable in &draft.variables {
            if let VariableMode::Fixed { value } = &variable.mode {
                if self.problem(user, variable, value).await?.is_none() {
                    settled.insert(
                        variable.key.clone(),
                        FilledVariable {
                            key: variable.key.clone(),
                            value: Some(value.clone()),
                            reason: Some("Set by the template.".to_owned()),
                            confidence: Some(Confidence::High),
                            problem: None,
                        },
                    );
                    continue;
                }
            }
            open.push(variable);
        }

        let proposals = if open.is_empty() {
            FillProposals::default()
        } else {
            let fill_request = FillRequest {
                template_name: draft.name.clone(),
                instructions: plain_instructions(&draft.task.user_prompt),
                variables: open
                    .iter()
                    .map(|variable| FillVariable {
                        key: variable.key.clone(),
                        kind: variable.kind,
                        label: variable.label.clone(),
                        description: variable.description.clone(),
                        current: request.current.get(&variable.key).cloned(),
                    })
                    .collect(),
                instruction,
            };
            match self.filler.fill(user, fill_request).await {
                Ok(proposals) => {
                    Span::current().record("outcome", "filled");
                    proposals
                }
                Err(error) => {
                    // The user can still pick every value by hand.
                    Span::current().record("outcome", "fill_failed");
                    tracing::warn!(error = ?error, "template fill failed");
                    FillProposals::default()
                }
            }
        };
        Span::current().record("tool_call_count", proposals.tool_calls);

        let validation = tracing::info_span!("routine_template.fill.validate");
        let filled = async {
            let mut filled = Vec::with_capacity(open.len());
            for variable in open {
                let proposal = proposals
                    .proposals
                    .iter()
                    .find(|proposal| proposal.key == variable.key);
                let mut result = match proposal {
                    None => FilledVariable {
                        key: variable.key.clone(),
                        value: None,
                        reason: None,
                        confidence: None,
                        problem: Some("Nothing in your workspace fit this.".to_owned()),
                    },
                    Some(proposal) => match self.problem(user, variable, &proposal.value).await? {
                        None => FilledVariable {
                            key: variable.key.clone(),
                            value: Some(proposal.value.clone()),
                            reason: Some(proposal.reason.clone()),
                            confidence: Some(proposal.confidence),
                            problem: None,
                        },
                        Some(problem) => FilledVariable {
                            key: variable.key.clone(),
                            value: None,
                            reason: None,
                            confidence: None,
                            problem: Some(problem),
                        },
                    },
                };
                if result.value.is_none() && variable.kind == VariableKind::Agent {
                    result = self.macro_agent(user, variable).await?.unwrap_or(result);
                }
                filled.push(result);
            }
            anyhow::Ok(filled)
        }
        .instrument(validation)
        .await?;

        let mut variables = Vec::with_capacity(draft.variables.len());
        for variable in &draft.variables {
            if let Some(result) = settled.remove(&variable.key) {
                variables.push(result);
            } else if let Some(result) = filled.iter().find(|result| result.key == variable.key) {
                variables.push(result.clone());
            }
        }
        let count = |test: fn(&FilledVariable) -> bool| variables.iter().filter(|v| test(v)).count();
        Span::current().record("filled_count", count(|v| v.value.is_some()));
        Span::current().record(
            "check_count",
            count(|v| v.confidence == Some(Confidence::Check)),
        );
        Span::current().record("invalid_count", count(|v| v.value.is_none()));
        Ok(FillTemplateResponse {
            variables,
            name: proposals
                .name
                .map(|name| name.trim().chars().take(MAX_ROUTINE_NAME_LEN).collect())
                .filter(|name: &String| !name.is_empty()),
        })
    }

    #[tracing::instrument(
        name = "routine_template.activate",
        err,
        skip(self, user, request),
        fields(template_id = %id, action_id)
    )]
    async fn activate(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        request: ActivateTemplateRequest,
    ) -> Result<ScheduledAction> {
        let template = self.granted(user, id, AccessLevel::View).await?;
        let bindings = self
            .checked_bindings(user, &template.draft, &request.bindings)
            .await?;
        let name = Self::routine_name(request.name, &template);
        let input = render(&template.draft, name, &bindings).map_err(TemplatePolicyError::from)?;
        let action = self
            .routines
            .create_templated(
                user,
                input,
                TemplateProvenance {
                    template_id: id,
                    bindings,
                },
            )
            .await?;
        if let Some(action_id) = action.id {
            Span::current().record("action_id", tracing::field::display(action_id));
        }
        Ok(action)
    }

    /// The template `action` came from, for its owner.
    #[tracing::instrument(name = "routine_template.provenance", err, skip(self, user))]
    async fn provenance(
        &self,
        user: &MacroUserIdStr<'static>,
        action_id: Uuid,
    ) -> Result<Option<RoutineProvenance>> {
        let action = self.owned_action(user, action_id).await?;
        let Some(provenance) = self.templates.provenance(action_id).await? else {
            return Ok(None);
        };
        let template = match self
            .granted(user, provenance.template_id, AccessLevel::View)
            .await
        {
            Ok(template) => Some(template),
            Err(error) if is_not_found(&error) => None,
            Err(error) => return Err(error),
        };
        let rebindable = template.as_ref().is_some_and(|template| {
            Self::still_rendered(&action, &template.draft, &provenance.bindings)
        });
        Ok(Some(RoutineProvenance {
            template_id: provenance.template_id,
            variables: template
                .as_ref()
                .map(|template| template.draft.variables.clone())
                .unwrap_or_default(),
            template: template.map(|template| ProvenanceTemplate {
                name: template.draft.name,
                owner: template.owner,
            }),
            bindings: provenance.bindings,
            rebindable,
        }))
    }

    /// Re-render `action` with new bindings, while it still reads exactly
    /// as the template produced it.
    #[tracing::instrument(name = "routine_template.rebind", err, skip(self, user, request))]
    async fn rebind(
        &self,
        user: &MacroUserIdStr<'static>,
        action_id: Uuid,
        request: RebindTemplateRequest,
    ) -> Result<ScheduledAction> {
        let action = self.owned_action(user, action_id).await?;
        let provenance = self
            .templates
            .provenance(action_id)
            .await?
            .ok_or(TemplatePolicyError::NotRebindable)?;
        let template = self
            .granted(user, provenance.template_id, AccessLevel::View)
            .await?;
        if !Self::still_rendered(&action, &template.draft, &provenance.bindings) {
            return Err(TemplatePolicyError::NotRebindable.into());
        }
        let bindings = self
            .checked_bindings(user, &template.draft, &request.bindings)
            .await?;
        let input = ActionConfiguration {
            enabled: action.enabled,
            ..render(&template.draft, action.name.clone(), &bindings)
                .map_err(TemplatePolicyError::from)?
        };
        let updated = self.routines.replace_templated(action, input).await?;
        self.templates.set_bindings(action_id, &bindings).await?;
        Ok(updated)
    }

    #[tracing::instrument(name = "routine_template.share_permissions", err, skip(self, user))]
    async fn share_permissions(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
    ) -> Result<SharePermissionV2> {
        let template = self.granted(user, id, AccessLevel::Owner).await?;
        Ok(SharePermissionV2 {
            id: id.to_string(),
            link_share: None,
            link_share_access_level: None,
            team_share_access_level: None,
            owner: template.owner.to_string(),
            channel_share_permissions: Some(self.templates.channel_grants(id).await?),
        })
    }

    /// Share with channels (a person is shared through their direct
    /// channel). Templates are only ever shared for viewing.
    #[tracing::instrument(
        name = "routine_template.update_share_permissions",
        err,
        skip(self, user, request)
    )]
    async fn update_share_permissions(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        request: UpdateSharePermissionRequestV2,
    ) -> Result<SharePermissionV2> {
        if matches!(request.link_share, Some(Some(_)))
            || matches!(request.link_share_access_level, Some(Some(_)))
            || matches!(request.team_share_access_level, Some(Some(_)))
        {
            return Err(TemplatePolicyError::UnsupportedSharing.into());
        }
        let grants = request.channel_share_permissions.unwrap_or_default();
        if grants.len() > MAX_CHANNEL_GRANTS_PER_UPDATE {
            return Err(TemplatePolicyError::UnsupportedSharing.into());
        }
        let mut channels = HashSet::new();
        for grant in &grants {
            let view_only = match grant.operation {
                UpdateOperation::Remove => true,
                _ => grant.access_level == Some(ShareAccessLevel::View),
            };
            if !channels.insert(&grant.channel_id)
                || Uuid::parse_str(&grant.channel_id).is_err()
                || !view_only
            {
                return Err(TemplatePolicyError::UnsupportedSharing.into());
            }
        }
        self.granted(user, id, AccessLevel::Owner).await?;
        if !self.templates.update_channel_grants(id, &grants).await? {
            bail!(TemplatePolicyError::NotFound);
        }
        self.share_permissions(user, id).await
    }
}

fn is_not_found(error: &anyhow::Error) -> bool {
    matches!(
        error.downcast_ref::<TemplatePolicyError>(),
        Some(TemplatePolicyError::NotFound)
    )
}
