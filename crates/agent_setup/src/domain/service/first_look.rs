//! `SetupFirstLook`: who the person works with, what's waiting on whom and
//! this week's meetings, from their own mail and calendar.

use chrono::Duration;
use email::domain::correspondence::CorrespondenceWindow;
use macro_user_id::user_id::MacroUserIdStr;

use super::AgentSetupService;
use crate::domain::{
    first_look::{
        self, AHEAD_DAYS, Findings, MAIL_DAYS, OPEN_THREAD_DAYS, PAST_MEETING_DAYS, Signals,
        UNANSWERED_DAYS,
    },
    models::FirstLook,
    ports::{Result, SetupError},
};

/// The most correspondents read; the rules keep far fewer.
const CORRESPONDENT_LIMIT: i64 = 300;
/// The most open threads read.
const OPEN_THREAD_LIMIT: i64 = 100;

impl AgentSetupService {
    /// What the person's mail and calendar show about their work. Read-only;
    /// reads counts, subjects and attendees, never message bodies.
    #[tracing::instrument(skip(self, user), err)]
    pub async fn first_look(&self, user: &MacroUserIdStr<'static>) -> Result<FirstLook> {
        let inboxes = self.inbox.inboxes(user).await?;
        if inboxes.is_empty() {
            return Err(SetupError::Actionable(
                "No inbox is connected. Call SetupConnect(apps: [\"gmail\"]) (or \"outlook\") \
                 and show the person the link, then call SetupFirstLook once they've connected."
                    .to_owned(),
            ));
        }
        let own_addresses: Vec<String> = inboxes.into_iter().map(|inbox| inbox.address).collect();
        let now = (self.clock)();
        let correspondents = self
            .activity
            .correspondents(
                user,
                CorrespondenceWindow {
                    since: now - Duration::days(MAIL_DAYS),
                    limit: CORRESPONDENT_LIMIT,
                },
            )
            .await?;
        let open_threads = self
            .activity
            .open_threads(
                user,
                CorrespondenceWindow {
                    since: now - Duration::days(OPEN_THREAD_DAYS),
                    limit: OPEN_THREAD_LIMIT,
                },
                now - Duration::days(UNANSWERED_DAYS),
            )
            .await?;
        let meetings = self
            .activity
            .meetings(
                user,
                now - Duration::days(PAST_MEETING_DAYS),
                now + Duration::days(AHEAD_DAYS),
            )
            .await?;
        let findings = first_look::first_look(Signals {
            own_addresses: &own_addresses,
            correspondents,
            open_threads,
            meetings,
            now,
        });
        tracing::info!(
            teammates = findings.teammates.len(),
            companies = findings.companies.len(),
            waiting_on_you = findings.waiting_on_you.len(),
            waiting_on_them = findings.waiting_on_them.len(),
            meetings = findings.meetings.len(),
            routine_ideas = findings.routine_ideas.len(),
            "first look"
        );
        let next_step = self.first_look_step(&findings);
        let left_out = format!(
            "Left out: {} people on personal addresses (gmail.com and the like), {} automated \
             senders, and anyone who only ever wrote in (newsletters, cold email). Don't look \
             them up.",
            findings.personal_left_out, findings.automated_left_out
        );
        let Findings {
            teammates,
            companies,
            waiting_on_you,
            waiting_on_them,
            meetings,
            routine_ideas,
            ..
        } = findings;
        Ok(FirstLook {
            setup_id: Self::setup_id(user),
            teammates,
            companies,
            waiting_on_you,
            waiting_on_them,
            meetings,
            routine_ideas,
            left_out,
            next_step,
        })
    }

    fn first_look_step(&self, findings: &Findings) -> String {
        let found_nothing = findings.teammates.is_empty()
            && findings.companies.is_empty()
            && findings.meetings.is_empty();
        if found_nothing {
            return "Macro found no one the person works with yet. If the inbox was connected \
                    in the last few minutes, mail is still syncing: tell the person, and call \
                    SetupFirstLook again in a few minutes."
                .to_owned();
        }
        format!(
            "Before you tell the person anything about a company, read one or two of its recent \
             threads (ListEntities with a sender filter, then GetThread) so you can say what the \
             relationship is: customer, prospect, investor, vendor or partner. Say you're not \
             sure rather than guess, and read nothing about anyone not listed here. Then, in one \
             short message, show what Macro found: the companies and what each is, who's on \
             their team, what's waiting on them and this week's meetings. Then offer these one \
             at a time, acting only on a yes and sending no email: (1) add the companies and \
             their people to Macro's CRM (CreateCompany, then CreateContact; if CRM is turned \
             off, say an admin turns it on in Settings); (2) a prep note for the next meeting \
             (CreateDocument, private to them, from the meeting's open threads and recent \
             emails with its attendees); (3) each routine idea, with its why: ListRoutines \
             first, then CreateRoutine with its name, instructions and cron in their time \
             zone; (4) for teammates not yet on their Macro team (ListTeamMembers), invite \
             them at {}; never invite anyone yourself.",
            self.link("/app/settings/team-members")
        )
    }
}
