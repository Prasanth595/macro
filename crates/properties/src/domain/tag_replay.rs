//! Caller-scoped identities for durable tag lifecycle and dependent assignments.

use std::collections::HashMap;

use macro_user_id::user_id::MacroUserIdStr;
use models_properties::service::property_option::PropertyOption;
use uuid::Uuid;

use super::error::PropertiesErr;
use super::model::{TagScope, TagSet};
use super::service::TeamReceipt;

/// A new tag and its durable, caller-created handles.
#[derive(Debug, Clone)]
pub struct CreateTag {
    /// Personal or current-team ownership, resolved from the authenticated actor.
    pub scope: TagScope,
    /// Expected team when creation was queued; membership changes must not retarget it.
    pub team_id: Option<Uuid>,
    /// Stable handle of the tag definition, shared by this client's pending tags.
    pub client_definition_id: Uuid,
    /// Stable handle of this creation; retrying it must not create another tag.
    pub client_option_id: Uuid,
    /// User-visible label.
    pub value: String,
    /// Optional tag palette color.
    pub color: Option<String>,
}

/// Fields to change on a tag; omitted fields preserve the current value.
#[derive(Debug, Clone)]
pub struct UpdateTag {
    /// New user-visible label.
    pub value: Option<String>,
    /// New palette color.
    pub color: Option<String>,
}

/// The canonical definition and option after a replay-safe creation.
#[derive(Debug, Clone)]
pub struct CreatedTag {
    /// The containing set, read from the primary database after the write.
    pub tag_set: TagSet,
    /// The newly created or previously acknowledged option.
    pub option: PropertyOption,
}

/// Durable aliases for exactly the caller and requested handles.
#[derive(Debug, Default)]
pub struct PropertyClientBindings {
    /// Definition handles to canonical definition IDs, including deleted targets.
    pub definitions: HashMap<Uuid, Uuid>,
    /// Option handles to canonical option IDs, including deleted targets.
    pub options: HashMap<Uuid, Uuid>,
}

/// Creation outcome after serializing on the caller's stable option handle.
#[derive(Debug)]
pub enum CreateTagOptionOutcome {
    /// A persisted option and whether this transaction created it.
    Present {
        option: PropertyOption,
        created: bool,
    },
    /// This handle already committed to an option which has since been deleted.
    Deleted,
    /// The handle was previously bound under another definition.
    DefinitionConflict,
}

/// Replay-safe tag operations. All authorization remains in the domain service.
pub trait TagReplayService: Send + Sync + 'static {
    /// Provision a tag definition and bind a stable caller-local handle to it.
    fn ensure_tag_set_with_client_id(
        &self,
        user_id: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        scope: TagScope,
        team_id: Option<Uuid>,
        client_id: Uuid,
    ) -> impl Future<Output = Result<TagSet, PropertiesErr>> + Send;

    /// Create once, preserving a caller-scoped handle across retries and restarts.
    fn create_tag(
        &self,
        user_id: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        request: CreateTag,
    ) -> impl Future<Output = Result<CreatedTag, PropertiesErr>> + Send;

    /// Rename/recolor an existing tag addressed by a server ID or caller handle.
    fn update_tag(
        &self,
        user_id: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        definition_id: Uuid,
        option_id: Uuid,
        request: UpdateTag,
    ) -> impl Future<Output = Result<PropertyOption, PropertiesErr>> + Send;

    /// Delete a tag idempotently, returning its canonical identity for the cache.
    fn delete_tag(
        &self,
        user_id: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        definition_id: Uuid,
        option_id: Uuid,
    ) -> impl Future<Output = Result<Uuid, PropertiesErr>> + Send;
}
