//! Keep Macro-held guest copies of a Google meeting on the guest policy of
//! the organizer's copy, when Macro holds that copy too.
//!
//! Google takes 4 to 12 seconds to carry an organizer's policy change to its
//! guests' copies. A guest who invites someone in that window gets a 200
//! while Google drops the guest without telling anyone, so Macro applies the
//! organizer's change to every guest copy it holds as soon as it stores the
//! organizer's copy, and a guest copy written back meanwhile keeps the
//! organizer's switches instead of the stale ones Google echoes.
use super::*;

/// Align the copies of `event_id`'s meeting after it was stored: an
/// organizer's copy hands its policy to the guest copies, and a guest copy
/// takes its organizer copy's policy. Only Google copies take part: Outlook
/// has no guest policy, and a snapshot grants nothing. Copies are paired by
/// meeting UID and by the organizer address being the organizer copy's own
/// inbox, which only the organizer can connect.
#[tracing::instrument(
    name = "calendar.align_guest_policy",
    skip(tx),
    fields(aligned = tracing::field::Empty),
    err
)]
pub(super) async fn align_with_organizer(
    tx: &mut Transaction<'_, Postgres>,
    event_id: Uuid,
) -> Result<Vec<AlignedGuestCopy>, Report> {
    let rows = sqlx::query!(
        r#"
        WITH stored AS (
            SELECT event.id, event.ical_uid, lower(event.organizer_email) AS organizer,
                   lower(inbox.email_address) = lower(event.organizer_email) AS organizes
            FROM calendar_events event
            JOIN email_links inbox ON inbox.id = event.source_link_id
            WHERE event.id = $1
              AND event.organizer_email IS NOT NULL
              AND event.status <> 'cancelled'
              AND NOT event.is_snapshot
              AND EXISTS (SELECT 1 FROM calendar_event_sources source
                          WHERE source.event_id = event.id AND source.source_kind = 'google')
        ),
        pairs AS (
            SELECT organizer_copy.id AS organizer_id, guest_copy.id AS guest_id
            FROM stored
            JOIN calendar_events organizer_copy
              ON organizer_copy.id = stored.id OR NOT stored.organizes
            JOIN email_links organizer_inbox ON organizer_inbox.id = organizer_copy.source_link_id
            JOIN calendar_events guest_copy
              ON guest_copy.id = stored.id OR stored.organizes
            JOIN email_links guest_inbox ON guest_inbox.id = guest_copy.source_link_id
            WHERE calendar_meeting_uid(organizer_copy.ical_uid) = calendar_meeting_uid(stored.ical_uid)
              AND calendar_meeting_uid(guest_copy.ical_uid) = calendar_meeting_uid(stored.ical_uid)
              AND organizer_copy.id <> guest_copy.id
              AND lower(organizer_inbox.email_address) = stored.organizer
              AND lower(organizer_copy.organizer_email) = stored.organizer
              AND lower(guest_copy.organizer_email) = stored.organizer
              AND lower(guest_inbox.email_address) <> stored.organizer
              AND organizer_copy.status <> 'cancelled' AND NOT organizer_copy.is_snapshot
              AND guest_copy.status <> 'cancelled' AND NOT guest_copy.is_snapshot
              AND EXISTS (SELECT 1 FROM calendar_event_sources source
                          WHERE source.event_id = organizer_copy.id AND source.source_kind = 'google')
              AND EXISTS (SELECT 1 FROM calendar_event_sources source
                          WHERE source.event_id = guest_copy.id AND source.source_kind = 'google')
        ),
        organizer_policy AS (
            -- One organizer copy per guest copy, the freshest if the
            -- organizer's inbox somehow holds the meeting twice.
            SELECT DISTINCT ON (pairs.guest_id) pairs.guest_id,
                   organizer_copy.guests_can_modify, organizer_copy.guests_can_invite_others,
                   organizer_copy.guests_can_see_other_guests
            FROM pairs
            JOIN calendar_events organizer_copy ON organizer_copy.id = pairs.organizer_id
            ORDER BY pairs.guest_id, organizer_copy.updated_at DESC, organizer_copy.id
        )
        UPDATE calendar_events guest_copy
        SET guests_can_modify = organizer_policy.guests_can_modify,
            guests_can_invite_others = organizer_policy.guests_can_invite_others,
            guests_can_see_other_guests = organizer_policy.guests_can_see_other_guests
        FROM organizer_policy
        WHERE guest_copy.id = organizer_policy.guest_id
          AND (guest_copy.guests_can_modify, guest_copy.guests_can_invite_others,
               guest_copy.guests_can_see_other_guests)
              IS DISTINCT FROM
              (organizer_policy.guests_can_modify, organizer_policy.guests_can_invite_others,
               organizer_policy.guests_can_see_other_guests)
        RETURNING guest_copy.id, guest_copy.owner_id, guest_copy.source_link_id,
                  guest_copy.guests_can_modify,
                  guest_copy.guests_can_invite_others, guest_copy.guests_can_see_other_guests
        "#,
        event_id,
    )
    .fetch_all(&mut **tx)
    .await
    .map_err(report)?;
    let mut aligned = Vec::with_capacity(rows.len());
    for row in rows {
        let policy = GuestPolicy {
            can_modify: row.guests_can_modify,
            can_invite_others: row.guests_can_invite_others,
            can_see_other_guests: row.guests_can_see_other_guests,
        };
        // The projection omits Google's default, as a freshly synced one
        // does, so Google's own later copy of the change compares equal.
        sqlx::query!(
            r#"
            UPDATE calendar_event_sources
            SET normalized_payload = CASE WHEN $2
                THEN normalized_payload #- '{event,guestPolicy}'
                ELSE jsonb_set(normalized_payload, '{event,guestPolicy}', $3)
            END
            WHERE event_id = $1
              AND normalized_payload ? 'event'
            "#,
            row.id,
            policy.is_default(),
            serde_json::to_value(policy).map_err(report)?,
        )
        .execute(&mut **tx)
        .await
        .map_err(report)?;
        aligned.push(AlignedGuestCopy {
            event_id: row.id,
            owner_id: row.owner_id,
            email_link_id: row.source_link_id,
        });
    }
    tracing::Span::current().record("aligned", aligned.len());
    Ok(aligned)
}
