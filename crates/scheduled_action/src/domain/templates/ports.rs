use anyhow::Result;
use chrono::{DateTime, Utc};
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use models_permissions::share_permission::channel_share_permission::{
    ChannelSharePermission, UpdateChannelSharePermission,
};
use models_permissions::share_permission::{SharePermissionV2, UpdateSharePermissionRequestV2};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub use models_permissions::share_permission::access_level::AccessLevel;

use super::models::{
    BoundValue, Bindings, RoutineTemplate, TemplateDraft, TemplateProvenance, VariableKey,
    VariableKind,
};
use crate::domain::models::{ActionConfiguration, ScheduledAction};

/// Template storage. Lookups address a row by id; callers authorize.
pub trait RoutineTemplateRepo: Send + Sync + 'static {
    /// Insert the template and its owner's grant in one transaction.
    fn create_template(
        &self,
        template: &RoutineTemplate,
    ) -> impl Future<Output = Result<()>> + Send;

    fn get_template(&self, id: Uuid) -> impl Future<Output = Result<Option<RoutineTemplate>>> + Send;

    /// Overwrite the snapshot. `None` when the template is gone.
    fn update_template(
        &self,
        id: Uuid,
        draft: &TemplateDraft,
        updated_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<Option<RoutineTemplate>>> + Send;

    /// Delete the template; its grants go with it. Activated routines stay.
    fn delete_template(&self, id: Uuid) -> impl Future<Output = Result<()>> + Send;

    /// The newest template `owner` made from `action_id`, if any.
    fn owned_template_for_action(
        &self,
        owner: &MacroUserIdStr<'static>,
        action_id: Uuid,
    ) -> impl Future<Output = Result<Option<RoutineTemplate>>> + Send;

    /// Routines `owner` activated from the template, oldest first.
    fn activations_by(
        &self,
        template_id: Uuid,
        owner: &MacroUserIdStr<'static>,
    ) -> impl Future<Output = Result<Vec<Uuid>>> + Send;

    /// How many routines were activated from the template, by anyone.
    fn activation_count(&self, template_id: Uuid) -> impl Future<Output = Result<u64>> + Send;

    /// The template an activated routine came from and its bindings.
    fn provenance(
        &self,
        action_id: Uuid,
    ) -> impl Future<Output = Result<Option<TemplateProvenance>>> + Send;

    fn set_bindings(
        &self,
        action_id: Uuid,
        bindings: &Bindings,
    ) -> impl Future<Output = Result<()>> + Send;

    fn channel_grants(
        &self,
        template_id: Uuid,
    ) -> impl Future<Output = Result<Vec<ChannelSharePermission>>> + Send;

    /// `false` when the template is gone.
    fn update_channel_grants(
        &self,
        template_id: Uuid,
        grants: &[UpdateChannelSharePermission],
    ) -> impl Future<Output = Result<bool>> + Send;
}

/// Creates and rebinds routines that came from a template, through the same
/// validation and dispatch as every other routine write.
pub trait TemplatedRoutines: Send + Sync + 'static {
    fn create_templated(
        &self,
        owner: &MacroUserIdStr<'static>,
        input: ActionConfiguration,
        provenance: TemplateProvenance,
    ) -> impl Future<Output = Result<ScheduledAction>> + Send;

    /// Replace `action`'s configuration with `input` through the normal
    /// update path.
    fn replace_templated(
        &self,
        action: ScheduledAction,
        input: ActionConfiguration,
    ) -> impl Future<Output = Result<ScheduledAction>> + Send;
}

/// Checks a value an activator chose against their own access. `Ok(Some)`
/// carries why the value can't be used; `Err` is an infrastructure failure.
pub trait BindingAccess: Send + Sync + 'static {
    fn check(
        &self,
        user: &MacroUserIdStr<'static>,
        kind: VariableKind,
        value: &BoundValue,
    ) -> impl Future<Output = Result<Option<String>>> + Send;
}

/// One candidate as the drafting model sees it.
#[derive(Debug, Clone, Serialize)]
pub struct DraftCandidate {
    pub key: VariableKey,
    pub kind: VariableKind,
    /// The creator's value, as a name. Sent only on the creator's own call.
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DraftRequest {
    pub name: String,
    /// Plain-text instructions with `{key}` where variables are.
    pub instructions: String,
    pub candidates: Vec<DraftCandidate>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct VariableSuggestion {
    pub key: String,
    pub label: String,
    pub description: String,
    pub fixed: bool,
}

/// Person-specific plain text the model found, to become a text variable.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct TextSuggestion {
    pub text: String,
    pub key: String,
    pub label: String,
    pub description: String,
    pub fixed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Deserialize)]
pub struct DraftSuggestions {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub variables: Vec<VariableSuggestion>,
    #[serde(default)]
    pub text_variables: Vec<TextSuggestion>,
}

/// The structured-completion pass over a template being shared. Runs as the
/// creator.
pub trait TemplateDrafter: Send + Sync + 'static {
    fn suggest(
        &self,
        user: &MacroUserIdStr<'static>,
        request: DraftRequest,
    ) -> impl Future<Output = Result<DraftSuggestions>> + Send;
}

/// One variable as the fill agent sees it.
#[derive(Debug, Clone, Serialize)]
pub struct FillVariable {
    pub key: VariableKey,
    pub kind: VariableKind,
    pub label: String,
    pub description: String,
    /// The activator's current choice, when re-filling with an instruction.
    pub current: Option<BoundValue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FillRequest {
    pub template_name: String,
    /// Plain-text instructions with `{key}` where variables are. Never
    /// includes the creator's values for variable slots.
    pub instructions: String,
    pub variables: Vec<FillVariable>,
    pub instruction: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    High,
    /// The user should check this value.
    Check,
}

/// The fill agent's untrusted proposal for one variable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FillProposal {
    pub key: VariableKey,
    pub value: BoundValue,
    pub reason: String,
    pub confidence: Confidence,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct FillProposals {
    pub proposals: Vec<FillProposal>,
    pub name: Option<String>,
    pub tool_calls: u32,
}

/// A bounded, read-only agent run as the activator, distilled to proposals.
pub trait TemplateFiller: Send + Sync + 'static {
    fn fill(
        &self,
        user: &MacroUserIdStr<'static>,
        request: FillRequest,
    ) -> impl Future<Output = Result<FillProposals>> + Send;
}

/// A routine's draft template for its owner, plus the template they
/// already made from it so the dialog can offer to update or reuse it.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExtractedTemplate {
    #[serde(flatten)]
    pub extraction: super::extract::Extraction,
    #[schema(value_type = Option<String>, format = Uuid)]
    pub existing_template_id: Option<Uuid>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ExtractTemplateRequest {
    #[schema(value_type = String, format = Uuid)]
    pub source_action_id: Uuid,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateTemplateRequest {
    #[schema(value_type = String, format = Uuid)]
    pub source_action_id: Uuid,
    pub draft: TemplateDraft,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateTemplateRequest {
    pub draft: TemplateDraft,
}

/// A template as a viewer sees it. Never holds the creator's values for
/// variable slots, because the template never stores them.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TemplateView {
    #[serde(flatten)]
    pub template: RoutineTemplate,
    /// Routines the viewer activated from this template.
    #[schema(value_type = Vec<String>)]
    pub your_activations: Vec<Uuid>,
    pub activation_count: u64,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct FillTemplateRequest {
    /// "Do this for Initech instead": re-fill with this instruction.
    #[serde(default)]
    pub instruction: Option<String>,
    /// The viewer's current choices, so related variables change together.
    #[serde(default)]
    #[schema(value_type = BTreeMap<String, BoundValue>)]
    pub current: Bindings,
}

/// One variable after fill and validation. `value` is absent when nothing
/// usable was found; `problem` then says why.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct FilledVariable {
    pub key: VariableKey,
    pub value: Option<BoundValue>,
    pub reason: Option<String>,
    pub confidence: Option<Confidence>,
    pub problem: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct FillTemplateResponse {
    pub variables: Vec<FilledVariable>,
    /// A routine name using the filled values, e.g. "Weekly Globex digest".
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ActivateTemplateRequest {
    #[schema(value_type = BTreeMap<String, BoundValue>)]
    pub bindings: Bindings,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct RebindTemplateRequest {
    #[schema(value_type = BTreeMap<String, BoundValue>)]
    pub bindings: Bindings,
}

/// The template a routine was activated from, for the routine's owner.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RoutineProvenance {
    #[schema(value_type = String, format = Uuid)]
    pub template_id: Uuid,
    /// Absent when the template is gone or no longer shared with the owner.
    pub template: Option<ProvenanceTemplate>,
    #[schema(value_type = BTreeMap<String, BoundValue>)]
    pub bindings: Bindings,
    /// The template's variables, for labelling the bindings.
    pub variables: Vec<super::models::TemplateVariable>,
    /// Whether the routine still reads exactly as the template rendered it,
    /// so a single binding can be changed.
    pub rebindable: bool,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ProvenanceTemplate {
    pub name: String,
    #[schema(value_type = String)]
    pub owner: MacroUserIdStr<'static>,
}

/// One variable that can't be used as given.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct BindingProblem {
    pub key: VariableKey,
    pub problem: String,
}

/// Routine templates for one caller. Every method authorizes the caller.
pub trait RoutineTemplateService: Send + Sync + 'static {
    /// Draft a template from a routine the caller owns. Nothing is saved.
    fn extract(
        &self,
        user: &MacroUserIdStr<'static>,
        source_action_id: Uuid,
    ) -> impl Future<Output = Result<ExtractedTemplate>> + Send;

    fn create(
        &self,
        user: &MacroUserIdStr<'static>,
        request: CreateTemplateRequest,
    ) -> impl Future<Output = Result<RoutineTemplate>> + Send;

    /// Overwrite the snapshot; the template's owner only.
    fn update(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        draft: TemplateDraft,
    ) -> impl Future<Output = Result<RoutineTemplate>> + Send;

    fn delete(&self, user: &MacroUserIdStr<'static>, id: Uuid) -> impl Future<Output = Result<()>> + Send;

    fn get(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
    ) -> impl Future<Output = Result<TemplateView>> + Send;

    /// Propose values from the caller's own workspace. Nothing is saved.
    fn fill(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        request: FillTemplateRequest,
    ) -> impl Future<Output = Result<FillTemplateResponse>> + Send;

    /// Create the caller's own routine from the template.
    fn activate(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        request: ActivateTemplateRequest,
    ) -> impl Future<Output = Result<ScheduledAction>> + Send;

    fn provenance(
        &self,
        user: &MacroUserIdStr<'static>,
        action_id: Uuid,
    ) -> impl Future<Output = Result<Option<RoutineProvenance>>> + Send;

    fn rebind(
        &self,
        user: &MacroUserIdStr<'static>,
        action_id: Uuid,
        request: RebindTemplateRequest,
    ) -> impl Future<Output = Result<ScheduledAction>> + Send;

    fn share_permissions(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
    ) -> impl Future<Output = Result<SharePermissionV2>> + Send;

    fn update_share_permissions(
        &self,
        user: &MacroUserIdStr<'static>,
        id: Uuid,
        request: UpdateSharePermissionRequestV2,
    ) -> impl Future<Output = Result<SharePermissionV2>> + Send;
}

/// The caller's grant on a template, from the entity-access service.
pub trait TemplateGrants: Send + Sync + 'static {
    fn access_level(
        &self,
        user: &MacroUserIdStr<'static>,
        template_id: Uuid,
    ) -> impl Future<Output = Result<Option<AccessLevel>>> + Send;
}
