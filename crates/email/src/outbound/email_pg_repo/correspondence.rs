use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::EmailPgRepo;
use crate::domain::{
    correspondence::{
        CorrespondenceWindow, Correspondent, EmailCorrespondenceRepo, OpenThread, WaitingOn,
    },
    models::EmailErr,
};

impl EmailCorrespondenceRepo for EmailPgRepo {
    #[tracing::instrument(skip(self), err)]
    async fn correspondents(
        &self,
        link_ids: &[Uuid],
        window: CorrespondenceWindow,
    ) -> Result<Vec<Correspondent>, EmailErr> {
        // One row per message and person on its other side, then counted per
        // address. Only people the person wrote to are kept (`sent > 0`).
        sqlx::query_as!(
            Correspondent,
            r#"
            WITH mail AS (
                SELECT LOWER(c.email_address) AS email, c.name, true AS sent,
                    m.thread_id, m.internal_date_ts AS at
                FROM email_messages m
                JOIN email_message_recipients r ON r.message_id = m.id
                JOIN email_contacts c ON c.id = r.contact_id
                WHERE m.link_id = ANY($1) AND m.is_sent AND NOT m.is_draft
                  AND m.internal_date_ts >= $2
                UNION ALL
                SELECT LOWER(c.email_address), COALESCE(m.from_name, c.name), false,
                    m.thread_id, m.internal_date_ts
                FROM email_messages m
                JOIN email_contacts c ON c.id = m.from_contact_id
                WHERE m.link_id = ANY($1) AND NOT m.is_sent AND NOT m.is_draft
                  AND m.internal_date_ts >= $2
            )
            SELECT
                email AS "email!",
                (ARRAY_AGG(name ORDER BY at DESC) FILTER (WHERE name IS NOT NULL))[1] AS name,
                COUNT(*) FILTER (WHERE sent) AS "sent!",
                COUNT(*) FILTER (WHERE NOT sent) AS "received!",
                COUNT(DISTINCT thread_id) AS "threads!",
                MAX(at) AS "last_at!"
            FROM mail
            GROUP BY email
            HAVING COUNT(*) FILTER (WHERE sent) > 0
            ORDER BY COUNT(*) DESC, MAX(at) DESC, email
            LIMIT $3
            "#,
            link_ids,
            window.since,
            window.limit,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|error| EmailErr::RepoErr(error.into()))
    }

    #[tracing::instrument(skip(self), err)]
    async fn open_threads(
        &self,
        link_ids: &[Uuid],
        window: CorrespondenceWindow,
        stale_before: DateTime<Utc>,
    ) -> Result<Vec<OpenThread>, EmailErr> {
        let rows = sqlx::query!(
            r#"
            SELECT
                t.id AS "thread_id!",
                last.subject,
                last.is_sent AS "owner_wrote_last!",
                last.internal_date_ts AS "last_at!",
                ARRAY(
                    SELECT LOWER(c.email_address)
                    FROM email_message_recipients r
                    JOIN email_contacts c ON c.id = r.contact_id
                    WHERE r.message_id = last.id AND last.is_sent
                    UNION
                    SELECT LOWER(c.email_address)
                    FROM email_contacts c
                    WHERE c.id = last.from_contact_id AND NOT last.is_sent
                ) AS "with!"
            FROM email_threads t
            JOIN LATERAL (
                SELECT m.id, m.subject, m.is_sent, m.from_contact_id, m.internal_date_ts
                FROM email_messages m
                WHERE m.thread_id = t.id AND NOT m.is_draft AND m.internal_date_ts IS NOT NULL
                ORDER BY m.internal_date_ts DESC, m.id DESC
                LIMIT 1
            ) last ON true
            WHERE t.link_id = ANY($1)
              AND t.latest_outbound_message_ts IS NOT NULL
              -- Narrows threads before the per-thread lookup.
              AND GREATEST(t.latest_inbound_message_ts, t.latest_outbound_message_ts) >= $2
              AND last.internal_date_ts >= $2
              AND (NOT last.is_sent OR last.internal_date_ts < $3)
            ORDER BY last.internal_date_ts DESC, t.id
            LIMIT $4
            "#,
            link_ids,
            window.since,
            stale_before,
            window.limit,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|error| EmailErr::RepoErr(error.into()))?;
        Ok(rows
            .into_iter()
            .map(|row| OpenThread {
                thread_id: row.thread_id,
                subject: row.subject,
                waiting_on: if row.owner_wrote_last {
                    WaitingOn::Others
                } else {
                    WaitingOn::Owner
                },
                with: row.with,
                last_at: row.last_at,
            })
            .collect())
    }
}
