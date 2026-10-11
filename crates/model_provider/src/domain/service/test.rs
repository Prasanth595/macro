use super::*;
use async_trait::async_trait;
use std::{collections::HashMap, sync::Mutex};
use teams::domain::model::TeamError;

#[derive(Default)]
struct Store(Mutex<HashMap<String, Settings>>);
#[async_trait]
impl ProviderStore for Store {
    async fn load(&self, workspace: &Workspace) -> Result<Settings, ProviderError> {
        Ok(self
            .0
            .lock()
            .unwrap()
            .get(&workspace.key())
            .cloned()
            .unwrap_or_default())
    }
    async fn save(&self, workspace: &Workspace, settings: &Settings) -> Result<i64, ProviderError> {
        let mut values = self.0.lock().unwrap();
        if values
            .get(&workspace.key())
            .map_or(0, |value| value.revision)
            != settings.revision
        {
            return Err(ProviderError::Conflict);
        }
        let mut settings = settings.clone();
        settings.revision += 1;
        let revision = settings.revision;
        values.insert(workspace.key(), settings);
        Ok(revision)
    }
}
#[derive(Clone)]
struct Teams {
    team: uuid::Uuid,
    role: Option<TeamRole>,
}
impl WorkspaceMembershipService for Teams {
    async fn teams(&self, _: &MacroUserIdStr<'static>) -> Result<Vec<uuid::Uuid>, TeamError> {
        Ok(self.role.map_or(Vec::new(), |_| vec![self.team]))
    }
    async fn role(
        &self,
        _: &MacroUserIdStr<'static>,
        team: uuid::Uuid,
    ) -> Result<Option<TeamRole>, TeamError> {
        Ok((team == self.team).then_some(self.role).flatten())
    }
}
struct Endpoint;
#[async_trait]
impl ProviderEndpoint for Endpoint {
    async fn discover(&self, _: &Provider) -> Result<Vec<ProviderModel>, ProviderError> {
        Ok(Vec::new())
    }
    async fn router(
        &self,
        provider: &Provider,
    ) -> Result<Arc<agent::ModelRouter<agent::MeteredHttpClient>>, ProviderError> {
        Ok(Arc::new(
            agent::ModelRouter::openai_compatible(
                &provider.id.segment(),
                &provider.base_url,
                "test",
                reqwest::Client::new(),
            )
            .unwrap(),
        ))
    }
}
fn user(email: &str) -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from(format!("macro|{email}")).unwrap()
}
fn input(id: ProviderId, key: Option<&str>) -> ProviderInput {
    ProviderInput {
        id,
        name: "My local provider".into(),
        base_url: "http://localhost:11434/v1".into(),
        api_key: key.map(str::to_owned),
        clear_api_key: false,
        enabled: true,
        models: vec![ProviderModel {
            id: "llama3.2".into(),
            name: "Llama".into(),
            supports_images: false,
        }],
    }
}
fn settings(id: ProviderId, key: Option<&str>, revision: i64) -> SettingsInput {
    SettingsInput {
        revision,
        providers: vec![input(id, key)],
        default_model: Some(qualified(id, "llama3.2")),
    }
}
fn service(role: Option<TeamRole>) -> (ProviderService<Teams>, Arc<Store>, uuid::Uuid) {
    let store = Arc::new(Store::default());
    let team = uuid::Uuid::now_v7();
    (
        ProviderService::new(
            store.clone(),
            Teams { team, role },
            Arc::new(Endpoint),
            true,
        ),
        store,
        team,
    )
}
#[tokio::test]
async fn members_can_read_and_use_team_models_but_cannot_edit_or_discover() {
    let (admin, store, team) = service(Some(TeamRole::Admin));
    let id = ProviderId(uuid::Uuid::now_v7());
    let caller = user("admin@example.com");
    admin
        .save(
            &caller,
            Some(team),
            settings(id, Some("private-test-key"), 0),
        )
        .await
        .unwrap();
    let member = ProviderService::new(
        store.clone(),
        Teams {
            team,
            role: Some(TeamRole::Member),
        },
        Arc::new(Endpoint),
        true,
    );
    let view = member.settings(&caller, Some(team)).await.unwrap();
    assert!(!view.can_edit);
    let json = serde_json::to_string(&view).unwrap();
    assert!(!json.contains("private-test-key"));
    assert!(!json.contains("\"api_key\""));
    assert_eq!(member.catalog(&caller).await.unwrap().models.len(), 1);
    assert!(
        member
            .resolve(&caller, &qualified(id, "llama3.2"))
            .await
            .unwrap()
            .is_some()
    );
    assert!(matches!(
        member
            .save(&caller, Some(team), settings(id, None, 1))
            .await,
        Err(ProviderError::Forbidden)
    ));
    assert!(matches!(
        member.discover(&caller, Some(team), input(id, None)).await,
        Err(ProviderError::Forbidden)
    ));
    let stranger =
        ProviderService::new(store, Teams { team, role: None }, Arc::new(Endpoint), true);
    assert!(matches!(
        stranger.settings(&caller, Some(team)).await,
        Err(ProviderError::Forbidden)
    ));
    assert!(matches!(
        stranger.resolve(&caller, &qualified(id, "llama3.2")).await,
        Err(ProviderError::ModelUnavailable)
    ));
}
#[tokio::test]
async fn credentials_are_preserved_rotated_cleared_and_not_forwarded_after_url_changes() {
    let (service, store, _) = service(None);
    let caller = user("me@example.com");
    let id = ProviderId(uuid::Uuid::now_v7());
    service
        .save(&caller, None, settings(id, Some("first"), 0))
        .await
        .unwrap();
    service
        .save(&caller, None, settings(id, None, 1))
        .await
        .unwrap();
    assert_eq!(
        store
            .load(&Workspace::Personal(caller.clone()))
            .await
            .unwrap()
            .providers[0]
            .api_key
            .as_ref()
            .unwrap()
            .0,
        "first"
    );
    service
        .save(&caller, None, settings(id, Some("rotated"), 2))
        .await
        .unwrap();
    let mut clear = settings(id, None, 3);
    clear.providers[0].clear_api_key = true;
    service.save(&caller, None, clear).await.unwrap();
    assert!(
        store
            .load(&Workspace::Personal(caller.clone()))
            .await
            .unwrap()
            .providers[0]
            .api_key
            .is_none()
    );
    service
        .save(&caller, None, settings(id, Some("third"), 4))
        .await
        .unwrap();
    let mut changed = settings(id, None, 5);
    changed.providers[0].base_url = "https://other.example/v1".into();
    service.save(&caller, None, changed).await.unwrap();
    assert!(
        store
            .load(&Workspace::Personal(caller))
            .await
            .unwrap()
            .providers[0]
            .api_key
            .is_none()
    );
}
#[tokio::test]
async fn stale_edits_and_disabled_or_cross_workspace_models_fail_closed() {
    let (service, _, _) = service(None);
    let id = ProviderId(uuid::Uuid::now_v7());
    let alice = user("alice@example.com");
    let bob = user("bob@example.com");
    service
        .save(&alice, None, settings(id, None, 0))
        .await
        .unwrap();
    assert!(matches!(
        service.save(&alice, None, settings(id, None, 0)).await,
        Err(ProviderError::Conflict)
    ));
    assert!(service.catalog(&bob).await.unwrap().models.is_empty());
    assert!(matches!(
        service.resolve(&bob, &qualified(id, "llama3.2")).await,
        Err(ProviderError::ModelUnavailable)
    ));
    let mut disabled = settings(id, None, 1);
    disabled.providers[0].enabled = false;
    disabled.default_model = None;
    service.save(&alice, None, disabled).await.unwrap();
    assert!(matches!(
        service.resolve(&alice, &qualified(id, "llama3.2")).await,
        Err(ProviderError::ModelUnavailable)
    ));
    assert!(
        service
            .resolve(&alice, "openai/gpt-6-astra")
            .await
            .unwrap()
            .is_none()
    );
}
#[test]
fn endpoint_and_default_validation() {
    assert!(validate_url("http://localhost:11434/v1", false).is_err());
    assert_eq!(
        validate_url("http://localhost:11434/v1/", true).unwrap(),
        "http://localhost:11434/v1"
    );
    for url in [
        "file:///etc/passwd",
        "https://key@provider.example/v1",
        "https://provider.example/v1?api_key=secret",
        "https://provider.example/v1#secret",
    ] {
        assert!(validate_url(url, true).is_err());
    }
    let (service, _, _) = service(None);
    let id = ProviderId(uuid::Uuid::now_v7());
    let mut config = settings(id, None, 0);
    config.default_model = Some("workspace-missing/model".into());
    assert!(service.prepare(&Settings::default(), config).is_err());
    let mut config = settings(id, None, 0);
    config.providers.push(input(id, None));
    assert!(service.prepare(&Settings::default(), config).is_err());
}
