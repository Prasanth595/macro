use std::collections::HashMap;
use std::sync::Mutex;

use chrono::DateTime;
use models_permissions::share_permission::channel_share_permission::{
    ChannelSharePermission, UpdateChannelSharePermission,
};
use serde_json::json;

use super::*;
use crate::domain::ports::ScheduledActionService;
use crate::domain::service::test::{self as routines, TestService};
use crate::domain::templates::ports::{
    DraftRequest, DraftSuggestions, FillProposal, UpdateTemplateRequest, VariableSuggestion,
};

const CREATOR: &str = "macro|routine-owner@macro.com";
const VIEWER: &str = "macro|viewer@macro.com";
const CHANNEL: &str = "0199f000-0000-7000-8000-000000000001";
const PRIVATE_CHANNEL: &str = "0199f000-0000-7000-8000-000000000009";
const FORBIDDEN_BOT: &str = "0199f000-0000-7000-8000-0000000000bb";

fn user(id: &str) -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from(id.to_owned()).unwrap()
}

#[derive(Default)]
struct FakeTemplates {
    templates: Mutex<HashMap<Uuid, RoutineTemplate>>,
    actions: Mutex<Option<Arc<routines::FakeRepo>>>,
    bindings: Mutex<HashMap<Uuid, Bindings>>,
}

impl RoutineTemplateRepo for FakeTemplates {
    async fn create_template(&self, template: &RoutineTemplate) -> Result<()> {
        self.templates
            .lock()
            .unwrap()
            .insert(template.id, template.clone());
        Ok(())
    }

    async fn get_template(&self, id: Uuid) -> Result<Option<RoutineTemplate>> {
        Ok(self.templates.lock().unwrap().get(&id).cloned())
    }

    async fn update_template(
        &self,
        id: Uuid,
        draft: &TemplateDraft,
        updated_at: DateTime<Utc>,
    ) -> Result<Option<RoutineTemplate>> {
        let mut templates = self.templates.lock().unwrap();
        Ok(templates.get_mut(&id).map(|template| {
            template.draft = draft.clone();
            template.updated_at = updated_at;
            template.clone()
        }))
    }

    async fn delete_template(&self, id: Uuid) -> Result<()> {
        self.templates.lock().unwrap().remove(&id);
        Ok(())
    }

    async fn owned_template_for_action(
        &self,
        owner: &MacroUserIdStr<'static>,
        action_id: Uuid,
    ) -> Result<Option<RoutineTemplate>> {
        Ok(self
            .templates
            .lock()
            .unwrap()
            .values()
            .find(|template| {
                &template.owner == owner && template.source_action_id == Some(action_id)
            })
            .cloned())
    }

    async fn activations_by(&self, _: Uuid, _: &MacroUserIdStr<'static>) -> Result<Vec<Uuid>> {
        Ok(Vec::new())
    }

    async fn activation_count(&self, _: Uuid) -> Result<u64> {
        Ok(0)
    }

    async fn provenance(&self, action_id: Uuid) -> Result<Option<TemplateProvenance>> {
        let actions = self.actions.lock().unwrap().clone().expect("wired");
        let created = actions
            .provenances
            .lock()
            .unwrap()
            .iter()
            .find(|(id, _)| *id == action_id)
            .map(|(_, provenance)| provenance.clone());
        Ok(created.map(|mut provenance| {
            if let Some(bindings) = self.bindings.lock().unwrap().get(&action_id) {
                provenance.bindings = bindings.clone();
            }
            provenance
        }))
    }

    async fn set_bindings(&self, action_id: Uuid, bindings: &Bindings) -> Result<()> {
        self.bindings
            .lock()
            .unwrap()
            .insert(action_id, bindings.clone());
        Ok(())
    }

    async fn channel_grants(&self, _: Uuid) -> Result<Vec<ChannelSharePermission>> {
        Ok(Vec::new())
    }

    async fn update_channel_grants(
        &self,
        _: Uuid,
        _: &[UpdateChannelSharePermission],
    ) -> Result<bool> {
        Ok(true)
    }
}

/// Grants by (user, template), and the values no one may use.
#[derive(Default)]
struct FakeAccess {
    grants: Mutex<HashMap<(String, Uuid), AccessLevel>>,
}

impl TemplateGrants for Arc<FakeAccess> {
    async fn access_level(
        &self,
        user: &MacroUserIdStr<'static>,
        template_id: Uuid,
    ) -> Result<Option<AccessLevel>> {
        Ok(self
            .grants
            .lock()
            .unwrap()
            .get(&(user.to_string(), template_id))
            .copied())
    }
}

impl BindingAccess for Arc<FakeAccess> {
    async fn check(
        &self,
        _: &MacroUserIdStr<'static>,
        _: VariableKind,
        value: &BoundValue,
    ) -> Result<Option<String>> {
        Ok(match value {
            BoundValue::Entity { id, .. } if id.to_string() == PRIVATE_CHANNEL => {
                Some("You don't have access to this channel.".to_owned())
            }
            BoundValue::Agent {
                target: TaskTarget::Agent { bot_id, .. },
            } if bot_id.to_string() == FORBIDDEN_BOT => {
                Some("You can't run routines with this agent.".to_owned())
            }
            _ => None,
        })
    }
}

#[derive(Default)]
struct FakeAi {
    suggestions: Mutex<Option<DraftSuggestions>>,
    proposals: Mutex<Option<Vec<FillProposal>>>,
    requests: Mutex<Vec<String>>,
}

impl TemplateDrafter for Arc<FakeAi> {
    async fn suggest(&self, _: &MacroUserIdStr<'static>, _: DraftRequest) -> Result<DraftSuggestions> {
        self.suggestions
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| anyhow::anyhow!("model unavailable"))
    }
}

impl TemplateFiller for Arc<FakeAi> {
    async fn fill(&self, _: &MacroUserIdStr<'static>, request: FillRequest) -> Result<FillProposals> {
        self.requests
            .lock()
            .unwrap()
            .push(serde_json::to_string(&request).unwrap());
        let proposals = self
            .proposals
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| anyhow::anyhow!("model unavailable"))?;
        Ok(FillProposals {
            proposals,
            name: Some("Weekly initech digest".to_owned()),
            tool_calls: 3,
        })
    }
}

type Service = RoutineTemplateServiceImpl<
    FakeTemplates,
    routines::FakeRepo,
    TestService,
    Arc<FakeAccess>,
    Arc<FakeAi>,
    Arc<FakeAi>,
>;

struct Harness {
    service: Service,
    routines: Arc<TestService>,
    actions: Arc<routines::FakeRepo>,
    templates: Arc<FakeTemplates>,
    access: Arc<FakeAccess>,
    ai: Arc<FakeAi>,
}

impl Harness {
    fn new() -> Self {
        let routines = routines::service(true);
        let actions = routines::repo(&routines);
        let templates = Arc::new(FakeTemplates::default());
        *templates.actions.lock().unwrap() = Some(Arc::clone(&actions));
        let access = Arc::new(FakeAccess::default());
        let ai = Arc::new(FakeAi::default());
        let service = RoutineTemplateServiceImpl::new(
            Arc::clone(&templates),
            Arc::clone(&actions),
            Arc::clone(&routines),
            Arc::clone(&access),
            Arc::clone(&ai),
            Arc::clone(&ai),
        );
        Self {
            service,
            routines,
            actions,
            templates,
            access,
            ai,
        }
    }
}

impl Harness {
    fn grant(&self, user: &str, template_id: Uuid, level: AccessLevel) {
        self.access
            .grants
            .lock()
            .unwrap()
            .insert((user.to_owned(), template_id), level);
    }

    /// A creator's routine that posts to a channel every Monday.
    async fn source_routine(&self) -> ScheduledAction {
        let mention = mention_utils::serialize::channel_mention(
            CHANNEL,
            "initech",
            mention_utils::serialize::ChannelMentionParams::default(),
        )
        .unwrap();
        self.routines
            .create_action(
                &model_owner::CreationPrincipal::User(user(CREATOR)),
                crate::domain::models::CreateScheduledAction::Canonical(ActionConfiguration {
                    name: "Initech digest".to_owned(),
                    trigger: serde_json::from_value(json!({
                        "type": "cron", "schedule": "0 0 9 * * Mon", "timezone": "UTC"
                    }))
                    .unwrap(),
                    kind: crate::domain::models::ActionKind::Agent,
                    task: json!({
                        "model": "anthropic/claude-sonnet-5-5",
                        "prompt": "",
                        "user_prompt": format!("Summarize Initech news into {mention}.")
                    }),
                    enabled: true,
                }),
            )
            .await
            .unwrap()
    }

    /// The creator shares their routine; the viewer may see the template.
    async fn shared_template(&self) -> RoutineTemplate {
        let action = self.source_routine().await;
        let extracted = self
            .service
            .extract(&user(CREATOR), action.id.unwrap())
            .await
            .unwrap();
        let template = self
            .service
            .create(
                &user(CREATOR),
                CreateTemplateRequest {
                    source_action_id: action.id.unwrap(),
                    draft: extracted.extraction.draft,
                },
            )
            .await
            .unwrap();
        self.grant(CREATOR, template.id, AccessLevel::Owner);
        self.grant(VIEWER, template.id, AccessLevel::View);
        template
    }
}

fn key(key: &str) -> super::super::models::VariableKey {
    super::super::models::VariableKey::try_from(key.to_owned()).unwrap()
}

fn model() -> BoundValue {
    serde_json::from_value(json!({
        "type": "agent", "target": {"kind": "model", "model": "openai/gpt-6"}
    }))
    .unwrap()
}

fn channel(id: &str) -> BoundValue {
    BoundValue::Entity {
        id: id.parse().unwrap(),
        name: "mine".to_owned(),
    }
}

fn policy(error: anyhow::Error) -> TemplatePolicyError {
    error.downcast::<TemplatePolicyError>().unwrap()
}

#[tokio::test]
async fn sharing_drafts_from_the_creators_routine_even_when_the_model_fails() {
    let harness = Harness::new();
    let action = harness.source_routine().await;

    let extracted = harness
        .service
        .extract(&user(CREATOR), action.id.unwrap())
        .await
        .unwrap();
    assert_eq!(extracted.existing_template_id, None);
    let keys: Vec<_> = extracted
        .extraction
        .draft
        .variables
        .iter()
        .map(|variable| variable.key.to_string())
        .collect();
    assert_eq!(keys, ["agent", "channel", "schedule"]);

    // Someone else's routine is not theirs to share.
    let error = harness
        .service
        .extract(&user(VIEWER), action.id.unwrap())
        .await
        .unwrap_err();
    assert!(matches!(policy(error), TemplatePolicyError::RoutineNotFound));
}

#[tokio::test]
async fn sharing_applies_model_suggestions_and_offers_the_existing_template() {
    let harness = Harness::new();
    *harness.ai.suggestions.lock().unwrap() = Some(DraftSuggestions {
        name: Some("Customer digest".to_owned()),
        variables: vec![VariableSuggestion {
            key: "channel".to_owned(),
            label: "Digest channel".to_owned(),
            description: "Where the digest is posted.".to_owned(),
            fixed: false,
        }],
        ..DraftSuggestions::default()
    });
    let template = harness.shared_template().await;
    assert_eq!(template.draft.name, "Customer digest");

    let again = harness
        .service
        .extract(&user(CREATOR), template.source_action_id.unwrap())
        .await
        .unwrap();
    assert_eq!(again.existing_template_id, Some(template.id));
}

#[tokio::test]
async fn templates_are_invisible_without_a_grant_and_editable_only_by_their_owner() {
    let harness = Harness::new();
    let template = harness.shared_template().await;
    let stranger = user("macro|stranger@macro.com");

    let error = harness.service.get(&stranger, template.id).await.unwrap_err();
    assert!(matches!(policy(error), TemplatePolicyError::NotFound));
    harness.service.get(&user(VIEWER), template.id).await.unwrap();

    let update = UpdateTemplateRequest {
        draft: template.draft.clone(),
    };
    let error = harness
        .service
        .update(&user(VIEWER), template.id, update.draft.clone())
        .await
        .unwrap_err();
    assert!(matches!(policy(error), TemplatePolicyError::NotFound));
    let error = harness
        .service
        .delete(&user(VIEWER), template.id)
        .await
        .unwrap_err();
    assert!(matches!(policy(error), TemplatePolicyError::NotFound));
    harness
        .service
        .update(&user(CREATOR), template.id, update.draft)
        .await
        .unwrap();
}

#[tokio::test]
async fn activation_creates_the_viewers_own_routine_with_provenance() {
    let harness = Harness::new();
    let template = harness.shared_template().await;
    let bindings = Bindings::from([
        (key("agent"), model()),
        (key("channel"), channel("0199f000-0000-7000-8000-000000000005")),
    ]);

    let action = harness
        .service
        .activate(
            &user(VIEWER),
            template.id,
            ActivateTemplateRequest {
                bindings: bindings.clone(),
                name: Some("My digest".to_owned()),
            },
        )
        .await
        .unwrap();

    assert!(action.owner.is_user(&user(VIEWER)));
    assert_eq!(action.name, "My digest");
    assert!(action.enabled);
    assert_eq!(action.task["model"], "openai/gpt-6");
    let instructions = action.task["user_prompt"].as_str().unwrap();
    assert!(instructions.contains("0199f000-0000-7000-8000-000000000005"));
    assert!(!instructions.contains(CHANNEL));
    // The fixed schedule came from the template.
    assert_eq!(
        action.trigger,
        serde_json::from_value(json!({
            "type": "cron", "schedule": "0 0 9 * * Mon", "timezone": "UTC"
        }))
        .unwrap()
    );
    let provenance = harness
        .templates
        .provenance(action.id.unwrap())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(provenance.template_id, template.id);
    assert_eq!(provenance.bindings.len(), 3);
}

#[tokio::test]
async fn activation_refuses_values_the_activator_cannot_use_and_creates_nothing() {
    let harness = Harness::new();
    let template = harness.shared_template().await;
    let before = harness.actions.provenances.lock().unwrap().len();

    let error = harness
        .service
        .activate(
            &user(VIEWER),
            template.id,
            ActivateTemplateRequest {
                bindings: Bindings::from([(key("channel"), channel(PRIVATE_CHANNEL))]),
                name: None,
            },
        )
        .await
        .unwrap_err();

    let TemplatePolicyError::InvalidBindings(problems) = policy(error) else {
        panic!("expected binding problems");
    };
    let keys: Vec<_> = problems.iter().map(|problem| problem.key.to_string()).collect();
    assert_eq!(keys, ["agent", "channel"]);
    assert_eq!(harness.actions.provenances.lock().unwrap().len(), before);
}

#[tokio::test]
async fn fill_validates_every_proposal_and_never_sends_the_creators_values() {
    let harness = Harness::new();
    let template = harness.shared_template().await;
    *harness.ai.proposals.lock().unwrap() = Some(vec![
        FillProposal {
            key: key("agent"),
            value: BoundValue::Agent {
                target: TaskTarget::Agent {
                    bot_id: FORBIDDEN_BOT.parse().unwrap(),
                    model: None,
                },
            },
            reason: "Your research agent".to_owned(),
            confidence: Confidence::High,
        },
        FillProposal {
            key: key("channel"),
            value: channel(PRIVATE_CHANNEL),
            reason: "Your busiest channel".to_owned(),
            confidence: Confidence::Check,
        },
    ]);

    let filled = harness
        .service
        .fill(&user(VIEWER), template.id, FillTemplateRequest::default())
        .await
        .unwrap();

    let by_key: HashMap<_, _> = filled
        .variables
        .iter()
        .map(|variable| (variable.key.to_string(), variable))
        .collect();
    // The forbidden agent is replaced by Macro, flagged for checking.
    assert_eq!(
        by_key["agent"].value,
        Some(BoundValue::Agent {
            target: TaskTarget::Agent {
                bot_id: MACRO_NEW_BOT_ID,
                model: None
            }
        })
    );
    assert_eq!(by_key["agent"].confidence, Some(Confidence::Check));
    // The inaccessible channel is left for the user, with why.
    assert_eq!(by_key["channel"].value, None);
    assert!(by_key["channel"].problem.is_some());
    // The fixed schedule needed no model.
    assert!(by_key["schedule"].value.is_some());
    assert_eq!(filled.name.as_deref(), Some("Weekly initech digest"));

    let requests = harness.ai.requests.lock().unwrap();
    assert_eq!(requests.len(), 1);
    assert!(!requests[0].contains(CHANNEL));
    assert!(!requests[0].contains("initech"));
    assert!(!requests[0].contains("schedule"));
}

#[tokio::test]
async fn fill_still_answers_when_the_model_fails() {
    let harness = Harness::new();
    let template = harness.shared_template().await;

    let filled = harness
        .service
        .fill(&user(VIEWER), template.id, FillTemplateRequest::default())
        .await
        .unwrap();

    let channel = filled
        .variables
        .iter()
        .find(|variable| variable.key.as_str() == "channel")
        .unwrap();
    assert_eq!(channel.value, None);
    assert!(channel.problem.is_some());
}

#[tokio::test]
async fn bindings_change_only_while_the_routine_reads_as_rendered() {
    let harness = Harness::new();
    let template = harness.shared_template().await;
    let viewer = user(VIEWER);
    let action = harness
        .service
        .activate(
            &viewer,
            template.id,
            ActivateTemplateRequest {
                bindings: Bindings::from([
                    (key("agent"), model()),
                    (key("channel"), channel("0199f000-0000-7000-8000-000000000005")),
                ]),
                name: None,
            },
        )
        .await
        .unwrap();
    let id = action.id.unwrap();

    let provenance = harness.service.provenance(&viewer, id).await.unwrap().unwrap();
    assert!(provenance.rebindable);
    assert_eq!(provenance.template.unwrap().name, template.draft.name);

    let rebound = harness
        .service
        .rebind(
            &viewer,
            id,
            RebindTemplateRequest {
                bindings: Bindings::from([
                    (key("agent"), model()),
                    (key("channel"), channel("0199f000-0000-7000-8000-000000000006")),
                ]),
            },
        )
        .await
        .unwrap();
    assert!(
        rebound.task["user_prompt"]
            .as_str()
            .unwrap()
            .contains("0199f000-0000-7000-8000-000000000006")
    );
    assert!(harness.service.provenance(&viewer, id).await.unwrap().unwrap().rebindable);

    // Hand-edit the instructions: the variables can no longer be changed.
    let receipt = entity_access::domain::models::EntityAccessReceipt::dangerously_assert_authenticated_user(
        viewer.clone(),
        &id.to_string(),
        entity_access::domain::models::EntityType::ScheduledAction,
    );
    let mut task = rebound.task.clone();
    task["user_prompt"] = json!("Something else entirely.");
    crate::domain::ports::ScheduledActionService::update_action(
        harness.routines.as_ref(),
        receipt,
        crate::domain::models::UpdateScheduledAction::Canonical(
            crate::domain::models::ActionConfigurationUpdate {
                name: rebound.name.clone(),
                trigger: rebound.trigger.clone(),
                kind: rebound.kind.clone(),
                task,
                enabled: None,
            },
        ),
    )
    .await
    .unwrap();
    assert!(!harness.service.provenance(&viewer, id).await.unwrap().unwrap().rebindable);
    let error = harness
        .service
        .rebind(
            &viewer,
            id,
            RebindTemplateRequest {
                bindings: Bindings::new(),
            },
        )
        .await
        .unwrap_err();
    assert!(matches!(policy(error), TemplatePolicyError::NotRebindable));
}

#[tokio::test]
async fn templates_are_shared_for_viewing_only() {
    let harness = Harness::new();
    let template = harness.shared_template().await;
    let grant = |level: &str| UpdateSharePermissionRequestV2 {
        channel_share_permissions: Some(vec![
            serde_json::from_value(json!({
                "channelId": CHANNEL, "operation": "replace", "accessLevel": level
            }))
            .unwrap(),
        ]),
        ..serde_json::from_value(json!({})).unwrap()
    };

    let error = harness
        .service
        .update_share_permissions(&user(CREATOR), template.id, grant("edit"))
        .await
        .unwrap_err();
    assert!(matches!(policy(error), TemplatePolicyError::UnsupportedSharing));
    let error = harness
        .service
        .update_share_permissions(&user(VIEWER), template.id, grant("view"))
        .await
        .unwrap_err();
    assert!(matches!(policy(error), TemplatePolicyError::NotFound));
    harness
        .service
        .update_share_permissions(&user(CREATOR), template.id, grant("view"))
        .await
        .unwrap();
}
