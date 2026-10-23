use utoipa::OpenApi;

#[expect(
    unused_imports,
    reason = "utoipa path macros require these generated symbols in scope"
)]
use crate::inbound::axum_router::{
    __path_create_action, __path_delete_action, __path_execute_action, __path_get_action,
    __path_health, __path_list_actions, __path_list_history, __path_set_action_enabled,
    __path_update_action, ScheduledActionResponse, SetScheduledActionEnabled,
};

#[expect(
    unused_imports,
    reason = "utoipa path macros require these generated symbols in scope"
)]
use crate::inbound::template_router::{
    __path_activate_template, __path_create_template, __path_delete_template,
    __path_extract_template, __path_fill_template, __path_get_routine_provenance,
    __path_get_template, __path_get_template_permissions, __path_rebind_routine,
    __path_update_template, __path_update_template_permissions, TemplateBindingErrors,
};

use crate::domain::event_trigger::{ActionTrigger, EventFilter, EventFilters, EventName};
use crate::domain::models::{
    ActionConfiguration, ActionConfigurationUpdate, ActionExecutionRecord, ActionKind, AgentTask,
    AgentTaskAgent, CreateScheduledAction, ExecutionResource, ExecutionResourceType,
    ExecutionResult, InProgressExecution, LegacyActionConfiguration, RoutineModelId, Schedule,
    ScheduledAction, ScheduledActionUpdate, UpdateScheduledAction,
};
use ai_billing::inbound::admission::AiAdmissionErrorBody;
use model::response::EmptyResponse;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "scheduled_action",
        description = "API for managing scheduled actions",
        terms_of_service = "https://macro.com/terms",
    ),
    paths(
        crate::inbound::axum_router::health,
        crate::inbound::axum_router::list_actions,
        crate::inbound::axum_router::get_action,
        crate::inbound::axum_router::create_action,
        crate::inbound::axum_router::update_action,
        crate::inbound::axum_router::set_action_enabled,
        crate::inbound::axum_router::delete_action,
        crate::inbound::axum_router::execute_action,
        crate::inbound::axum_router::list_history,
        crate::inbound::template_router::extract_template,
        crate::inbound::template_router::create_template,
        crate::inbound::template_router::get_template,
        crate::inbound::template_router::update_template,
        crate::inbound::template_router::delete_template,
        crate::inbound::template_router::fill_template,
        crate::inbound::template_router::activate_template,
        crate::inbound::template_router::get_template_permissions,
        crate::inbound::template_router::update_template_permissions,
        crate::inbound::template_router::get_routine_provenance,
        crate::inbound::template_router::rebind_routine,
    ),
    components(
        schemas(
            AiAdmissionErrorBody,
            ScheduledAction,
            ScheduledActionResponse,
            ActionConfiguration,
            ActionConfigurationUpdate,
            LegacyActionConfiguration,
            ActionTrigger,
            crate::domain::event_trigger::RoutineTrigger,
            crate::domain::event_trigger::RoutineTriggers,
            EventFilter,
            EventFilters,
            EventName,
            CreateScheduledAction,
            UpdateScheduledAction,
            SetScheduledActionEnabled,
            Schedule,
            ActionKind,
            AgentTask,
            AgentTaskAgent,
            RoutineModelId,
            ExecutionResource,
            ExecutionResourceType,
            ExecutionResult,
            InProgressExecution,
            ActionExecutionRecord,
            ScheduledActionUpdate,
            EmptyResponse,
            TemplateBindingErrors,
            crate::domain::templates::models::RoutineTemplate,
            crate::domain::templates::models::TemplateDraft,
            crate::domain::templates::models::TemplateTask,
            crate::domain::templates::models::TemplateTrigger,
            crate::domain::templates::models::TemplateRoutineTrigger,
            crate::domain::templates::models::TemplateEventFilter,
            crate::domain::templates::models::TemplateVariable,
            crate::domain::templates::models::VariableKind,
            crate::domain::templates::models::VariableMode,
            crate::domain::templates::models::VariableRef,
            crate::domain::templates::models::BoundValue,
            crate::domain::templates::models::TaskTarget,
            crate::domain::templates::extract::Extraction,
            crate::domain::templates::ports::ExtractedTemplate,
            crate::domain::templates::ports::ExtractTemplateRequest,
            crate::domain::templates::ports::CreateTemplateRequest,
            crate::domain::templates::ports::UpdateTemplateRequest,
            crate::domain::templates::ports::TemplateView,
            crate::domain::templates::ports::FillTemplateRequest,
            crate::domain::templates::ports::FillTemplateResponse,
            crate::domain::templates::ports::FilledVariable,
            crate::domain::templates::ports::Confidence,
            crate::domain::templates::ports::ActivateTemplateRequest,
            crate::domain::templates::ports::RebindTemplateRequest,
            crate::domain::templates::ports::RoutineProvenance,
            crate::domain::templates::ports::ProvenanceTemplate,
            crate::domain::templates::ports::BindingProblem,
            crate::domain::event_trigger::EventEntityType,
            models_permissions::share_permission::SharePermissionV2,
            models_permissions::share_permission::UpdateSharePermissionRequestV2,
        ),
    ),
    tags(
        (name = "scheduled actions", description = "Scheduled action service"),
        (name = "routine templates", description = "Shareable routine templates")
    )
)]
pub struct ApiDoc;
