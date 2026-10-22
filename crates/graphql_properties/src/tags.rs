//! Tag catalog and lifecycle adapters for durable normalized-cache mutations.
use crate::{GraphqlPropertyDefinition, GraphqlPropertyOption};
use async_graphql::{Context, Enum, ErrorExtensions, ID, InputObject, Object, SimpleObject};
use entity_access::domain::{
    models::{AccessError, Entity, EntityAccessReceipt, EntityPermission},
    ports::EntityAccessService,
};
use graphql_common::{GraphqlCacheDeletion, parse_id};
use macro_user_id::user_id::MacroUserIdStr;
use properties::{
    PropertiesService,
    domain::{
        error::PropertiesErr,
        model::{TagScope, TagSet},
        service::TeamReceipt,
        tag_replay::{CreateTag, CreatedTag, TagReplayService, UpdateTag},
    },
};
use std::{future::Future, pin::Pin, sync::Arc};
use uuid::Uuid;

/// A boxed request-local operation, preserving the domain's typed errors.
type TagFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, TagAdapterError>> + Send + 'a>>;

/// Keep both domain and access-service causes intact until the GraphQL boundary.
enum TagAdapterError {
    /// A typed properties-domain failure.
    Domain(PropertiesErr),
    /// An access failure, including its rootcause report when unavailable.
    Access(AccessError),
}

impl From<PropertiesErr> for TagAdapterError {
    fn from(error: PropertiesErr) -> Self {
        Self::Domain(error)
    }
}

/// Object-safe access to the caller's domain operations.
trait TagOperations: Send + Sync {
    /// List the caller's tag sets.
    fn catalog(&self) -> TagFuture<'_, (Vec<TagSet>, Option<Uuid>)>;
    /// Provision a caller-scoped definition handle.
    fn ensure(&self, scope: TagScope, team_id: Option<Uuid>, client: Uuid)
    -> TagFuture<'_, TagSet>;
    /// Replay a tag creation.
    fn create(&self, request: CreateTag) -> TagFuture<'_, CreatedTag>;
    /// Change a label without changing its identity.
    fn update(
        &self,
        definition: Uuid,
        option: Uuid,
        patch: UpdateTag,
    ) -> TagFuture<'_, models_properties::service::property_option::PropertyOption>;
    /// Delete a label, retaining its replay binding.
    fn delete(&self, definition: Uuid, option: Uuid) -> TagFuture<'_, Uuid>;
}

/// Authenticated tag context, shared by HTTP and WebSocket requests.
#[derive(Clone)]
pub struct TagGraphqlContext(
    /// Services bound to the authenticated caller.
    Arc<dyn TagOperations>,
);

impl TagGraphqlContext {
    /// Use the primary properties service for both writes and committed responses.
    pub fn new<P, A>(properties: Arc<P>, access: Arc<A>, user: MacroUserIdStr<'static>) -> Self
    where
        P: PropertiesService + TagReplayService,
        A: EntityAccessService,
    {
        Self(Arc::new(ServiceTags {
            properties,
            access,
            user,
        }))
    }
}

/// Per-request services and authenticated actor.
struct ServiceTags<P, A> {
    /// Owning domain service over the primary database.
    properties: Arc<P>,
    /// Membership receipt issuer.
    access: Arc<A>,
    /// Authenticated caller.
    user: MacroUserIdStr<'static>,
}

impl<P, A: EntityAccessService> ServiceTags<P, A> {
    /// Mint the caller's current membership capability at the access boundary.
    async fn team(&self) -> Result<Option<TeamReceipt>, TagAdapterError> {
        let Some(team) = self
            .access
            .get_user_team(&self.user)
            .await
            .map_err(TagAdapterError::Access)?
        else {
            return Ok(None);
        };
        EntityAccessReceipt::try_new_authenticated_user(
            self.user.clone(),
            Entity {
                entity_id: team.team_id.to_string(),
                entity_type: model_entity::EntityType::Team,
            },
            EntityPermission::TeamRole { role: team.role },
        )
        .map(Some)
        .map_err(|_| PropertiesErr::PermissionDenied.into())
    }
}

impl<P, A> TagOperations for ServiceTags<P, A>
where
    P: PropertiesService + TagReplayService,
    A: EntityAccessService,
{
    fn catalog(&self) -> TagFuture<'_, (Vec<TagSet>, Option<Uuid>)> {
        Box::pin(async move {
            let team = self.team().await?;
            let sets = self
                .properties
                .list_tag_sets(&self.user, team.as_ref())
                .await?;
            Ok((
                sets,
                properties::domain::service::team_id_from_receipt(team.as_ref()),
            ))
        })
    }
    fn ensure(
        &self,
        scope: TagScope,
        team_id: Option<Uuid>,
        client: Uuid,
    ) -> TagFuture<'_, TagSet> {
        Box::pin(async move {
            self.properties
                .ensure_tag_set_with_client_id(
                    &self.user,
                    self.team().await?.as_ref(),
                    scope,
                    team_id,
                    client,
                )
                .await
                .map_err(Into::into)
        })
    }
    fn create(&self, request: CreateTag) -> TagFuture<'_, CreatedTag> {
        Box::pin(async move {
            self.properties
                .create_tag(&self.user, self.team().await?.as_ref(), request)
                .await
                .map_err(Into::into)
        })
    }
    fn update(
        &self,
        definition: Uuid,
        option: Uuid,
        patch: UpdateTag,
    ) -> TagFuture<'_, models_properties::service::property_option::PropertyOption> {
        Box::pin(async move {
            self.properties
                .update_tag(
                    &self.user,
                    self.team().await?.as_ref(),
                    definition,
                    option,
                    patch,
                )
                .await
                .map_err(Into::into)
        })
    }
    fn delete(&self, definition: Uuid, option: Uuid) -> TagFuture<'_, Uuid> {
        Box::pin(async move {
            self.properties
                .delete_tag(&self.user, self.team().await?.as_ref(), definition, option)
                .await
                .map_err(Into::into)
        })
    }
}

/// Personal or current-team tag ownership.
#[derive(Enum, Copy, Clone, PartialEq, Eq)]
pub enum GraphqlTagScope {
    /// The authenticated caller's labels.
    User,
    /// Labels shared with the caller's current team.
    Team,
}
impl From<GraphqlTagScope> for TagScope {
    fn from(scope: GraphqlTagScope) -> Self {
        match scope {
            GraphqlTagScope::User => Self::User,
            GraphqlTagScope::Team => Self::Team,
        }
    }
}

/// Ownership metadata for a tag set, including an unprovisioned set.
#[derive(SimpleObject)]
pub struct GraphqlTagOwner {
    /// Personal or current-team ownership.
    scope: GraphqlTagScope,
    /// Caller or team identity, used while the definition is pending locally.
    principal_id: ID,
}

/// Account-scoped catalog; definitions and options carry the global identities.
#[derive(SimpleObject)]
pub struct GraphqlTagCatalog {
    /// Available ownership scopes, including sets not provisioned yet.
    scopes: Vec<GraphqlTagOwner>,
    /// Provisioned definitions and their current options.
    definitions: Vec<GraphqlPropertyDefinition>,
}

/// Read the authenticated caller's catalog through the owning domain.
pub async fn load_tag_catalog(ctx: &Context<'_>) -> async_graphql::Result<GraphqlTagCatalog> {
    let (sets, team_id) = ctx
        .data::<TagGraphqlContext>()?
        .0
        .catalog()
        .await
        .map_err(tag_error)?;
    let user = ctx.data::<MacroUserIdStr<'static>>()?;
    let mut scopes = vec![GraphqlTagOwner {
        scope: GraphqlTagScope::User,
        principal_id: ID(user.to_string()),
    }];
    if let Some(team) = team_id {
        scopes.push(GraphqlTagOwner {
            scope: GraphqlTagScope::Team,
            principal_id: ID(team.to_string()),
        });
    }
    let definitions = sets
        .into_iter()
        .filter_map(|set| {
            set.definition
                .map(|definition| GraphqlPropertyDefinition::with_options(definition, set.options))
        })
        .collect();
    Ok(GraphqlTagCatalog {
        scopes,
        definitions,
    })
}

/// Stable handles and content for a new tag.
#[derive(InputObject)]
pub struct GraphqlCreateTagInput {
    /// Ownership scope, authorized against current membership.
    scope: GraphqlTagScope,
    /// Team owning the queued creation; required for team scope.
    team_id: Option<ID>,
    /// Stable caller-local definition handle reused by dependent writes.
    client_definition_id: ID,
    /// Stable caller-local creation handle, reused on every replay.
    client_option_id: ID,
    /// User-visible label.
    value: String,
    /// Required palette color.
    color: String,
}

/// Changed fields of an existing label.
#[derive(InputObject)]
pub struct GraphqlUpdateTagInput {
    /// New label; omission preserves the label.
    value: Option<String>,
    /// New palette color; omission preserves the color.
    color: Option<String>,
}

/// Canonical identities acknowledged by a creation.
#[derive(SimpleObject)]
pub struct GraphqlCreatedTag {
    /// Containing definition, with committed options.
    definition: GraphqlPropertyDefinition,
    /// Created or previously acknowledged option.
    option: GraphqlPropertyOption,
}

/// Tag lifecycle mutations use the existing durable GraphQL mutation transport.
#[derive(Default)]
pub struct TagsMutationRoot;

#[Object]
impl TagsMutationRoot {
    /// Provision a tag definition once for a caller-local handle.
    async fn ensure_tag_set(
        &self,
        ctx: &Context<'_>,
        scope: GraphqlTagScope,
        team_id: Option<ID>,
        client_definition_id: ID,
    ) -> async_graphql::Result<GraphqlPropertyDefinition> {
        let set = ctx
            .data::<TagGraphqlContext>()?
            .0
            .ensure(
                scope.into(),
                team_id.map(|id| parse_id(id, "teamId")).transpose()?,
                parse_id(client_definition_id, "clientDefinitionId")?,
            )
            .await
            .map_err(tag_error)?;
        definition_snapshot(set)
    }
    /// Create a tag once, returning the same identity on a lost-response replay.
    async fn create_tag(
        &self,
        ctx: &Context<'_>,
        input: GraphqlCreateTagInput,
    ) -> async_graphql::Result<GraphqlCreatedTag> {
        let result = ctx
            .data::<TagGraphqlContext>()?
            .0
            .create(CreateTag {
                scope: input.scope.into(),
                team_id: input.team_id.map(|id| parse_id(id, "teamId")).transpose()?,
                client_definition_id: parse_id(input.client_definition_id, "clientDefinitionId")?,
                client_option_id: parse_id(input.client_option_id, "clientOptionId")?,
                value: input.value,
                color: input.color,
            })
            .await
            .map_err(tag_error)?;
        Ok(GraphqlCreatedTag {
            definition: definition_snapshot(result.tag_set)?,
            option: result.option.into(),
        })
    }
    /// Rename or recolor a tag addressed by a canonical ID or caller-local handle.
    async fn update_tag(
        &self,
        ctx: &Context<'_>,
        property_definition_id: ID,
        option_id: ID,
        input: GraphqlUpdateTagInput,
    ) -> async_graphql::Result<GraphqlPropertyOption> {
        ctx.data::<TagGraphqlContext>()?
            .0
            .update(
                parse_id(property_definition_id, "propertyDefinitionId")?,
                parse_id(option_id, "optionId")?,
                UpdateTag {
                    value: input.value,
                    color: input.color,
                },
            )
            .await
            .map(Into::into)
            .map_err(tag_error)
    }
    /// Delete a tag and its entity assignments without allowing replay to recreate it.
    async fn delete_tag(
        &self,
        ctx: &Context<'_>,
        property_definition_id: ID,
        option_id: ID,
    ) -> async_graphql::Result<GraphqlCacheDeletion> {
        let id = ctx
            .data::<TagGraphqlContext>()?
            .0
            .delete(
                parse_id(property_definition_id, "propertyDefinitionId")?,
                parse_id(option_id, "optionId")?,
            )
            .await
            .map_err(tag_error)?;
        Ok(GraphqlCacheDeletion::new(
            "GraphqlPropertyOption",
            id.to_string(),
        ))
    }
}

/// Convert an authorized, primary-pool tag set to the existing normalized type.
fn definition_snapshot(set: TagSet) -> async_graphql::Result<GraphqlPropertyDefinition> {
    let definition = set
        .definition
        .ok_or_else(|| tag_error(PropertiesErr::NotFound.into()))?;
    Ok(GraphqlPropertyDefinition::with_options(
        definition,
        set.options,
    ))
}

/// Preserve typed validation, access, and repository failures at the API boundary.
fn tag_error(error: TagAdapterError) -> async_graphql::Error {
    let error = match error {
        TagAdapterError::Domain(error) => error,
        TagAdapterError::Access(error) => {
            let code = match &error {
                AccessError::Unauthorized | AccessError::UnauthorizedWithMessage(_) => "FORBIDDEN",
                AccessError::NotFound(_) => "NOT_FOUND",
                AccessError::BadRequest(_) => "BAD_USER_INPUT",
                AccessError::Unavailable(_) | AccessError::Internal(_) => "INTERNAL_SERVER_ERROR",
            };
            return async_graphql::Error::new_with_source(error)
                .extend_with(|_, extensions| extensions.set("code", code));
        }
    };
    let code = match &error {
        PropertiesErr::Repo(_) | PropertiesErr::PermissionServiceNotConfigured => {
            "INTERNAL_SERVER_ERROR"
        }
        PropertiesErr::PermissionDenied | PropertiesErr::TeamMembershipRequired => "FORBIDDEN",
        PropertiesErr::NotFound
        | PropertiesErr::OptionNotFound
        | PropertiesErr::EntityPropertyNotFound => "NOT_FOUND",
        _ => "BAD_USER_INPUT",
    };
    async_graphql::Error::new_with_source(error)
        .extend_with(|_, extensions| extensions.set("code", code))
}
