use super::*;
use crate::domain::correspondence::{
    Correspondent, CorrespondenceWindow, EmailCorrespondenceRepo, OpenThread, WaitingOn,
};

const LINK_ID: Uuid = uuid::uuid!("00000000-0000-0000-0000-00000000c001");

fn window() -> CorrespondenceWindow {
    CorrespondenceWindow {
        since: Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap(),
        limit: 10,
    }
}

// Drafts don't count, newsletters that only write in aren't
// correspondents, and mail outside the window is ignored.
#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../fixtures", scripts("email_correspondence"))
)]
async fn correspondents_are_people_the_owner_wrote_to(pool: Pool<Postgres>) -> anyhow::Result<()> {
    let repo = EmailPgRepo::new(pool);

    let found = repo.correspondents(&[LINK_ID], window()).await?;

    assert_eq!(
        found,
        vec![
            Correspondent {
                email: "ana@client.example".to_owned(),
                name: Some("Ana Ruiz".to_owned()),
                sent: 3,
                received: 2,
                threads: 2,
                last_at: Utc.with_ymd_and_hms(2025, 1, 19, 10, 0, 0).unwrap(),
            },
            Correspondent {
                email: "bob@vendor.example".to_owned(),
                name: Some("Bob Vendor".to_owned()),
                sent: 1,
                received: 0,
                threads: 1,
                last_at: Utc.with_ymd_and_hms(2025, 1, 14, 10, 0, 0).unwrap(),
            },
        ]
    );
    Ok(())
}

// A thread is open when the other side wrote last, or when the owner's own
// message has gone unanswered since before `stale_before`. A draft is not
// a reply.
#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../../../fixtures", scripts("email_correspondence"))
)]
async fn open_threads_wait_on_someone(pool: Pool<Postgres>) -> anyhow::Result<()> {
    let repo = EmailPgRepo::new(pool);
    let stale_before = Utc.with_ymd_and_hms(2025, 1, 17, 0, 0, 0).unwrap();

    let found = repo
        .open_threads(&[LINK_ID], window(), stale_before)
        .await?;

    assert_eq!(
        found,
        vec![
            OpenThread {
                thread_id: uuid::uuid!("00000000-0000-0000-0000-00000000c101"),
                subject: Some("Re: Proposal".to_owned()),
                waiting_on: WaitingOn::Owner,
                with: vec!["ana@client.example".to_owned()],
                last_at: Utc.with_ymd_and_hms(2025, 1, 18, 10, 0, 0).unwrap(),
            },
            OpenThread {
                thread_id: uuid::uuid!("00000000-0000-0000-0000-00000000c103"),
                subject: Some("Invoice".to_owned()),
                waiting_on: WaitingOn::Others,
                with: vec!["bob@vendor.example".to_owned()],
                last_at: Utc.with_ymd_and_hms(2025, 1, 14, 10, 0, 0).unwrap(),
            },
        ]
    );
    Ok(())
}
