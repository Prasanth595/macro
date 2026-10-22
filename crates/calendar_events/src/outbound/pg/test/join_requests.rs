use super::*;
use crate::domain::join_requests::CalendarJoinRequestStatus;

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn join_requests_open_once_and_resolve_once(pool: PgPool) {
    let sharer_id = "macro|join-sharer@example.com";
    let member_id = "macro|join-member@example.com";
    insert_user(&pool, member_id).await;
    let sharer_link = insert_link(&pool, sharer_id).await;
    let repo = PgCalendarRepository::new(pool.clone());
    let provider = provider_ids(&repo, sharer_link).await;
    let shared = timed_upsert(
        sharer_id,
        sharer_link,
        provider,
        "join@example.com",
        "Offsite",
        1,
    );
    let event_id = shared.event.id;
    repo.upsert_event_fixture(shared).await.unwrap();

    let (first, opened) = repo
        .open_join_request(event_id, member_id, "member@work.example.com")
        .await
        .unwrap();
    assert!(opened);
    assert_eq!(first.status, CalendarJoinRequestStatus::Pending);

    // Asking again while pending changes nothing and is not news.
    let (again, opened) = repo
        .open_join_request(event_id, member_id, "member@other.example.com")
        .await
        .unwrap();
    assert!(!opened);
    assert_eq!(again, first);
    assert_eq!(
        repo.list_pending_join_requests(event_id).await.unwrap(),
        [first.clone()]
    );

    let declined = repo
        .resolve_join_request(first.id, CalendarJoinRequestStatus::Declined)
        .await
        .unwrap()
        .expect("a pending request resolves");
    assert_eq!(declined.status, CalendarJoinRequestStatus::Declined);
    // A second answer finds nothing pending to resolve.
    assert_eq!(
        repo.resolve_join_request(first.id, CalendarJoinRequestStatus::Accepted)
            .await
            .unwrap(),
        None
    );
    assert!(
        repo.list_pending_join_requests(event_id)
            .await
            .unwrap()
            .is_empty()
    );

    // Asking after a decline reopens the same request at the new address.
    let (reopened, opened) = repo
        .open_join_request(event_id, member_id, "member@other.example.com")
        .await
        .unwrap();
    assert!(opened);
    assert_eq!(reopened.id, first.id);
    assert_eq!(reopened.status, CalendarJoinRequestStatus::Pending);
    assert_eq!(reopened.requester_email, "member@other.example.com");
    assert_eq!(
        repo.find_join_request(event_id, member_id).await.unwrap(),
        Some(reopened.clone())
    );

    let accepted = repo
        .resolve_join_request(first.id, CalendarJoinRequestStatus::Accepted)
        .await
        .unwrap()
        .expect("the reopened request resolves");
    assert_eq!(accepted.status, CalendarJoinRequestStatus::Accepted);
    // An accepted request is not reopened by asking again.
    let (after_accept, opened) = repo
        .open_join_request(event_id, member_id, "member@work.example.com")
        .await
        .unwrap();
    assert!(!opened);
    assert_eq!(after_accept.status, CalendarJoinRequestStatus::Accepted);

    // Requests go with the shared event.
    sqlx::query("DELETE FROM calendar_events WHERE id = $1")
        .bind(event_id)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(repo.get_join_request(first.id).await.unwrap(), None);
}
