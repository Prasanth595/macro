//! Tell a review's account holder about it in their notifications inbox.
//!
//! Sent through the same ingress queue every producer uses, under an id
//! derived from the review, so a retried presentation creates nothing new and
//! the retraction names the notification without looking it up. Withdrawal
//! keeps a send still queued from landing after the review was decided.
//! Delivery waits on the account holder's `enable-unified-notifications` flag;
//! retraction does not, so a notification sent before the flag was turned off
//! still clears.

use agent_code_mode::domain::reviews::{
    ReviewItemStatus, ReviewKind, ReviewNotifier, ReviewRecord,
};
use agent_harness::domain::notifications::session_ref;
use agent_session::domain::{lifecycle::session_identity, ports::AgentSessionRepo};
use async_trait::async_trait;
use feature_flags::FeatureFlags;
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use model_entity::EntityType;
use model_notifications::{
    AgentReviewKind, AgentReviewRequestedMetadata, AgentSessionNotificationRef,
};
use notification::domain::{
    models::{
        SendNotificationRequestBuilder,
        request::{NotificationStatus, UpdateNotificationsRequest},
    },
    ports::NotificationWithdrawal,
    service::{NotificationIngress, NotificationReader},
};
use serde_json::Value;
use std::{collections::HashSet, sync::Arc};

#[cfg(test)]
mod test;

/// The PostHog key the web app's unified notifications inbox shares.
pub const UNIFIED_NOTIFICATIONS: &str = "enable-unified-notifications";

/// Fixed forever: changing it orphans the retraction of every review
/// notification created before the change.
const NOTIFICATION_ID_NAMESPACE: Uuid = Uuid::from_u128(0x6167_656e_742d_7265_7669_6577_2d6e_6f74);

/// Most characters of a draft's subject or event title a notification carries.
const PREVIEW_MAX_CHARS: usize = 140;

/// [`ReviewNotifier`] over the notification ingress, reader and withdrawal.
pub struct InboxReviewNotifier<S, I, R, W, F> {
    pub sessions: S,
    pub ingress: Arc<I>,
    pub reader: Arc<R>,
    pub withdrawal: Arc<W>,
    /// `None` where no flag provider is configured, which delivers nothing.
    pub flags: Option<F>,
}

/// The id of `record`'s inbox notification.
pub fn notification_id(record: &ReviewRecord) -> Uuid {
    Uuid::new_v5(
        &NOTIFICATION_ID_NAMESPACE,
        format!("agent_review_requested:{}", record.id.0).as_bytes(),
    )
}

/// The inbox kind of a review of `kind` and the draft field it previews.
/// Only drafted emails and events are AI suggestions; an import plan is
/// approved where it was staged and never reaches the inbox.
fn inbox_kind(kind: ReviewKind) -> Option<(AgentReviewKind, &'static str)> {
    match kind {
        ReviewKind::Email => Some((AgentReviewKind::Email, "subject")),
        ReviewKind::Calendar => Some((AgentReviewKind::Calendar, "title")),
        ReviewKind::Import => None,
    }
}

/// The inbox's account of `record`: its drafts still awaiting a decision.
/// `None` for reviews the inbox does not list.
pub fn requested(
    session: AgentSessionNotificationRef,
    record: &ReviewRecord,
) -> Option<AgentReviewRequestedMetadata> {
    let (review_kind, preview_field) = inbox_kind(record.kind)?;
    let awaiting: Vec<&Value> = record
        .items
        .iter()
        .filter(|item| item.status == ReviewItemStatus::Pending)
        .map(|item| &item.draft)
        .collect();
    Some(AgentReviewRequestedMetadata {
        session,
        review_id: record.id.0,
        review_kind,
        title: record.title.clone(),
        draft_count: u32::try_from(awaiting.len()).unwrap_or(u32::MAX),
        replies: review_kind == AgentReviewKind::Email
            && !awaiting.is_empty()
            && awaiting
                .iter()
                .all(|draft| draft.get("replyingToId").is_some_and(|id| !id.is_null())),
        preview: awaiting
            .first()
            .and_then(|draft| draft.get(preview_field))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|preview| !preview.is_empty())
            .map(|preview| preview.chars().take(PREVIEW_MAX_CHARS).collect()),
    })
}

impl<S, I, R, W, F> InboxReviewNotifier<S, I, R, W, F>
where
    S: AgentSessionRepo,
    I: NotificationIngress,
    F: FeatureFlags,
{
    async fn delivers_to(&self, account_holder: &MacroUserIdStr<'static>) -> bool {
        let Some(flags) = &self.flags else {
            return false;
        };
        match flags.load(account_holder).await {
            Ok(flags) => flags.is_enabled(UNIFIED_NOTIFICATIONS),
            Err(error) => {
                tracing::warn!(
                    ?error,
                    "feature flags unavailable; not notifying about a review"
                );
                false
            }
        }
    }

    /// Queue the inbox notification for `record`, when its account holder has
    /// the inbox.
    #[tracing::instrument(skip_all, fields(review_id = %record.id.0, session_id = %record.session_id))]
    pub async fn announce(&self, account_holder: &MacroUserIdStr<'static>, record: &ReviewRecord) {
        if inbox_kind(record.kind).is_none() || !self.delivers_to(account_holder).await {
            return;
        }
        let session = match self.sessions.get(record.session_id).await {
            Ok(session) => session,
            Err(error) => {
                tracing::warn!(
                    ?error,
                    "could not read a review's session to notify about it"
                );
                return;
            }
        };
        let identity = match self
            .sessions
            .session_bot(session.bot_id)
            .await
            .and_then(|bot| session_identity(&session, &bot, Vec::new()))
        {
            Ok(identity) => identity,
            Err(error) => {
                tracing::warn!(
                    ?error,
                    "could not describe a review's session to notify about it"
                );
                return;
            }
        };
        let Some(notification) = requested(session_ref(&identity, None), record) else {
            return;
        };
        let request = SendNotificationRequestBuilder {
            notification_entity: EntityType::AgentSession
                .with_entity_string(record.session_id.to_string()),
            secondary_notification_entity: None,
            notification,
            // A bot is not a user: the kind's own title names it.
            sender_id: None,
            recipient_ids: HashSet::from([account_holder.clone()]),
        }
        .into_request_with_id(notification_id(record))
        .with_apns()
        .with_conn_gateway();
        if let Err(error) = self.ingress.send_notification(request).await {
            tracing::warn!(?error, "failed to enqueue a review notification");
        }
    }
}

impl<S, I, R, W, F> InboxReviewNotifier<S, I, R, W, F>
where
    R: NotificationReader,
    W: NotificationWithdrawal,
{
    /// Withdraw `record`'s inbox notification and mark it done. A review the
    /// inbox does not list had none, so it leaves no withdrawal behind.
    #[tracing::instrument(skip_all, fields(review_id = %record.id.0, session_id = %record.session_id))]
    pub async fn retract(&self, account_holder: &MacroUserIdStr<'static>, record: &ReviewRecord) {
        if inbox_kind(record.kind).is_none() {
            return;
        }
        let id = notification_id(record);
        if let Err(error) = self.withdrawal.withdraw(id).await {
            tracing::warn!(?error, "failed to withdraw a review notification");
        }
        if let Err(error) = self
            .reader
            .update_notifications(UpdateNotificationsRequest {
                user_id: account_holder.clone(),
                notification_ids: &[id],
                status: NotificationStatus::Done(true),
            })
            .await
        {
            tracing::warn!(?error, "failed to mark a review notification done");
        }
    }
}

#[async_trait]
impl<S, I, R, W, F> ReviewNotifier for InboxReviewNotifier<S, I, R, W, F>
where
    S: AgentSessionRepo,
    I: NotificationIngress,
    R: NotificationReader,
    W: NotificationWithdrawal,
    F: FeatureFlags + 'static,
{
    async fn awaiting(&self, account_holder: &MacroUserIdStr<'static>, record: &ReviewRecord) {
        self.announce(account_holder, record).await;
    }

    async fn resolved(&self, account_holder: &MacroUserIdStr<'static>, record: &ReviewRecord) {
        self.retract(account_holder, record).await;
    }
}
