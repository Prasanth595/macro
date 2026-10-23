use std::time::Duration;

use chrono::Duration as Days;
use email::domain::correspondence::{Correspondent, OpenThread, WaitingOn};
use uuid::Uuid;

use super::apps;
use crate::domain::{models::ReportStatus, ports::SetupError};
use crate::test_support::{
    FakeAccounts, FakeConnections, FakeImports, FakeInbox, fixture, now, user,
};

fn with_inbox(addresses: &[&str]) -> crate::test_support::Fixture {
    fixture(
        FakeImports::new(Vec::new(), Vec::new(), Vec::new()),
        FakeConnections::with(&[]),
        FakeInbox(addresses.iter().map(|a| (*a).to_owned()).collect()),
        FakeAccounts::default(),
    )
}

#[tokio::test]
async fn without_an_inbox_the_agent_is_told_to_connect_one() {
    let fixture = with_inbox(&[]);

    let error = fixture
        .service
        .first_look(&user())
        .await
        .expect_err("no inbox");

    let SetupError::Actionable(message) = error else {
        panic!("not actionable");
    };
    assert!(
        message.contains("SetupConnect(apps: [\"gmail\"])"),
        "{message}"
    );
}

#[tokio::test]
async fn an_inbox_still_syncing_says_to_look_again_later() {
    let fixture = with_inbox(&["founder@startup.example"]);

    let look = fixture
        .service
        .first_look(&user())
        .await
        .expect("first look");

    assert!(look.companies.is_empty());
    assert!(
        look.next_step.contains("still syncing"),
        "{}",
        look.next_step
    );
}

#[tokio::test]
async fn the_first_look_lists_work_and_says_to_check_before_describing_it() {
    let fixture = with_inbox(&["founder@startup.example"]);
    *fixture.activity.correspondents.lock().unwrap() = vec![Correspondent {
        email: "ana@client.example".to_owned(),
        name: Some("Ana Ruiz".to_owned()),
        sent: 4,
        received: 3,
        threads: 2,
        last_at: now() - Days::days(1),
    }];
    *fixture.activity.open_threads.lock().unwrap() = vec![OpenThread {
        thread_id: Uuid::from_u128(7),
        subject: Some("Proposal".to_owned()),
        waiting_on: WaitingOn::Owner,
        with: vec!["ana@client.example".to_owned()],
        last_at: now() - Days::days(1),
    }];

    let look = fixture
        .service
        .first_look(&user())
        .await
        .expect("first look");

    assert_eq!(look.companies.len(), 1);
    assert_eq!(look.waiting_on_you.len(), 1);
    assert!(look.next_step.contains("GetThread"), "{}", look.next_step);
    assert!(
        look.next_step
            .contains("https://macro.com/app/settings/team-members"),
        "{}",
        look.next_step
    );
}

#[tokio::test]
async fn a_finished_setup_with_an_inbox_leads_to_the_first_look() {
    let fixture = with_inbox(&["founder@startup.example"]);

    let report = fixture
        .service
        .status(&user(), &apps(&["gmail"]), Duration::ZERO)
        .await
        .expect("status");

    assert_eq!(report.status, ReportStatus::Done);
    assert!(
        report.next_step.contains("SetupFirstLook"),
        "{}",
        report.next_step
    );
}
