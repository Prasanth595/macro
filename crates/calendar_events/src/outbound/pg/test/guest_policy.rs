use super::meeting_copies::link_email;
use super::*;

const MEETING: &str = "policy@example.com";

const NO_INVITES: GuestPolicy = GuestPolicy {
    can_modify: false,
    can_invite_others: false,
    can_see_other_guests: true,
};

/// A copy of one meeting organized by `organizer`, stored in `link_id`'s inbox.
fn copy_of(
    owner_id: &str,
    link_id: Uuid,
    provider: (Uuid, Uuid),
    organizer: &str,
    policy: GuestPolicy,
    sequence: u32,
) -> CalendarEventUpsert {
    let mut copy = timed_upsert(
        owner_id,
        link_id,
        provider,
        MEETING,
        "Weekly sync",
        sequence,
    );
    copy.event.organizer_email = Some(organizer.to_string());
    copy.event.guest_policy = policy;
    copy.event.title = format!("Weekly sync {sequence}");
    copy
}

/// The entity's switches and the guest policy its stored projection carries.
async fn stored_policy(pool: &PgPool, event_id: Uuid) -> (GuestPolicy, Option<serde_json::Value>) {
    let row = sqlx::query!(
        r#"
        SELECT event.guests_can_modify, event.guests_can_invite_others,
               event.guests_can_see_other_guests,
               (SELECT source.normalized_payload -> 'event' -> 'guestPolicy'
                FROM calendar_event_sources source
                WHERE source.event_id = event.id
                LIMIT 1) AS projected
        FROM calendar_events event
        WHERE event.id = $1
        "#,
        event_id,
    )
    .fetch_one(pool)
    .await
    .unwrap();
    (
        GuestPolicy {
            can_modify: row.guests_can_modify,
            can_invite_others: row.guests_can_invite_others,
            can_see_other_guests: row.guests_can_see_other_guests,
        },
        row.projected,
    )
}

async fn changes_for(pool: &PgPool, link_id: Uuid, event_id: Uuid) -> i64 {
    sqlx::query_scalar!(
        r#"SELECT count(*) AS "count!" FROM calendar_change_log WHERE link_id = $1 AND event_id = $2"#,
        link_id,
        event_id,
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn an_organizers_policy_reaches_every_macro_held_guest_copy(pool: PgPool) {
    let organizer_id = "macro|policy-organizer@example.com";
    let guest_id = "macro|policy-guest@example.com";
    let organizer_link = insert_link(&pool, organizer_id).await;
    let guest_link = insert_link(&pool, guest_id).await;
    let claiming_link = insert_link(&pool, guest_id).await;
    let other_link = insert_link(&pool, guest_id).await;
    let snapshot_link = insert_link(&pool, guest_id).await;
    let organizer = link_email(&pool, organizer_link).await;
    let repo = PgCalendarRepository::new(pool.clone());

    let guest = repo
        .upsert_event_fixture(copy_of(
            guest_id,
            guest_link,
            provider_ids(&repo, guest_link).await,
            &organizer,
            GuestPolicy::default(),
            1,
        ))
        .await
        .unwrap();
    // A guest copy carrying a different policy is not the organizer: it
    // changes no other copy.
    repo.upsert_event_fixture(copy_of(
        guest_id,
        claiming_link,
        provider_ids(&repo, claiming_link).await,
        &organizer,
        NO_INVITES,
        1,
    ))
    .await
    .unwrap();
    assert_eq!(stored_policy(&pool, guest).await.0, GuestPolicy::default());
    let mut other_meeting = copy_of(
        guest_id,
        other_link,
        provider_ids(&repo, other_link).await,
        "someone-else@example.com",
        GuestPolicy::default(),
        1,
    );
    other_meeting.event.organizer_email = Some("someone-else@example.com".into());
    let other = repo.upsert_event_fixture(other_meeting).await.unwrap();
    let mut snapshot_copy = copy_of(
        guest_id,
        snapshot_link,
        provider_ids(&repo, snapshot_link).await,
        &organizer,
        GuestPolicy::default(),
        1,
    );
    snapshot_copy.event.is_snapshot = true;
    let snapshot = repo.upsert_event_fixture(snapshot_copy).await.unwrap();
    let changes_before = changes_for(&pool, guest_link, guest).await;

    let organized = repo
        .upsert_event_fixture(copy_of(
            organizer_id,
            organizer_link,
            provider_ids(&repo, organizer_link).await,
            &organizer,
            NO_INVITES,
            1,
        ))
        .await
        .unwrap();

    assert_eq!(stored_policy(&pool, organized).await.0, NO_INVITES);
    let (policy, projected) = stored_policy(&pool, guest).await;
    assert_eq!(policy, NO_INVITES);
    assert_eq!(
        projected,
        Some(serde_json::json!({
            "canModify": false,
            "canInviteOthers": false,
            "canSeeOtherGuests": true,
        }))
    );
    assert_eq!(
        changes_for(&pool, guest_link, guest).await,
        changes_before + 1,
        "the guest's inbox is told its copy changed"
    );
    assert_eq!(stored_policy(&pool, other).await.0, GuestPolicy::default());
    assert_eq!(
        stored_policy(&pool, snapshot).await.0,
        GuestPolicy::default()
    );

    // Turning invites back on reaches the guests too, and their projections
    // drop the key again, as a fresh default one does.
    repo.upsert_event_fixture(copy_of(
        organizer_id,
        organizer_link,
        provider_ids(&repo, organizer_link).await,
        &organizer,
        GuestPolicy::default(),
        2,
    ))
    .await
    .unwrap();
    assert_eq!(
        stored_policy(&pool, guest).await,
        (GuestPolicy::default(), None)
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn a_guest_copy_keeps_its_organizers_policy_over_a_stale_one(pool: PgPool) {
    let organizer_id = "macro|stale-organizer@example.com";
    let guest_id = "macro|stale-guest@example.com";
    let organizer_link = insert_link(&pool, organizer_id).await;
    let guest_link = insert_link(&pool, guest_id).await;
    let organizer = link_email(&pool, organizer_link).await;
    let repo = PgCalendarRepository::new(pool.clone());
    repo.upsert_event_fixture(copy_of(
        organizer_id,
        organizer_link,
        provider_ids(&repo, organizer_link).await,
        &organizer,
        NO_INVITES,
        1,
    ))
    .await
    .unwrap();
    let guest_provider = provider_ids(&repo, guest_link).await;

    // Stored after its organizer's copy, a guest copy Google has not caught
    // up yet takes the organizer's policy.
    let guest = repo
        .upsert_event_fixture(copy_of(
            guest_id,
            guest_link,
            guest_provider,
            &organizer,
            GuestPolicy::default(),
            1,
        ))
        .await
        .unwrap();
    assert_eq!(stored_policy(&pool, guest).await.0, NO_INVITES);

    // A guest-side write echoes Google's stale policy; the copy keeps the
    // organizer's.
    repo.upsert_event_fixture(copy_of(
        guest_id,
        guest_link,
        guest_provider,
        &organizer,
        GuestPolicy::default(),
        2,
    ))
    .await
    .unwrap();
    assert_eq!(stored_policy(&pool, guest).await.0, NO_INVITES);
}
