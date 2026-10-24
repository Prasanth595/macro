//! Notification sent when an agent presents drafts for the recipient to
//! approve: emails to send or calendar events to create.
use super::*;

#[cfg(test)]
mod test;

/// What submitting a review does.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AgentReviewKind {
    /// Sends the drafted emails.
    Email,
    /// Creates the drafted calendar events.
    Calendar,
}

/// An agent presented drafts that wait for the recipient to submit or dismiss
/// them. Sent to the account the drafts would act as; withdrawn once nothing
/// in the review waits for a decision.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentReviewRequestedMetadata {
    #[serde(flatten)]
    pub session: AgentSessionNotificationRef,
    /// The review awaiting a decision, within the session.
    pub review_id: Uuid,
    /// What submitting the review does.
    pub review_kind: AgentReviewKind,
    /// The review's label, as the agent wrote it.
    pub title: String,
    /// How many drafts wait for a decision.
    pub draft_count: u32,
    /// Every drafted email replies to an existing message.
    pub replies: bool,
    /// The first draft's subject or event title, when it has one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

impl Notification for AgentReviewRequestedMetadata {
    const TYPE_NAME: &'static str = "agent_review_requested";
}

impl AgentReviewRequestedMetadata {
    /// What the agent prepared, as the object of "drafted".
    fn drafted(&self) -> String {
        let (one, many) = match (self.review_kind, self.replies) {
            (AgentReviewKind::Email, true) => ("a reply", "replies"),
            (AgentReviewKind::Email, false) => ("an email", "emails"),
            (AgentReviewKind::Calendar, _) => ("an event", "events"),
        };
        if self.draft_count == 1 {
            one.to_owned()
        } else {
            format!("{} {many}", self.draft_count)
        }
    }
}

impl NotificationTitle for AgentReviewRequestedMetadata {
    fn format_title(&self, _sender_id: Option<MacroUserIdStr<'_>>) -> Result<String, Report> {
        Ok(format!(
            "{} drafted {}",
            self.session.bot_name,
            self.drafted()
        ))
    }

    fn format_body(&self, _sender_id: Option<MacroUserIdStr<'_>>) -> Result<String, Report> {
        Ok(match self.preview.as_deref().map(str::trim) {
            Some(preview) if !preview.is_empty() => agent_excerpt(preview),
            _ => agent_excerpt(&self.title),
        })
    }
}

impl NotificationExtIos for AgentReviewRequestedMetadata {
    type NotifData = PushNotificationData;

    fn collapse_key(&self, _entity: &Entity<'_>) -> NotifCollapseKey {
        NotifCollapseKey::new(Self::TYPE_NAME).append(&self.review_id.to_string())
    }

    fn as_apns<'a>(
        &self,
        sender_id: Option<MacroUserIdStr<'a>>,
        _entity: &Entity<'_>,
        notification_id: Uuid,
    ) -> Option<APNSPushNotification<Self::NotifData>> {
        agent_session_apns(self, &self.session, sender_id, notification_id)
    }
}
