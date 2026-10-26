use chrono::{DateTime, Duration, TimeZone, Utc};
use email::domain::correspondence::{Correspondent, OpenThread, WaitingOn};
use uuid::Uuid;

use super::{Signals, first_look};
use crate::domain::ports::{Meeting, MeetingAttendee};

fn now() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 10, 14, 12, 0, 0).unwrap()
}

fn correspondent(email: &str, sent: i64, received: i64) -> Correspondent {
    Correspondent {
        email: email.to_owned(),
        name: None,
        sent,
        received,
        threads: 1,
        last_at: now() - Duration::days(2),
    }
}

fn meeting(title: &str, days_from_now: i64, attendees: &[&str]) -> Meeting {
    Meeting {
        title: title.to_owned(),
        starts_at: now() + Duration::days(days_from_now),
        attendees: attendees
            .iter()
            .map(|email| MeetingAttendee {
                email: (*email).to_owned(),
                name: None,
            })
            .collect(),
    }
}

fn thread(id: u128, waiting_on: WaitingOn, with: &[&str]) -> OpenThread {
    OpenThread {
        thread_id: Uuid::from_u128(id),
        subject: Some(format!("Thread {id}")),
        waiting_on,
        with: with.iter().map(|email| (*email).to_owned()).collect(),
        last_at: now() - Duration::days(1),
    }
}

const OWN: &[&str] = &["founder@startup.example"];

fn own() -> Vec<String> {
    OWN.iter().map(|address| (*address).to_owned()).collect()
}

#[test]
fn people_split_into_teammates_and_companies_and_the_rest_is_left_out() {
    let own = own();
    let found = first_look(Signals {
        own_addresses: &own,
        correspondents: vec![
            correspondent("cto@startup.example", 20, 25),
            correspondent("ana@client.example", 4, 3),
            correspondent("mum@gmail.com", 6, 6),
            correspondent("noreply@billing.example", 1, 9),
            correspondent("Founder@Startup.example", 1, 1),
        ],
        open_threads: Vec::new(),
        meetings: Vec::new(),
        now: now(),
    });

    let teammates: Vec<&str> = found.teammates.iter().map(|p| p.email.as_str()).collect();
    assert_eq!(teammates, ["cto@startup.example"]);
    let companies: Vec<(&str, &str)> = found
        .companies
        .iter()
        .map(|c| (c.domain.as_str(), c.name_guess.as_str()))
        .collect();
    assert_eq!(companies, [("client.example", "Client")]);
    assert_eq!(found.personal_left_out, 1);
    assert_eq!(found.automated_left_out, 1);
}

#[test]
fn meetings_weigh_more_than_email_and_a_single_email_is_not_a_company() {
    let own = own();
    let found = first_look(Signals {
        own_addresses: &own,
        correspondents: vec![
            correspondent("a@emailer.example", 4, 0),
            correspondent("b@met.example", 1, 0),
            correspondent("c@once.example", 1, 0),
        ],
        open_threads: Vec::new(),
        // Two past meetings with met.example: 1 email + 2 meetings beats 4
        // emails.
        meetings: vec![
            meeting("Intro", -10, &["b@met.example"]),
            meeting("Follow-up", -3, &["b@met.example"]),
        ],
        now: now(),
    });

    let companies: Vec<&str> = found.companies.iter().map(|c| c.domain.as_str()).collect();
    assert_eq!(companies, ["met.example", "emailer.example"]);
    assert_eq!(found.companies[0].meetings, 2);
    assert_eq!(
        found.companies[0].people[0].last_contact,
        Some(now() - Duration::days(2))
    );
}

#[test]
fn threads_and_meetings_only_name_people_listed_and_link_to_each_other() {
    let own = own();
    let found = first_look(Signals {
        own_addresses: &own,
        correspondents: vec![
            correspondent("ana@client.example", 5, 5),
            correspondent("cto@startup.example", 5, 5),
            correspondent("friend@gmail.com", 5, 5),
        ],
        open_threads: vec![
            thread(1, WaitingOn::Owner, &["ana@client.example"]),
            thread(2, WaitingOn::Owner, &["friend@gmail.com"]),
            thread(3, WaitingOn::Others, &["cto@startup.example"]),
        ],
        meetings: vec![
            meeting(
                "Client sync",
                1,
                &["ana@client.example", "cto@startup.example"],
            ),
            meeting("Standup", 1, &["cto@startup.example"]),
            meeting("Last week", -5, &["ana@client.example"]),
            meeting("Next month", 30, &["ana@client.example"]),
        ],
        now: now(),
    });

    let waiting: Vec<String> = found
        .waiting_on_you
        .iter()
        .map(|t| t.thread_id.clone())
        .collect();
    assert_eq!(waiting, [Uuid::from_u128(1).to_string()]);
    assert_eq!(found.waiting_on_them.len(), 1);
    assert_eq!(found.meetings.len(), 1, "only this week's outside meetings");
    assert_eq!(found.meetings[0].title, "Client sync");
    assert_eq!(found.meetings[0].outside, ["ana@client.example"]);
    assert_eq!(
        found.meetings[0].open_threads,
        [Uuid::from_u128(1).to_string()]
    );
}

#[test]
fn big_meetings_say_nothing_about_who_someone_works_with() {
    let own = own();
    let crowd: Vec<String> = (0..20).map(|n| format!("p{n}@conf.example")).collect();
    let crowd: Vec<&str> = crowd.iter().map(String::as_str).collect();
    let found = first_look(Signals {
        own_addresses: &own,
        correspondents: Vec::new(),
        open_threads: Vec::new(),
        meetings: vec![
            meeting("Webinar", 1, &crowd),
            meeting("Webinar", -1, &crowd),
        ],
        now: now(),
    });

    assert!(found.companies.is_empty());
    assert!(found.meetings.is_empty());
}

#[test]
fn routines_are_suggested_only_with_evidence() {
    let own = own();
    let quiet = first_look(Signals {
        own_addresses: &own,
        correspondents: vec![correspondent("ana@client.example", 5, 5)],
        open_threads: vec![thread(1, WaitingOn::Owner, &["ana@client.example"])],
        meetings: vec![meeting("Client sync", 1, &["ana@client.example"])],
        now: now(),
    });
    assert!(quiet.routine_ideas.is_empty());

    let busy = first_look(Signals {
        own_addresses: &own,
        correspondents: vec![
            correspondent("ana@client.example", 5, 5),
            correspondent("bo@other.example", 5, 5),
        ],
        open_threads: vec![
            thread(1, WaitingOn::Owner, &["ana@client.example"]),
            thread(2, WaitingOn::Owner, &["bo@other.example"]),
            thread(3, WaitingOn::Owner, &["ana@client.example"]),
            thread(4, WaitingOn::Others, &["bo@other.example"]),
        ],
        meetings: vec![
            meeting("Client sync", 1, &["ana@client.example"]),
            meeting("Other sync", 2, &["bo@other.example"]),
        ],
        now: now(),
    });
    let names: Vec<&str> = busy.routine_ideas.iter().map(|i| i.name.as_str()).collect();
    assert_eq!(names, ["Meeting prep", "Replies waiting on me"]);
    assert_eq!(
        busy.routine_ideas[0].why,
        "2 meetings with people outside the company in the next week."
    );
}

#[test]
fn someone_on_a_personal_address_has_no_teammates_by_domain() {
    let own = vec!["solo@gmail.com".to_owned()];
    let found = first_look(Signals {
        own_addresses: &own,
        correspondents: vec![
            correspondent("pal@gmail.com", 5, 5),
            correspondent("ana@client.example", 5, 5),
        ],
        open_threads: Vec::new(),
        meetings: Vec::new(),
        now: now(),
    });

    assert!(found.teammates.is_empty());
    assert_eq!(found.companies.len(), 1);
    assert_eq!(found.personal_left_out, 1);
}
