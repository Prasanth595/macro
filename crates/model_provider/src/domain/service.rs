//! Workspace authorization, validation, and model availability policy.
use super::{models::*, ports::*};
use macro_user_id::user_id::MacroUserIdStr;
use std::{collections::HashSet, sync::Arc};
use teams::domain::{model::TeamRole, workspace_membership::WorkspaceMembershipService};

/// Workspace provider use cases. Membership is rechecked on every operation.
#[derive(Clone)]
pub struct ProviderService<T> {
    store: Arc<dyn ProviderStore>,
    teams: T,
    endpoint: Arc<dyn ProviderEndpoint>,
    allow_local: bool,
}
impl<T: WorkspaceMembershipService> ProviderService<T> {
    /// Compose persistence, owning team service, and endpoint adapters.
    pub fn new(
        store: Arc<dyn ProviderStore>,
        teams: T,
        endpoint: Arc<dyn ProviderEndpoint>,
        allow_local: bool,
    ) -> Self {
        Self {
            store,
            teams,
            endpoint,
            allow_local,
        }
    }
    async fn access(
        &self,
        caller: &MacroUserIdStr<'static>,
        team: Option<uuid::Uuid>,
        edit: bool,
    ) -> Result<(Workspace, bool), ProviderError> {
        let Some(team) = team else {
            return Ok((Workspace::Personal(caller.clone()), true));
        };
        let role = self
            .teams
            .role(caller, team)
            .await?
            .ok_or(ProviderError::Forbidden)?;
        let can_edit = role >= TeamRole::Admin;
        if edit && !can_edit {
            return Err(ProviderError::Forbidden);
        }
        Ok((Workspace::Team(team), can_edit))
    }
    /// Read redacted settings for the selected workspace.
    pub async fn settings(
        &self,
        caller: &MacroUserIdStr<'static>,
        team: Option<uuid::Uuid>,
    ) -> Result<SettingsView, ProviderError> {
        let (workspace, can_edit) = self.access(caller, team, false).await?;
        let settings = self.store.load(&workspace).await?;
        Ok(view(settings, can_edit))
    }
    /// Replace configuration; keys omitted by an editor retain their previous value.
    pub async fn save(
        &self,
        caller: &MacroUserIdStr<'static>,
        team: Option<uuid::Uuid>,
        input: SettingsInput,
    ) -> Result<SettingsView, ProviderError> {
        let (workspace, _) = self.access(caller, team, true).await?;
        let previous = self.store.load(&workspace).await?;
        if input.revision != previous.revision {
            return Err(ProviderError::Conflict);
        }
        let mut settings = self.prepare(&previous, input)?;
        settings.revision = self.store.save(&workspace, &settings).await?;
        Ok(view(settings, true))
    }
    fn prepare(
        &self,
        previous: &Settings,
        input: SettingsInput,
    ) -> Result<Settings, ProviderError> {
        if input.providers.len() > 20 {
            return Err(invalid("A workspace can configure at most 20 providers"));
        }
        let mut ids = HashSet::new();
        let mut names = HashSet::new();
        let mut providers = Vec::new();
        for input in input.providers {
            if input.id.0.is_nil() || !ids.insert(input.id) {
                return Err(invalid("Each provider must have a unique id"));
            }
            let name = input.name.trim().to_owned();
            if name.is_empty() || name.len() > 100 || !names.insert(name.to_lowercase()) {
                return Err(invalid(
                    "Give each provider a unique name, up to 100 characters",
                ));
            }
            let base_url = validate_url(&input.base_url, self.allow_local)?;
            if input.models.len() > 100 {
                return Err(invalid("A provider can expose at most 100 models"));
            }
            let mut model_ids = HashSet::new();
            for model in &input.models {
                if model.id.is_empty()
                    || model.id.len() > 256
                    || model.id.trim() != model.id
                    || model
                        .id
                        .chars()
                        .any(|character| character.is_whitespace() || character.is_control())
                    || !model_ids.insert(&model.id)
                    || model.name.trim().is_empty()
                    || model.name.len() > 100
                {
                    return Err(invalid("Models need unique ids and a display name"));
                }
            }
            if input.enabled && input.models.is_empty() {
                return Err(invalid("Add at least one model before enabling a provider"));
            }
            if input
                .api_key
                .as_ref()
                .is_some_and(|key| key.len() > 8192 || key.chars().any(char::is_control))
            {
                return Err(invalid("Invalid API key"));
            }
            let existing = previous.providers.iter().find(|p| p.id == input.id);
            // Changing endpoint must never send an old credential to a new host.
            let api_key = if input.clear_api_key {
                None
            } else {
                input
                    .api_key
                    .filter(|key| !key.is_empty())
                    .map(ApiKey)
                    .or_else(|| {
                        existing
                            .filter(|p| p.base_url == base_url)
                            .and_then(|p| p.api_key.clone())
                    })
            };
            providers.push(Provider {
                id: input.id,
                name,
                base_url,
                api_key,
                enabled: input.enabled,
                models: input.models,
            });
        }
        if let Some(default) = &input.default_model {
            if !providers.iter().any(|provider| {
                provider.enabled
                    && provider
                        .models
                        .iter()
                        .any(|model| qualified(provider.id, &model.id) == *default)
            }) {
                return Err(invalid("Choose an enabled workspace model as the default"));
            }
        }
        Ok(Settings {
            revision: input.revision,
            providers,
            default_model: input.default_model,
        })
    }
    /// Test/discover an unsaved provider. Only workspace editors can call endpoints.
    pub async fn discover(
        &self,
        caller: &MacroUserIdStr<'static>,
        team: Option<uuid::Uuid>,
        input: ProviderInput,
    ) -> Result<Vec<ProviderModel>, ProviderError> {
        let (workspace, _) = self.access(caller, team, true).await?;
        let previous = self.store.load(&workspace).await?;
        let mut input = input;
        input.enabled = false;
        let settings = self.prepare(
            &previous,
            SettingsInput {
                revision: previous.revision,
                providers: vec![input],
                default_model: None,
            },
        )?;
        self.endpoint.discover(&settings.providers[0]).await
    }
    async fn workspaces(
        &self,
        caller: &MacroUserIdStr<'static>,
    ) -> Result<Vec<Workspace>, ProviderError> {
        let mut workspaces = vec![Workspace::Personal(caller.clone())];
        let mut teams = self.teams.teams(caller).await?;
        teams.sort_unstable();
        teams.dedup();
        workspaces.extend(teams.into_iter().map(Workspace::Team));
        Ok(workspaces)
    }
    /// All enabled models the caller may use, without revealing credentials.
    pub async fn catalog(
        &self,
        caller: &MacroUserIdStr<'static>,
    ) -> Result<Catalog, ProviderError> {
        let mut catalog = Catalog::default();
        for workspace in self.workspaces(caller).await? {
            let settings = self.store.load(&workspace).await?;
            if catalog.default_model.is_none() {
                catalog.default_model = settings.default_model;
            }
            for provider in settings.providers.into_iter().filter(|p| p.enabled) {
                catalog
                    .models
                    .extend(provider.models.into_iter().map(|model| CatalogModel {
                        id: qualified(provider.id, &model.id),
                        name: model.name,
                        provider: provider.name.clone(),
                        supports_images: model.supports_images,
                    }));
            }
        }
        Ok(catalog)
    }
    /// Resolve a selected workspace model against fresh membership/configuration.
    /// Built-in ids return `None`; custom ids never silently fall back to a cloud model.
    pub async fn resolve(
        &self,
        caller: &MacroUserIdStr<'static>,
        model: &str,
    ) -> Result<Option<Arc<agent::ModelRouter<agent::MeteredHttpClient>>>, ProviderError> {
        if !model.starts_with("workspace-") {
            return Ok(None);
        }
        let (segment, name) = model
            .split_once('/')
            .ok_or(ProviderError::ModelUnavailable)?;
        let id = uuid::Uuid::parse_str(&segment["workspace-".len()..])
            .map_err(|_| ProviderError::ModelUnavailable)?;
        for workspace in self.workspaces(caller).await? {
            let settings = self.store.load(&workspace).await?;
            if let Some(provider) = settings
                .providers
                .iter()
                .find(|p| p.id.0 == id && p.enabled && p.models.iter().any(|m| m.id == name))
            {
                return self.endpoint.router(provider).await.map(Some);
            }
        }
        Err(ProviderError::ModelUnavailable)
    }
}
fn view(settings: Settings, can_edit: bool) -> SettingsView {
    SettingsView {
        revision: settings.revision,
        can_edit,
        providers: settings.providers.iter().map(ProviderView::from).collect(),
        default_model: settings.default_model,
    }
}
/// Qualify a wire model with its workspace provider id.
pub fn qualified(id: ProviderId, model: &str) -> String {
    format!("{}/{model}", id.segment())
}
fn invalid(message: &str) -> ProviderError {
    ProviderError::Invalid(message.to_owned())
}

/// Validate endpoint syntax before saving; the outbound adapter also pins approved DNS addresses.
pub fn validate_url(input: &str, allow_local: bool) -> Result<String, ProviderError> {
    let url = url::Url::parse(input.trim()).map_err(|_| invalid("Enter a valid endpoint URL"))?;
    if !matches!(url.scheme(), "https" | "http")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || (!allow_local && url.scheme() != "https")
        || input.len() > 2048
    {
        return Err(invalid(
            "Use an HTTPS API URL without credentials, query, or fragment. Local deployments also allow HTTP",
        ));
    }
    Ok(url.as_str().trim_end_matches('/').to_owned())
}
#[cfg(test)]
mod test;

#[async_trait::async_trait]
impl<T: WorkspaceMembershipService + Clone> WorkspaceModelService for ProviderService<T> {
    async fn catalog(&self, user: &MacroUserIdStr<'static>) -> Result<Catalog, ProviderError> {
        ProviderService::catalog(self, user).await
    }
    async fn resolve(
        &self,
        user: &MacroUserIdStr<'static>,
        model: &str,
    ) -> Result<Option<Arc<agent::ModelRouter<agent::MeteredHttpClient>>>, ProviderError> {
        ProviderService::resolve(self, user, model).await
    }
}
