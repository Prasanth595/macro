//! The first look: who the person works with, what's waiting and what's
//! coming up, worked out from mail and calendar counts by rules alone.
//!
//! Nothing here reads a message body or calls a model. The rules follow what
//! open-source mail and CRM tools do (Twenty, Inbox Zero): someone counts only
//! if the person wrote to them, automated and personal addresses are left
//! out, a company is a work email domain, and meetings weigh more than emails.
//! The agent then reads a few of the threads named here to judge what each
//! relationship is.

#[cfg(test)]
mod test;

use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::{DateTime, Duration, Utc};
use email::domain::correspondence::{Correspondent, OpenThread, WaitingOn};

use super::{
    models::{Company, Person, RoutineIdea, UpcomingMeeting, WaitingThread},
    ports::Meeting,
};

/// How far back mail counts.
pub const MAIL_DAYS: i64 = 180;
/// How far back meetings count.
pub const PAST_MEETING_DAYS: i64 = 30;
/// How far ahead meetings are listed.
pub const AHEAD_DAYS: i64 = 7;
/// How far back an open thread can be.
pub const OPEN_THREAD_DAYS: i64 = 21;
/// How long the person's own email waits before it counts as unanswered.
pub const UNANSWERED_DAYS: i64 = 3;

/// A meeting counts as much as this many emails.
const MEETING_WEIGHT: u32 = 3;
/// Bigger meetings (all-hands, webinars) say little about who someone works
/// with.
const MAX_MEETING_SIZE: usize = 12;
/// A company needs at least this much contact to be listed.
const MIN_COMPANY_CONTACT: u32 = 2;
const MAX_TEAMMATES: usize = 10;
const MAX_COMPANIES: usize = 15;
const MAX_PEOPLE_PER_COMPANY: usize = 5;
const MAX_THREADS: usize = 10;
const MAX_MEETINGS: usize = 10;

/// Upcoming outside meetings that make a prep routine worth offering.
const PREP_MEETINGS: usize = 2;
/// Threads waiting on the person that make a reply brief worth offering.
const REPLY_BRIEF_THREADS: usize = 3;
/// Unanswered threads that make a follow-up routine worth offering.
const FOLLOW_UP_THREADS: usize = 3;

/// What the rules read.
pub struct Signals<'a> {
    /// The person's own addresses, any case.
    pub own_addresses: &'a [String],
    /// People the person wrote to in the last [`MAIL_DAYS`].
    pub correspondents: Vec<Correspondent>,
    /// Threads waiting on a reply.
    pub open_threads: Vec<OpenThread>,
    /// Meetings from [`PAST_MEETING_DAYS`] ago to [`AHEAD_DAYS`] ahead.
    pub meetings: Vec<Meeting>,
    /// Now.
    pub now: DateTime<Utc>,
}

/// What the rules found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Findings {
    /// People at the person's own company.
    pub teammates: Vec<Person>,
    /// Outside organizations.
    pub companies: Vec<Company>,
    /// Threads where the other side wrote last.
    pub waiting_on_you: Vec<WaitingThread>,
    /// Threads where the person's email went unanswered.
    pub waiting_on_them: Vec<WaitingThread>,
    /// This week's outside meetings.
    pub meetings: Vec<UpcomingMeeting>,
    /// Routines worth offering.
    pub routine_ideas: Vec<RoutineIdea>,
    /// People on personal addresses who were left out.
    pub personal_left_out: u32,
    /// Automated senders that were left out.
    pub automated_left_out: u32,
}

fn domain(email: &str) -> &str {
    email.rsplit_once('@').map_or("", |(_, domain)| domain)
}

/// How an address is treated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Own,
    Automated,
    Personal,
    Teammate,
    Outside,
}

struct Classifier {
    own: HashSet<String>,
    work_domains: HashSet<String>,
}

impl Classifier {
    fn new(own_addresses: &[String]) -> Self {
        let own: HashSet<String> = own_addresses
            .iter()
            .map(|address| address.to_lowercase())
            .collect();
        let work_domains = own
            .iter()
            .map(|address| domain(address).to_owned())
            .filter(|domain| !generic_email_domains::is_generic_email_domain(domain))
            .collect();
        Self { own, work_domains }
    }

    fn kind(&self, email: &str) -> Kind {
        let domain = domain(email);
        if self.own.contains(email) {
            Kind::Own
        } else if email_utils::is_generic_email(email) || domain.ends_with(".calendar.google.com") {
            Kind::Automated
        } else if self.work_domains.contains(domain) {
            Kind::Teammate
        } else if generic_email_domains::is_generic_email_domain(domain) {
            Kind::Personal
        } else {
            Kind::Outside
        }
    }
}

#[derive(Default)]
struct Tally {
    name: Option<String>,
    sent: u32,
    received: u32,
    meetings: u32,
    last_contact: Option<DateTime<Utc>>,
}

impl Tally {
    fn contact(&self) -> u32 {
        self.sent + self.received + MEETING_WEIGHT * self.meetings
    }

    fn saw(&mut self, at: DateTime<Utc>) {
        self.last_contact = self.last_contact.max(Some(at));
    }
}

fn count(value: i64) -> u32 {
    u32::try_from(value.max(0)).unwrap_or(u32::MAX)
}

/// Most contact first, then most recent, then by address so the order is
/// stable.
fn ranked(people: Vec<(String, &Tally)>) -> Vec<Person> {
    let mut people: Vec<(u32, Person)> = people
        .into_iter()
        .map(|(email, tally)| {
            (
                tally.contact(),
                Person {
                    email,
                    name: tally.name.clone(),
                    emails_sent: tally.sent,
                    emails_received: tally.received,
                    meetings: tally.meetings,
                    last_contact: tally.last_contact,
                },
            )
        })
        .collect();
    people.sort_by(|(a_contact, a), (b_contact, b)| {
        b_contact
            .cmp(a_contact)
            .then(b.last_contact.cmp(&a.last_contact))
            .then(a.email.cmp(&b.email))
    });
    people.into_iter().map(|(_, person)| person).collect()
}

/// "acme" from "mail.acme.co.uk"; enrichment fills the real name later.
fn name_guess(domain: &str) -> String {
    let label = domain
        .split('.')
        .find(|label| !matches!(*label, "www" | "mail" | "email" | "mx"))
        .unwrap_or(domain);
    let mut chars = label.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

/// The rules over one person's signals.
pub fn first_look(signals: Signals<'_>) -> Findings {
    let classifier = Classifier::new(signals.own_addresses);
    let mut tallies: HashMap<String, Tally> = HashMap::new();
    let mut personal: HashSet<String> = HashSet::new();
    let mut automated: HashSet<String> = HashSet::new();
    let mut leave_out = |email: &str, kind: Kind| match kind {
        Kind::Personal => {
            personal.insert(email.to_owned());
        }
        Kind::Automated => {
            automated.insert(email.to_owned());
        }
        Kind::Own | Kind::Teammate | Kind::Outside => {}
    };

    for correspondent in &signals.correspondents {
        let email = correspondent.email.to_lowercase();
        let kind = classifier.kind(&email);
        if !matches!(kind, Kind::Teammate | Kind::Outside) {
            leave_out(&email, kind);
            continue;
        }
        let tally = tallies.entry(email).or_default();
        tally.name = correspondent.name.clone();
        tally.sent = count(correspondent.sent);
        tally.received = count(correspondent.received);
        tally.saw(correspondent.last_at);
    }

    let ahead_until = signals.now + Duration::days(AHEAD_DAYS);
    let small_meetings: Vec<&Meeting> = signals
        .meetings
        .iter()
        .filter(|meeting| meeting.attendees.len() <= MAX_MEETING_SIZE)
        .collect();
    for meeting in &small_meetings {
        for attendee in &meeting.attendees {
            let email = attendee.email.to_lowercase();
            let kind = classifier.kind(&email);
            if !matches!(kind, Kind::Teammate | Kind::Outside) {
                leave_out(&email, kind);
                continue;
            }
            let tally = tallies.entry(email).or_default();
            tally.meetings += 1;
            if tally.name.is_none() {
                tally.name = attendee.name.clone();
            }
            if meeting.starts_at <= signals.now {
                tally.saw(meeting.starts_at);
            }
        }
    }

    let teammates: Vec<Person> = ranked(
        tallies
            .iter()
            .filter(|(email, _)| classifier.kind(email) == Kind::Teammate)
            .map(|(email, tally)| (email.clone(), tally))
            .collect(),
    )
    .into_iter()
    .take(MAX_TEAMMATES)
    .collect();

    let mut by_domain: BTreeMap<&str, Vec<(String, &Tally)>> = BTreeMap::new();
    for (email, tally) in &tallies {
        if classifier.kind(email) == Kind::Outside {
            by_domain
                .entry(domain(email))
                .or_default()
                .push((email.clone(), tally));
        }
    }
    let mut companies: Vec<(u32, Company)> = by_domain
        .into_iter()
        .filter_map(|(domain, people)| {
            let contact: u32 = people.iter().map(|(_, tally)| tally.contact()).sum();
            let emails = people
                .iter()
                .map(|(_, tally)| tally.sent + tally.received)
                .sum();
            let meetings = people.iter().map(|(_, tally)| tally.meetings).sum();
            let people = ranked(people);
            let last_contact = people.iter().filter_map(|person| person.last_contact).max();
            (contact >= MIN_COMPANY_CONTACT).then(|| {
                (
                    contact,
                    Company {
                        domain: domain.to_owned(),
                        name_guess: name_guess(domain),
                        people: people.into_iter().take(MAX_PEOPLE_PER_COMPANY).collect(),
                        emails,
                        meetings,
                        last_contact,
                    },
                )
            })
        })
        .collect();
    companies.sort_by(|(a_contact, a), (b_contact, b)| {
        b_contact
            .cmp(a_contact)
            .then(b.last_contact.cmp(&a.last_contact))
            .then(a.domain.cmp(&b.domain))
    });
    let companies: Vec<Company> = companies
        .into_iter()
        .take(MAX_COMPANIES)
        .map(|(_, company)| company)
        .collect();

    // Threads count only with people listed above, so a thread with a
    // personal or automated address never shows up.
    let listed: HashSet<&str> = teammates
        .iter()
        .chain(companies.iter().flat_map(|company| company.people.iter()))
        .map(|person| person.email.as_str())
        .collect();
    let mut waiting_on_you = Vec::new();
    let mut waiting_on_them = Vec::new();
    for thread in &signals.open_threads {
        let with: Vec<String> = thread
            .with
            .iter()
            .map(|email| email.to_lowercase())
            .filter(|email| listed.contains(email.as_str()))
            .collect();
        if with.is_empty() {
            continue;
        }
        let waiting = WaitingThread {
            thread_id: thread.thread_id.to_string(),
            subject: thread.subject.clone(),
            with,
            since: thread.last_at,
        };
        match thread.waiting_on {
            WaitingOn::Owner if waiting_on_you.len() < MAX_THREADS => waiting_on_you.push(waiting),
            WaitingOn::Others if waiting_on_them.len() < MAX_THREADS => {
                waiting_on_them.push(waiting);
            }
            WaitingOn::Owner | WaitingOn::Others => {}
        }
    }

    let mut meetings: Vec<UpcomingMeeting> = Vec::new();
    for meeting in &small_meetings {
        if meeting.starts_at < signals.now || meeting.starts_at >= ahead_until {
            continue;
        }
        let outside: Vec<String> = meeting
            .attendees
            .iter()
            .map(|attendee| attendee.email.to_lowercase())
            .filter(|email| classifier.kind(email) == Kind::Outside)
            .collect();
        if outside.is_empty() {
            continue;
        }
        let open_threads = waiting_on_you
            .iter()
            .chain(&waiting_on_them)
            .filter(|thread| thread.with.iter().any(|email| outside.contains(email)))
            .map(|thread| thread.thread_id.clone())
            .collect();
        meetings.push(UpcomingMeeting {
            title: meeting.title.clone(),
            starts_at: meeting.starts_at,
            outside,
            open_threads,
        });
    }
    meetings.sort_by_key(|meeting| meeting.starts_at);
    meetings.truncate(MAX_MEETINGS);

    let routine_ideas = routine_ideas(&meetings, &waiting_on_you, &waiting_on_them);
    Findings {
        teammates,
        companies,
        waiting_on_you,
        waiting_on_them,
        meetings,
        routine_ideas,
        personal_left_out: u32::try_from(personal.len()).unwrap_or(u32::MAX),
        automated_left_out: u32::try_from(automated.len()).unwrap_or(u32::MAX),
    }
}

/// Routines the evidence supports. Each writes only to the person and sends
/// nothing.
fn routine_ideas(
    meetings: &[UpcomingMeeting],
    waiting_on_you: &[WaitingThread],
    waiting_on_them: &[WaitingThread],
) -> Vec<RoutineIdea> {
    let mut ideas = Vec::new();
    if meetings.len() >= PREP_MEETINGS {
        ideas.push(RoutineIdea {
            name: "Meeting prep".to_owned(),
            why: format!(
                "{} meetings with people outside the company in the next week.",
                meetings.len()
            ),
            cron: "30 7 * * 1-5".to_owned(),
            instructions: include_str!("first_look/meeting_prep.md").trim().to_owned(),
        });
    }
    if waiting_on_you.len() >= REPLY_BRIEF_THREADS {
        ideas.push(RoutineIdea {
            name: "Replies waiting on me".to_owned(),
            why: format!(
                "{}{} threads where someone they work with wrote last.",
                waiting_on_you.len(),
                if waiting_on_you.len() >= MAX_THREADS {
                    "+"
                } else {
                    ""
                }
            ),
            cron: "0 8 * * 1-5".to_owned(),
            instructions: include_str!("first_look/reply_brief.md").trim().to_owned(),
        });
    }
    if waiting_on_them.len() >= FOLLOW_UP_THREADS {
        ideas.push(RoutineIdea {
            name: "Follow-ups".to_owned(),
            why: format!(
                "{}{} emails they sent that have had no reply for {UNANSWERED_DAYS}+ days.",
                waiting_on_them.len(),
                if waiting_on_them.len() >= MAX_THREADS {
                    "+"
                } else {
                    ""
                }
            ),
            cron: "0 9 * * 2,4".to_owned(),
            instructions: include_str!("first_look/follow_ups.md").trim().to_owned(),
        });
    }
    ideas
}
