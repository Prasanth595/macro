//! Permission-scoped live Canvas reading and AI editing.

use super::{
    permission_token::encode_permission_token,
    ports::{
        DocumentService,
        editing::{EditUsage, EditingWorkerService, EditorName},
    },
};
use ai_billing::domain::admission::AiAdmissionService;
use ai_usage::{AiFeature, UsageAmount, UsageContext, UsageRecorder};
use entity_access::domain::models::{EditAccessLevel, EntityAccessReceipt, ViewAccessLevel};
use macro_user_id::user_id::MacroUserIdStr;
use models_permissions::share_permission::access_level::AccessLevel;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Canvas workflow passed to the live editing peer.
#[derive(Debug, Serialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum CanvasRequest {
    /// Read the live scene without mutation or model usage.
    Read {
        /// Filter to known stable IDs when the overview is truncated.
        #[serde(skip_serializing_if = "Option::is_none")]
        item_ids: Option<Vec<String>>,
    },
    /// Ask the sandboxed editor to change the live scene.
    Edit {
        /// User-requested changes; bounded before admission.
        instructions: String,
        /// Display name for ephemeral AI presence; durable attribution uses the token.
        #[serde(skip_serializing_if = "Option::is_none")]
        editor_name: Option<String>,
    },
}

/// High-signal outcome shared by agent tools and caller integrations.
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CanvasResponse {
    /// Bounded scene JSON with stable item IDs, transforms, bounds and labels.
    pub canvas: Option<String>,
    /// Number of validated operations acknowledged by live storage.
    pub operations_applied: usize,
    /// Human-readable outcome; may report partial changes.
    pub summary: String,
    /// Missing information or unsupported operation, if any.
    pub clarification: Option<String>,
}

/// Internal worker result including billable per-model usage.
pub struct CanvasResult {
    /// A stopped or failed run still reports its completed provider usage.
    pub failure: Option<String>,
    /// Public operation outcome.
    pub response: CanvasResponse,
    /// Usage metered by the owning domain, including MCP invocations.
    pub usage: Vec<EditUsage>,
}

/// Metadata needed to select the Canvas workflow after access is checked.
#[cfg_attr(test, mockall::automock)]
pub trait CanvasDocumentLookup: Send + Sync + 'static {
    /// Native file type of an authorized document.
    fn file_type(
        &self,
        document_id: &str,
    ) -> impl std::future::Future<Output = anyhow::Result<Option<String>>> + Send;
}

impl<D: DocumentService> CanvasDocumentLookup for D {
    async fn file_type(&self, document_id: &str) -> anyhow::Result<Option<String>> {
        Ok(self
            .internal_get_basic_document(document_id)
            .await?
            .file_type)
    }
}

/// Composes document lookup, scoped worker execution and AI admission/metering.
pub struct CanvasService<D, W> {
    documents: Arc<D>,
    worker: Arc<W>,
    token_secret: String,
    admission: Arc<dyn AiAdmissionService>,
    recorder: Arc<dyn UsageRecorder>,
}

impl<D: CanvasDocumentLookup, W: EditingWorkerService> CanvasService<D, W> {
    /// Construct from the same dependencies used by document AI editing.
    pub fn new(
        documents: Arc<D>,
        worker: Arc<W>,
        token_secret: String,
        admission: Arc<dyn AiAdmissionService>,
        recorder: Arc<dyn UsageRecorder>,
    ) -> Self {
        Self {
            documents,
            worker,
            token_secret,
            admission,
            recorder,
        }
    }

    /// Read with a view-only capability. No model is called.
    pub async fn read(
        &self,
        receipt: EntityAccessReceipt<ViewAccessLevel>,
        user: &MacroUserIdStr<'static>,
        actor: &str,
        item_ids: Option<Vec<String>>,
    ) -> anyhow::Result<CanvasResponse> {
        anyhow::ensure!(
            item_ids
                .as_ref()
                .is_none_or(|ids| ids.len() <= 100 && ids.iter().all(|id| id.len() <= 200)),
            "Read at most 100 Canvas item IDs of at most 200 bytes each."
        );
        self.ensure_canvas(&receipt.entity().entity_id).await?;
        Ok(self
            .run(
                &receipt.entity().entity_id,
                user,
                actor,
                AccessLevel::View,
                CanvasRequest::Read { item_ids },
            )
            .await?
            .response)
    }

    /// Authorize, admit, run and meter one natural-language edit.
    #[tracing::instrument(skip_all, fields(document_id = %receipt.entity().entity_id), err)]
    pub async fn edit(
        &self,
        receipt: EntityAccessReceipt<EditAccessLevel>,
        user: &MacroUserIdStr<'static>,
        actor: &str,
        instructions: String,
        editor_name: Option<EditorName>,
    ) -> anyhow::Result<CanvasResponse> {
        anyhow::ensure!(
            !instructions.trim().is_empty() && instructions.len() <= 20000,
            "Canvas instructions must contain 1–20000 bytes."
        );
        // Type validation happens before admission and before the model can start.
        self.ensure_canvas(&receipt.entity().entity_id).await?;
        self.admission
            .admit(user, AiFeature::AiEditing)
            .await
            .map_err(|error| anyhow::anyhow!("{}: {error}", error.code()))?;
        let result = self
            .run(
                &receipt.entity().entity_id,
                user,
                actor,
                AccessLevel::Edit,
                CanvasRequest::Edit {
                    instructions,
                    editor_name: editor_name.map(|name| name.as_str().chars().take(64).collect()),
                },
            )
            .await?;
        let context = UsageContext::new(AiFeature::AiEditing, user.clone())
            .with_entity(macro_uuid::string_to_uuid(&receipt.entity().entity_id).ok());
        for usage in result.usage {
            self.recorder.record(context.clone().into_event(
                usage.model,
                UsageAmount::Tokens {
                    input: u64::from(usage.input_tokens),
                    output: u64::from(usage.output_tokens),
                    cache_read: 0,
                    cache_write: 0,
                },
            ));
        }
        if let Some(error) = result.failure {
            anyhow::bail!(
                "Canvas editing stopped after {} acknowledged operations: {error}. Further partial edits may have applied. ReadCanvas before retrying.",
                result.response.operations_applied
            );
        }
        Ok(result.response)
    }

    async fn ensure_canvas(&self, document_id: &str) -> anyhow::Result<()> {
        let file_type = self.documents.file_type(document_id).await?;
        anyhow::ensure!(
            file_type.as_deref() == Some("canvas"),
            "This tool requires a Macro canvas. Use the matching document tool for other file types."
        );
        Ok(())
    }

    async fn run(
        &self,
        document_id: &str,
        user: &MacroUserIdStr<'static>,
        actor: &str,
        access: AccessLevel,
        request: CanvasRequest,
    ) -> anyhow::Result<CanvasResult> {
        let token = encode_permission_token(
            Some(user.to_string()),
            document_id.to_owned(),
            access,
            &self.token_secret,
            Some(actor.to_owned()),
        )?;
        self.worker.canvas(document_id, &token, &request).await
    }
}

#[cfg(test)]
mod test;
