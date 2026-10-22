//! Durable tag handles are resolved here before ordinary domain validation.
use super::*;
use crate::domain::tag_replay::{
    CreateTag, CreateTagOptionOutcome, CreatedTag, TagReplayService, UpdateTag,
};

impl<R, P, N, B> PropertiesServiceImpl<R, P, N, B>
where
    R: PropertiesRepo,
    P: PermissionService,
    N: NotificationService,
    B: MacroEventBroker,
    anyhow::Error: From<R::Err> + From<P::Err> + From<N::Err>,
{
    async fn resolve_tag_ids(
        &self,
        user: &MacroUserIdStr<'_>,
        definition: Uuid,
        option: Uuid,
    ) -> Result<(Uuid, Uuid), PropertiesErr> {
        let bindings = self
            .repository
            .property_client_bindings(user.as_ref(), &[definition], &[option])
            .await
            .map_err(anyhow::Error::from)?;
        Ok((
            *bindings.definitions.get(&definition).unwrap_or(&definition),
            *bindings.options.get(&option).unwrap_or(&option),
        ))
    }

    async fn editable_tag_definition(
        &self,
        user: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        id: Uuid,
    ) -> Result<PropertyDefinition, PropertiesErr> {
        let definition = self
            .owned_modifiable_definition(id, user, team_id_from_receipt(team))
            .await?;
        if definition.data_type != DataType::Tag {
            return Err(PropertiesErr::Validation(
                "Expected a tag definition".into(),
            ));
        }
        Ok(definition)
    }
}

impl<R, P, N, B> TagReplayService for PropertiesServiceImpl<R, P, N, B>
where
    R: PropertiesRepo,
    P: PermissionService,
    N: NotificationService,
    B: MacroEventBroker,
    anyhow::Error: From<R::Err> + From<P::Err> + From<N::Err>,
{
    #[tracing::instrument(skip_all, name = "tags.ensure", fields(definition_id = %client_id, scope = ?scope, team_id = ?expected_team), err)]
    async fn ensure_tag_set_with_client_id(
        &self,
        user: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        scope: TagScope,
        expected_team: Option<Uuid>,
        client_id: Uuid,
    ) -> Result<TagSet, PropertiesErr> {
        if (scope == TagScope::Team
            && (expected_team.is_none() || expected_team != team_id_from_receipt(team)))
            || (scope == TagScope::User && expected_team.is_some())
        {
            return Err(PropertiesErr::PermissionDenied);
        }
        let bindings = self
            .repository
            .property_client_bindings(user.as_ref(), &[client_id], &[])
            .await
            .map_err(anyhow::Error::from)?;
        if let Some(id) = bindings.definitions.get(&client_id) {
            let definition = self.editable_tag_definition(user, team, *id).await?;
            let same_scope = matches!(
                (&definition.owner, scope),
                (
                    models_properties::PropertyOwner::User { .. },
                    TagScope::User
                ) | (
                    models_properties::PropertyOwner::Team { .. },
                    TagScope::Team
                )
            );
            if !same_scope {
                return Err(PropertiesErr::Validation(
                    "Tag handle belongs to another scope".into(),
                ));
            }
            return self.build_tag_set(scope, Some(definition)).await;
        }
        let set = self.ensure_tag_set(user, team, scope).await?;
        let definition = set.definition.as_ref().ok_or(PropertiesErr::NotFound)?;
        if client_id == definition.id {
            return Ok(set);
        }
        if client_id.get_version_num() != 4 {
            return Err(PropertiesErr::Validation(
                "Tag definition handle must be a client UUID".into(),
            ));
        }
        let bound = self
            .repository
            .bind_property_definition_client_id(user.as_ref(), client_id, definition.id)
            .await
            .map_err(anyhow::Error::from)?;
        if bound != definition.id {
            return Err(PropertiesErr::Validation(
                "Tag handle belongs to another definition".into(),
            ));
        }
        Ok(set)
    }

    #[tracing::instrument(skip_all, name = "tags.create", fields(definition_id = %request.client_definition_id, option_id = %request.client_option_id, scope = ?request.scope, team_id = ?request.team_id), err)]
    async fn create_tag(
        &self,
        user: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        request: CreateTag,
    ) -> Result<CreatedTag, PropertiesErr> {
        if request.client_option_id.get_version_num() != 4 {
            return Err(PropertiesErr::Validation(
                "Tag creation handle must be a client UUID".into(),
            ));
        }
        if request.value.trim().is_empty() {
            return Err(PropertiesErr::Validation("value cannot be empty".into()));
        }
        validate_option_color(
            &DataType::Tag,
            request.color.as_deref(),
            request.color.as_deref(),
        )?;
        let mut tag_set = self
            .ensure_tag_set_with_client_id(
                user,
                team,
                request.scope,
                request.team_id,
                request.client_definition_id,
            )
            .await?;
        let definition = tag_set.definition.as_ref().ok_or(PropertiesErr::NotFound)?;
        let outcome = self
            .repository
            .create_tag_option_with_client_id(
                user.as_ref(),
                request.client_option_id,
                definition.id,
                &request.value,
                request.color.as_deref(),
            )
            .await
            .map_err(anyhow::Error::from)?;
        let option = match outcome {
            CreateTagOptionOutcome::Present { option, created } => {
                if created {
                    self.publish_property_event(Self::property_option_created_event(&option, user));
                }
                option
            }
            CreateTagOptionOutcome::Deleted => return Err(PropertiesErr::OptionNotFound),
            CreateTagOptionOutcome::DefinitionConflict => {
                return Err(PropertiesErr::Validation(
                    "Tag handle belongs to another definition".into(),
                ));
            }
        };
        tag_set.options = self
            .repository
            .get_property_options(definition.id)
            .await
            .map_err(anyhow::Error::from)?;
        Ok(CreatedTag { tag_set, option })
    }

    #[tracing::instrument(skip_all, name = "tags.update", fields(definition_id = %definition, option_id = %option), err)]
    async fn update_tag(
        &self,
        user: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        definition: Uuid,
        option: Uuid,
        request: UpdateTag,
    ) -> Result<PropertyOption, PropertiesErr> {
        let (definition, option) = self.resolve_tag_ids(user, definition, option).await?;
        self.editable_tag_definition(user, team, definition).await?;
        self.update_property_option(
            user,
            team,
            definition,
            option,
            &UpdatePropertyOptionRequest {
                value: request.value,
                color: request.color,
                display_order: None,
            },
        )
        .await
    }

    #[tracing::instrument(skip_all, name = "tags.delete", fields(definition_id = %definition, option_id = %option), err)]
    async fn delete_tag(
        &self,
        user: &MacroUserIdStr<'_>,
        team: Option<&TeamReceipt>,
        definition: Uuid,
        option: Uuid,
    ) -> Result<Uuid, PropertiesErr> {
        let (definition, option) = self.resolve_tag_ids(user, definition, option).await?;
        self.editable_tag_definition(user, team, definition).await?;
        if let Some(existing) = self
            .repository
            .get_property_option(option)
            .await
            .map_err(anyhow::Error::from)?
            && existing.property_definition_id != definition
        {
            return Err(PropertiesErr::OptionNotFound);
        }
        match self
            .delete_property_option(user, team, definition, option)
            .await
        {
            Ok(()) | Err(PropertiesErr::OptionNotFound) => Ok(option),
            Err(error) => Err(error),
        }
    }
}

impl<R, P, N, B> PropertiesServiceImpl<R, P, N, B>
where
    R: PropertiesRepo,
    P: PermissionService,
    N: NotificationService,
    B: MacroEventBroker,
    anyhow::Error: From<R::Err> + From<P::Err> + From<N::Err>,
{
    #[tracing::instrument(skip_all, name = "properties.resolve_handles", fields(update_count = updates.len()), err)]
    pub(super) async fn resolve_option_updates(
        &self,
        access: &EditReceipt,
        mut updates: Vec<EntityPropertyOptionUpdate>,
    ) -> Result<Vec<EntityPropertyOptionUpdate>, PropertiesErr> {
        let Some(user) = access.authenticated_user() else {
            return Ok(updates);
        };
        let definitions = updates
            .iter()
            .map(|u| u.property_definition_id)
            .collect::<Vec<_>>();
        let options = updates
            .iter()
            .flat_map(|u| u.add_option_ids.iter().chain(&u.remove_option_ids))
            .copied()
            .collect::<Vec<_>>();
        if !definitions
            .iter()
            .chain(&options)
            .any(|id| id.get_version_num() == 4)
        {
            return Ok(updates);
        }
        let bindings = self
            .repository
            .property_client_bindings(user.as_ref(), &definitions, &options)
            .await
            .map_err(anyhow::Error::from)?;
        for update in &mut updates {
            update.property_definition_id = *bindings
                .definitions
                .get(&update.property_definition_id)
                .unwrap_or(&update.property_definition_id);
            for id in update
                .add_option_ids
                .iter_mut()
                .chain(&mut update.remove_option_ids)
            {
                *id = *bindings.options.get(id).unwrap_or(id);
            }
        }
        Ok(updates)
    }
    /// Resolve handles at the shared write entrypoint, including REST task creation.
    pub(super) async fn resolve_property_value(
        &self,
        access: &EditReceipt,
        definition: Uuid,
        mut value: Option<SetPropertyValue>,
    ) -> Result<(Uuid, Option<SetPropertyValue>), PropertiesErr> {
        let options = match &value {
            Some(SetPropertyValue::SelectOption { option_id }) => vec![*option_id],
            Some(SetPropertyValue::MultiSelectOption { option_ids }) => option_ids.clone(),
            _ => vec![],
        };
        let updates = self
            .resolve_option_updates(
                access,
                vec![EntityPropertyOptionUpdate {
                    property_definition_id: definition,
                    add_option_ids: options,
                    remove_option_ids: vec![],
                }],
            )
            .await?;
        let resolved = updates.into_iter().next().ok_or(PropertiesErr::NotFound)?;
        match &mut value {
            Some(SetPropertyValue::SelectOption { option_id }) => {
                *option_id = *resolved
                    .add_option_ids
                    .first()
                    .ok_or(PropertiesErr::OptionNotFound)?;
            }
            Some(SetPropertyValue::MultiSelectOption { option_ids }) => {
                *option_ids = resolved.add_option_ids
            }
            _ => {}
        }
        Ok((resolved.property_definition_id, value))
    }
}
