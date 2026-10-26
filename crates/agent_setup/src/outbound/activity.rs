//! [`SetupActivity`] over the email and calendar services.

use std::sync::Arc;

use async_trait::async_trait;
use calendar_events::domain::{
    models::{AttendeeResponseStatus, EventTime, OccurrenceRange},
    ports::CalendarRepository,
    service::CalendarService,
};
use chrono::{DateTime, Duration, Utc};
use email::domain::correspondence::{
    CorrespondenceWindow, Correspondent, EmailCorrespondence, OpenThread,
};
use macro_user_id::user_id::MacroUserIdStr;

use crate::domain::ports::{Meeting, MeetingAttendee, Result, SetupActivity, SetupError};

/// The most meetings read; a 37-day window rarely holds more.
const MEETING_LIMIT: u16 = 500;

/// The person's mail and calendar, from the services that own them.
pub struct MailAndCalendar<E, R> {
    email: Arc<E>,
    calendar: Arc<CalendarService<R>>,
}

impl<E, R> MailAndCalendar<E, R> {
    /// An adapter over the email and calendar services.
    pub fn new(email: Arc<E>, calendar: Arc<CalendarService<R>>) -> Self {
        Self { email, calendar }
    }
}

fn internal(what: &str, error: impl std::fmt::Debug) -> SetupError {
    SetupError::Internal(rootcause::report!("{what}: {error:?}"))
}

#[async_trait]
impl<E, R> SetupActivity for MailAndCalendar<E, R>
where
    E: EmailCorrespondence,
    R: CalendarRepository,
{
    async fn correspondents(
        &self,
        user: &MacroUserIdStr<'static>,
        window: CorrespondenceWindow,
    ) -> Result<Vec<Correspondent>> {
        self.email
            .correspondents(user.clone(), window)
            .await
            .map_err(|error| internal("ranking correspondents", error))
    }

    async fn open_threads(
        &self,
        user: &MacroUserIdStr<'static>,
        window: CorrespondenceWindow,
        stale_before: DateTime<Utc>,
    ) -> Result<Vec<OpenThread>> {
        self.email
            .open_threads(user.clone(), window, stale_before)
            .await
            .map_err(|error| internal("listing open threads", error))
    }

    async fn meetings(
        &self,
        user: &MacroUserIdStr<'static>,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<Meeting>> {
        let range = OccurrenceRange {
            starts_at: from,
            ends_at: to,
            start_date: from.date_naive(),
            end_date: to.date_naive() + Duration::days(1),
        };
        let listings = self
            .calendar
            .list_occurrences(user.as_ref(), range, None, MEETING_LIMIT)
            .await
            .map_err(|error| internal("listing meetings", error))?;
        Ok(listings
            .into_iter()
            .filter_map(|listing| {
                let (event, occurrence) = listing.into_occurrence_event();
                let EventTime::Timed { starts_at, .. } = occurrence.time else {
                    return None;
                };
                let declined = event.attendees.iter().any(|attendee| {
                    attendee.is_self && attendee.response_status == AttendeeResponseStatus::Declined
                });
                if occurrence.is_cancelled || declined || starts_at < from || starts_at >= to {
                    return None;
                }
                Some(Meeting {
                    title: event.title,
                    starts_at,
                    attendees: event
                        .attendees
                        .into_iter()
                        .filter(|attendee| !attendee.is_self)
                        .map(|attendee| MeetingAttendee {
                            email: attendee.email.to_lowercase(),
                            name: attendee.display_name,
                        })
                        .collect(),
                })
            })
            .collect())
    }
}
