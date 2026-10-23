//! Who a person corresponds with, read from their synced mail.
//!
//! Counts and timestamps only: nothing here reads a message body, so a
//! caller can rank people and threads without a model call.

use chrono::{DateTime, Utc};
use macro_user_id::user_id::MacroUserIdStr;
use uuid::Uuid;

use super::models::EmailErr;

/// Someone the person has written to, with how much mail went each way.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Correspondent {
    /// Lowercased address.
    pub email: String,
    /// Their most recent display name.
    pub name: Option<String>,
    /// Messages the person sent them (to, cc or bcc).
    pub sent: i64,
    /// Messages they sent the person.
    pub received: i64,
    /// Threads with mail either way.
    pub threads: i64,
    /// Their latest message either way.
    pub last_at: DateTime<Utc>,
}

/// Whose turn it is in a thread.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WaitingOn {
    /// The other side wrote last.
    Owner,
    /// The person wrote last.
    Others,
}

/// A recent thread waiting on a reply.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenThread {
    /// The thread.
    pub thread_id: Uuid,
    /// Its latest message's subject.
    pub subject: Option<String>,
    /// Whose turn it is.
    pub waiting_on: WaitingOn,
    /// Lowercased addresses on the other side of the latest message: its
    /// sender when the person is waited on, otherwise its recipients.
    pub with: Vec<String>,
    /// When the latest message was sent.
    pub last_at: DateTime<Utc>,
}

/// What to read, across the person's own inboxes (not delegated ones).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CorrespondenceWindow {
    /// Only mail sent at or after this.
    pub since: DateTime<Utc>,
    /// The most rows to return.
    pub limit: i64,
}

/// Correspondence read through the person's access.
pub trait EmailCorrespondence: Send + Sync + 'static {
    /// The people the person has written to in the window, most mail first.
    /// Someone who only ever wrote to the person (a newsletter, a cold
    /// email) is not a correspondent.
    fn correspondents(
        &self,
        user: MacroUserIdStr<'static>,
        window: CorrespondenceWindow,
    ) -> impl Future<Output = Result<Vec<Correspondent>, EmailErr>> + Send;

    /// Threads in the window the person took part in whose latest message
    /// is waiting on a reply: from the other side, or the person's own sent
    /// before `stale_before`. Newest first.
    fn open_threads(
        &self,
        user: MacroUserIdStr<'static>,
        window: CorrespondenceWindow,
        stale_before: DateTime<Utc>,
    ) -> impl Future<Output = Result<Vec<OpenThread>, EmailErr>> + Send;
}

/// Correspondence queries over inboxes already authorized by the service.
pub trait EmailCorrespondenceRepo: Send + Sync + 'static {
    /// See [`EmailCorrespondence::correspondents`].
    fn correspondents(
        &self,
        link_ids: &[Uuid],
        window: CorrespondenceWindow,
    ) -> impl Future<Output = Result<Vec<Correspondent>, EmailErr>> + Send;

    /// See [`EmailCorrespondence::open_threads`].
    fn open_threads(
        &self,
        link_ids: &[Uuid],
        window: CorrespondenceWindow,
        stale_before: DateTime<Utc>,
    ) -> impl Future<Output = Result<Vec<OpenThread>, EmailErr>> + Send;
}
