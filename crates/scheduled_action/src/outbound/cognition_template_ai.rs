//! Template drafting and filling through the cognition service, which owns
//! admission, metering and the read-only workspace tools. Both calls run as
//! the requesting user.

use std::str::FromStr;

use anyhow::Result;
use bot_id::BotId;
use cognition::domain::{Cognition, GenerateObjectRequest, ModelId};
use cognition::outbound::CognitionClient;
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use rootcause::compat::anyhow1::IntoAnyhow;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::domain::models::RoutineModelId;
use crate::domain::templates::models::{BoundValue, TaskTarget, VariableKey, VariableKind};
use crate::domain::templates::ports::{
    Confidence, DraftRequest, DraftSuggestions, FillProposal, FillProposals, FillRequest,
    FillVariable, TemplateDrafter, TemplateFiller,
};

#[cfg(test)]
mod test;

/// The free chat model, so drafting and filling work on every plan.
pub const TEMPLATE_MODEL: &str = "google/gemini-3.8-flash";

const DRAFT_PROMPT: &str = include_str!("cognition_template_ai/draft_prompt.md");
const FILL_PROMPT: &str = include_str!("cognition_template_ai/fill_prompt.md");

pub struct CognitionTemplateAi {
    client: CognitionClient,
}

impl CognitionTemplateAi {
    pub fn new(client: CognitionClient) -> Self {
        Self { client }
    }
}

fn request(system: &str, prompt: &impl serde::Serialize, schema: Value) -> Result<GenerateObjectRequest> {
    Ok(GenerateObjectRequest {
        prompt: serde_json::to_string_pretty(prompt)?,
        system: Some(system.to_owned()),
        model: Some(
            ModelId::try_from(TEMPLATE_MODEL.to_owned())
                .map_err(|error| anyhow::anyhow!("{error}"))?,
        ),
        schema,
    })
}

fn draft_schema() -> Value {
    let text = json!({ "type": "string" });
    json!({
        "type": "object",
        "properties": {
            "name": text,
            "description": text,
            "variables": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "key": text, "label": text, "description": text,
                        "fixed": { "type": "boolean" }
                    },
                    "required": ["key", "label", "description", "fixed"]
                }
            },
            "text_variables": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": text, "key": text, "label": text, "description": text,
                        "fixed": { "type": "boolean" }
                    },
                    "required": ["text", "key", "label", "description", "fixed"]
                }
            }
        },
        "required": ["variables", "text_variables"]
    })
}

fn fill_schema() -> Value {
    let text = json!({ "type": "string" });
    json!({
        "type": "object",
        "properties": {
            "name": text,
            "variables": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "key": text,
                        "agent_id": text,
                        "cron": text,
                        "timezone": text,
                        "text": text,
                        "user_id": text,
                        "id": text,
                        "name": text,
                        "reason": text,
                        "confidence": { "type": "string", "enum": ["high", "check"] }
                    },
                    "required": ["key", "reason", "confidence"]
                }
            }
        },
        "required": ["variables"]
    })
}

impl TemplateDrafter for CognitionTemplateAi {
    async fn suggest(
        &self,
        user: &MacroUserIdStr<'static>,
        request_body: DraftRequest,
    ) -> Result<DraftSuggestions> {
        let response = self
            .client
            .generate_object(user, request(DRAFT_PROMPT, &request_body, draft_schema())?)
            .await
            .map_err(rootcause::Report::into_anyhow)?;
        Ok(serde_json::from_value(response.object)?)
    }
}

/// One proposal as the model returns it: flat optional fields, one set per
/// variable kind.
#[derive(Debug, Deserialize)]
struct RawProposal {
    key: String,
    agent_id: Option<String>,
    cron: Option<String>,
    timezone: Option<String>,
    text: Option<String>,
    user_id: Option<String>,
    id: Option<String>,
    name: Option<String>,
    reason: String,
    confidence: Confidence,
}

#[derive(Debug, Deserialize)]
struct RawFill {
    #[serde(default)]
    name: Option<String>,
    variables: Vec<RawProposal>,
}

impl RawProposal {
    /// The bound value this proposal makes for `kind`, if it is shaped
    /// right. Access is checked later, by the domain.
    fn value(self, kind: VariableKind) -> Option<BoundValue> {
        let nonblank = |value: Option<String>| value.filter(|value| !value.trim().is_empty());
        match kind {
            VariableKind::Agent => {
                let bot_id = BotId::from_str(nonblank(self.agent_id)?.trim()).ok()?;
                Some(BoundValue::Agent {
                    target: TaskTarget::Agent {
                        bot_id,
                        model: None::<RoutineModelId>,
                    },
                })
            }
            VariableKind::Schedule => Some(BoundValue::Schedule {
                cron: nonblank(self.cron)?,
                timezone: nonblank(self.timezone)?,
            }),
            VariableKind::Text => Some(BoundValue::Text {
                text: nonblank(self.text)?,
            }),
            VariableKind::User => {
                let user_id = nonblank(self.user_id)?;
                let user_id = if user_id.contains('|') {
                    user_id
                } else {
                    format!("macro|{user_id}")
                };
                Some(BoundValue::User { user_id })
            }
            VariableKind::Channel | VariableKind::Document | VariableKind::EventEntity { .. } => {
                Some(BoundValue::Entity {
                    id: Uuid::parse_str(nonblank(self.id)?.trim()).ok()?,
                    name: self.name.unwrap_or_default(),
                })
            }
        }
    }
}

/// Keep proposals for variables that were asked about and are shaped for
/// their kind. Everything else the model said is dropped.
fn proposals(raw: RawFill, variables: &[FillVariable], tool_calls: usize) -> FillProposals {
    let proposals = raw
        .variables
        .into_iter()
        .filter_map(|proposal| {
            let key = VariableKey::try_from(proposal.key.clone()).ok()?;
            let variable = variables.iter().find(|variable| variable.key == key)?;
            let reason = proposal.reason.chars().take(300).collect();
            let confidence = proposal.confidence;
            Some(FillProposal {
                key,
                value: proposal.value(variable.kind)?,
                reason,
                confidence,
            })
        })
        .collect();
    FillProposals {
        proposals,
        name: raw.name,
        tool_calls: u32::try_from(tool_calls).unwrap_or(u32::MAX),
    }
}

impl TemplateFiller for CognitionTemplateAi {
    async fn fill(
        &self,
        user: &MacroUserIdStr<'static>,
        request_body: FillRequest,
    ) -> Result<FillProposals> {
        let explored = self
            .client
            .explore_object(user, request(FILL_PROMPT, &request_body, fill_schema())?)
            .await
            .map_err(rootcause::Report::into_anyhow)?;
        let raw: RawFill = serde_json::from_value(explored.object)?;
        Ok(proposals(raw, &request_body.variables, explored.tool_calls))
    }
}
