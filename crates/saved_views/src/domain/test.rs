use super::*;
use std::{
    collections::HashMap,
    convert::Infallible,
    sync::{Arc, Mutex},
};

#[derive(Clone, Default)]
struct MemoryRepo(Arc<Mutex<HashMap<Uuid, View>>>, Arc<Mutex<HashSet<Uuid>>>);
impl ViewRepository for MemoryRepo {
    type Err = Infallible;
    async fn get(&self, id: Uuid) -> Result<Option<View>, Self::Err> {
        Ok(self.0.lock().unwrap().get(&id).cloned())
    }
    async fn legacy_list(&self, owner: &str) -> Result<Vec<View>, Self::Err> {
        Ok(self
            .0
            .lock()
            .unwrap()
            .values()
            .filter(|v| v.user_id == owner)
            .cloned()
            .collect())
    }
    async fn create(&self, view: &View) -> Result<Option<View>, Self::Err> {
        let deleted = self.1.lock().unwrap();
        if deleted.contains(&view.id) {
            return Ok(None);
        }
        Ok(Some(
            self.0
                .lock()
                .unwrap()
                .entry(view.id)
                .or_insert_with(|| view.clone())
                .clone(),
        ))
    }
    async fn candidates(
        &self,
        viewer: &str,
        teams: &[Uuid],
        kind: Option<&str>,
        after: Option<Cursor>,
        limit: i64,
    ) -> Result<Vec<View>, Self::Err> {
        let mut found: Vec<_> = self
            .0
            .lock()
            .unwrap()
            .values()
            .filter(|v| {
                (v.user_id == viewer || v.shared_team_id.is_some_and(|t| teams.contains(&t)))
                    && kind.is_none_or(|kind| {
                        v.config.get("kind").and_then(Value::as_str) == Some(kind)
                    })
                    && after.is_none_or(|c| (v.created_at, v.id) > (c.created_at, c.id))
            })
            .cloned()
            .collect();
        found.sort_by_key(|v| (v.created_at, v.id));
        found.truncate(limit as usize);
        Ok(found)
    }
    async fn update(
        &self,
        id: Uuid,
        owner: &str,
        revision: i64,
        changes: ViewChanges<'_>,
    ) -> Result<Option<View>, Self::Err> {
        let mut rows = self.0.lock().unwrap();
        let Some(view) = rows
            .get_mut(&id)
            .filter(|v| v.user_id == owner && v.revision == revision)
        else {
            return Ok(None);
        };
        if let Some(name) = changes.name {
            view.name = name.to_owned()
        }
        if let Some(config) = changes.config {
            view.config = config.clone()
        }
        view.shared_team_id = changes.shared_team_id;
        view.revision += 1;
        Ok(Some(view.clone()))
    }
    async fn delete(&self, id: Uuid, owner: &str, revision: i64) -> Result<bool, Self::Err> {
        let mut deleted = self.1.lock().unwrap();
        let mut rows = self.0.lock().unwrap();
        if rows
            .get(&id)
            .is_some_and(|v| v.user_id == owner && v.revision == revision)
        {
            rows.remove(&id);
            deleted.insert(id);
            Ok(true)
        } else {
            Ok(false)
        }
    }
    async fn legacy_patch(
        &self,
        id: Uuid,
        owner: &str,
        name: Option<&str>,
        config: Option<&Value>,
    ) -> Result<bool, Self::Err> {
        let mut rows = self.0.lock().unwrap();
        let Some(view) = rows.get_mut(&id).filter(|v| v.user_id == owner) else {
            return Ok(false);
        };
        if let Some(name) = name {
            view.name = name.to_owned()
        }
        if let Some(config) = config {
            if let (Some(original), Some(patch)) = (view.config.as_object_mut(), config.as_object())
            {
                original.extend(patch.clone())
            }
        }
        view.revision += 1;
        Ok(true)
    }
    async fn legacy_delete(&self, id: Uuid, owner: &str) -> Result<bool, Self::Err> {
        let mut deleted = self.1.lock().unwrap();
        let mut rows = self.0.lock().unwrap();
        if rows.get(&id).is_some_and(|v| v.user_id == owner) {
            rows.remove(&id);
            deleted.insert(id);
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

#[derive(Clone, Default)]
struct MemoryMembers {
    current: Arc<Mutex<HashSet<(Uuid, String)>>>,
    batches: Arc<Mutex<Vec<usize>>>,
    revoke_viewer_on_discovery: bool,
    revoke_on_second_batch: Option<&'static str>,
}
impl MembershipPort for MemoryMembers {
    type Err = Infallible;
    async fn viewer_teams(&self, viewer: &str) -> Result<Vec<Uuid>, Self::Err> {
        let mut current = self.current.lock().unwrap();
        let teams = current
            .iter()
            .filter(|(_, user)| user == viewer)
            .map(|(team, _)| *team)
            .collect();
        if self.revoke_viewer_on_discovery && viewer == "viewer" {
            current.retain(|(_, user)| user != viewer);
        }
        Ok(teams)
    }
    async fn current_members(
        &self,
        pairs: &[(Uuid, String)],
    ) -> Result<HashSet<(Uuid, String)>, Self::Err> {
        let mut batches = self.batches.lock().unwrap();
        batches.push(pairs.len());
        let mut current = self.current.lock().unwrap();
        if batches.len() == 2
            && let Some(user) = self.revoke_on_second_batch
        {
            current.retain(|(_, member)| member != user);
        }
        Ok(pairs
            .iter()
            .filter(|p| current.contains(*p))
            .cloned()
            .collect())
    }
}

#[tokio::test]
async fn owner_only_writes_revision_conflicts_and_retries() {
    let repo = MemoryRepo::default();
    let members = MemoryMembers::default();
    let service = SavedViewService::new(repo.clone(), members);
    let id = Uuid::now_v7();
    let config = serde_json::json!({"kind":"tasks","version":1});
    let created = service
        .create("owner", id, "Original".into(), config.clone(), None)
        .await
        .unwrap();
    assert_eq!(created.revision, 1);
    let retry = service
        .create("owner", id, "New name".into(), config.clone(), None)
        .await
        .unwrap();
    assert_eq!(retry.name, "Original");
    assert!(matches!(
        service
            .update(
                "other",
                id,
                1,
                Update {
                    name: Some("stolen".into()),
                    config: None,
                    share: ShareChange::Unchanged
                }
            )
            .await,
        Err(Error::NotFound)
    ));
    let updated = service
        .update(
            "owner",
            id,
            1,
            Update {
                name: Some("Changed".into()),
                config: None,
                share: ShareChange::Unchanged,
            },
        )
        .await
        .unwrap();
    assert_eq!(updated.revision, 2);
    assert!(matches!(
        service
            .update(
                "owner",
                id,
                1,
                Update {
                    name: None,
                    config: None,
                    share: ShareChange::Private
                }
            )
            .await,
        Err(Error::Conflict)
    ));
    assert!(matches!(
        service.delete("other", id, 2).await,
        Err(Error::NotFound)
    ));
    assert!(matches!(
        service.delete("owner", id, 1).await,
        Err(Error::Conflict)
    ));
    assert_eq!(service.delete("owner", id, 2).await.unwrap(), id);
    assert_eq!(service.delete("owner", id, 2).await.unwrap(), id);
    assert!(matches!(
        service
            .create("owner", id, "Delayed retry".into(), config, None)
            .await,
        Err(Error::NotFound)
    ));
    assert!(repo.0.lock().unwrap().is_empty());
}

#[tokio::test]
async fn owner_rejoining_restores_share_and_list_pages_only_visible_views() {
    let repo = MemoryRepo::default();
    let members = MemoryMembers::default();
    let team = Uuid::now_v7();
    members
        .current
        .lock()
        .unwrap()
        .insert((team, "owner".into()));
    members
        .current
        .lock()
        .unwrap()
        .insert((team, "viewer".into()));
    let service = SavedViewService::new(repo.clone(), members.clone());
    for i in 0..105 {
        let id = Uuid::now_v7();
        let view = service
            .create(
                "owner",
                id,
                format!("View {i}"),
                serde_json::json!({"kind":"tasks"}),
                Some(team),
            )
            .await
            .unwrap();
        if i < 103 {
            repo.0.lock().unwrap().get_mut(&view.id).unwrap().user_id = "absent".into();
        }
    }
    let first = service
        .list("viewer", Some("tasks"), None, 1)
        .await
        .unwrap();
    assert_eq!(first.views.len(), 1);
    assert!(first.next.is_some());
    let second = service
        .list("viewer", Some("tasks"), first.next, 1)
        .await
        .unwrap();
    assert_eq!(second.views.len(), 1);
    assert_ne!(first.views[0].id, second.views[0].id);
    assert!(second.next.is_none());
    members
        .current
        .lock()
        .unwrap()
        .remove(&(team, "owner".into()));
    assert!(matches!(
        service.get("viewer", first.views[0].id).await,
        Err(Error::NotFound)
    ));
    let owner = service.get("owner", first.views[0].id).await.unwrap();
    assert_eq!(owner.shared_team_id, None);
    members
        .current
        .lock()
        .unwrap()
        .insert((team, "owner".into()));
    assert_eq!(
        service.get("viewer", first.views[0].id).await.unwrap().id,
        first.views[0].id
    );
    assert!(
        members
            .batches
            .lock()
            .unwrap()
            .iter()
            .any(|size| *size == 2)
    );
}

#[tokio::test]
async fn legacy_writes_preserve_unauthorized_and_missing_responses() {
    let service = SavedViewService::new(MemoryRepo::default(), MemoryMembers::default());
    let view = service
        .legacy_create("owner", "Legacy".into(), serde_json::json!({}))
        .await
        .unwrap();
    assert!(matches!(
        service.legacy_patch("other", view.id, None, None).await,
        Err(Error::NotOwner)
    ));
    assert!(matches!(
        service.legacy_delete("other", view.id).await,
        Err(Error::NotOwner)
    ));
    service.legacy_delete("owner", view.id).await.unwrap();
    assert!(matches!(
        service.legacy_patch("owner", view.id, None, None).await,
        Err(Error::NotFound)
    ));
    assert!(matches!(
        service.legacy_delete("owner", view.id).await,
        Err(Error::NotFound)
    ));
}

#[tokio::test]
async fn revocation_during_discovery_blocks_both_detail_and_list() {
    let repo = MemoryRepo::default();
    let members = MemoryMembers {
        revoke_viewer_on_discovery: true,
        ..Default::default()
    };
    let team = Uuid::now_v7();
    members
        .current
        .lock()
        .unwrap()
        .insert((team, "owner".into()));
    members
        .current
        .lock()
        .unwrap()
        .insert((team, "viewer".into()));
    let service = SavedViewService::new(repo, members.clone());
    let view = service
        .create(
            "owner",
            Uuid::now_v7(),
            "Shared".into(),
            serde_json::json!({}),
            Some(team),
        )
        .await
        .unwrap();
    assert!(matches!(
        service.get("viewer", view.id).await,
        Err(Error::NotFound)
    ));
    members
        .current
        .lock()
        .unwrap()
        .insert((team, "viewer".into()));
    assert!(
        service
            .list("viewer", None, None, 10)
            .await
            .unwrap()
            .views
            .is_empty()
    );
}

#[tokio::test]
async fn later_batches_recheck_accumulated_shared_views() {
    for count in [100, 101] {
        for revoked_user in ["viewer", "owner"] {
            let repo = MemoryRepo::default();
            let members = MemoryMembers {
                revoke_on_second_batch: Some(revoked_user),
                ..Default::default()
            };
            let team = Uuid::now_v7();
            members
                .current
                .lock()
                .unwrap()
                .insert((team, "owner".into()));
            members
                .current
                .lock()
                .unwrap()
                .insert((team, "viewer".into()));
            let mut personal_id = Uuid::nil();
            let created_at = chrono::Utc::now();
            for index in 0..count {
                let mut view = View::new(
                    "owner".into(),
                    format!("View {index}"),
                    serde_json::json!({"kind":"tasks"}),
                );
                view.created_at = created_at + chrono::Duration::seconds(index);
                view.shared_team_id = Some(team);
                if index > 0 {
                    view.user_id = "absent".into();
                }
                if index == 1 {
                    view.user_id = "viewer".into();
                    view.shared_team_id = None;
                    personal_id = view.id;
                }
                repo.0.lock().unwrap().insert(view.id, view);
            }
            let service = SavedViewService::new(repo, members);
            let page = service
                .list("viewer", Some("tasks"), None, 50)
                .await
                .unwrap();
            assert_eq!(
                page.views.len(),
                1,
                "{count} candidates, revoked {revoked_user}"
            );
            assert_eq!(page.views[0].id, personal_id);
            assert!(page.next.is_none());
        }
    }
}
