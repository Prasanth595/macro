//! Read-only grants on an owned surface for a reader its parent's domain authorized.

use macro_sync_service_jwt::TOKEN_TTL_SECS;

use super::*;

fn pending_initiative_surface(id: Uuid) -> CollabSurface {
    CollabSurface {
        state: SurfaceState::Pending,
        ..ready_initiative_surface(id)
    }
}

#[tokio::test]
async fn a_surface_never_ensured_has_no_reader_grant() {
    let id = surface_id();
    let svc = service_with(Arc::new(MemRepo::default()), MockSurfaceInitializer::new());

    let grant = svc
        .owned_surface_reader_token(initiative_parent(id), id)
        .await
        .unwrap();

    assert!(grant.is_none());
}

#[tokio::test]
async fn a_pending_surface_has_no_reader_grant() {
    let id = surface_id();
    let svc = service_with(
        MemRepo::holding(pending_initiative_surface(id)),
        MockSurfaceInitializer::new(),
    );

    let grant = svc
        .owned_surface_reader_token(initiative_parent(id), id)
        .await
        .unwrap();

    assert!(grant.is_none());
}

#[tokio::test]
async fn a_retired_surface_has_no_reader_grant() {
    let id = surface_id();
    let repo = MemRepo::holding(ready_initiative_surface(id));
    repo.soft_deleted.store(true, Ordering::SeqCst);
    let svc = service_with(repo, MockSurfaceInitializer::new());

    let grant = svc
        .owned_surface_reader_token(initiative_parent(id), id)
        .await
        .unwrap();

    assert!(grant.is_none());
}

#[tokio::test]
async fn a_ready_surface_grants_view_for_a_session_lifetime_to_no_user() {
    let id = surface_id();
    let svc = service_with(
        MemRepo::holding(ready_initiative_surface(id)),
        MockSurfaceInitializer::new(),
    );
    let before = unix_now();

    let grant = svc
        .owned_surface_reader_token(initiative_parent(id), id)
        .await
        .unwrap()
        .expect("a ready surface has a grant");

    let claims: serde_json::Value = macro_sync_service_jwt::decode(grant.as_str(), SECRET).unwrap();
    let expires_at = claims["exp"].as_u64().unwrap() as usize;
    assert!(
        expires_at >= before + TOKEN_TTL_SECS && expires_at <= unix_now() + TOKEN_TTL_SECS,
        "{expires_at} outside [{before} + ttl, now + ttl]"
    );
    assert_eq!(
        claims,
        serde_json::json!({
            "document_id": id.to_string(),
            "access_level": "view",
            "exp": expires_at,
            "iss": "document_storage_service",
        }),
        "a reader grant is read-only and names no user"
    );
}

#[tokio::test]
async fn a_parent_whose_domain_does_not_own_its_surfaces_is_refused() {
    let id = surface_id();
    let svc = service_with(Arc::new(MemRepo::default()), MockSurfaceInitializer::new());

    for parent in [
        EntityType::Document.with_entity_string(id.to_string()),
        EntityType::Channel.with_entity_string("chan-1".to_string()),
    ] {
        let refused = svc.owned_surface_reader_token(parent, id).await;
        assert!(
            matches!(refused, Err(CollabSurfaceError::AccessDenied)),
            "{refused:?}"
        );
    }
}

#[tokio::test]
async fn another_parent_is_refused() {
    let id = surface_id();
    let svc = service_with(
        MemRepo::holding(ready_initiative_surface(id)),
        MockSurfaceInitializer::new(),
    );

    let refused = svc
        .owned_surface_reader_token(initiative_parent(surface_id()), id)
        .await;

    assert!(
        matches!(refused, Err(CollabSurfaceError::AccessDenied)),
        "{refused:?}"
    );
}

#[tokio::test]
async fn an_id_that_names_a_document_is_refused() {
    let id = surface_id();
    let repo = MemRepo::holding(ready_initiative_surface(id));
    repo.document_ids.store(true, Ordering::SeqCst);
    let svc = service_with(repo, MockSurfaceInitializer::new());

    let refused = svc
        .owned_surface_reader_token(initiative_parent(id), id)
        .await;

    assert!(
        matches!(refused, Err(CollabSurfaceError::IdReserved)),
        "{refused:?}"
    );
}
