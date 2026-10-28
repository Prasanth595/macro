//! Shares what a session's tools create with the channel it was opened from.
//!
//! Linking an item in a channel does not let the channel open it. A session
//! opened by a mention in a channel shares each item its tools create there,
//! as a view grant, the same one posting the item's link would write. Only
//! fresh items: an item that existed before the call is shared only when
//! someone asks. Direct messages, and sessions opened anywhere else, share
//! nothing.

use agent_session::domain::model::AgentSessionId;
use ai_toolset::{CreatedItem, CreatedItemObserver, CreatedItemType};
use anyhow::Context;
use channels::domain::{
    models::{ReferenceShareOutcome, ReferencedShareItem, ReferencedShareItemType},
    ports::ChannelService,
};
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use sqlx::PgPool;
use std::sync::Arc;

#[cfg(test)]
mod test;

/// [`CreatedItemObserver`] that shares each created item with the channel the
/// session's invoking message sits in.
pub struct OriginChannelShare<Channels> {
    session_id: AgentSessionId,
    db: PgPool,
    channels: Arc<Channels>,
}

impl<Channels> std::fmt::Debug for OriginChannelShare<Channels> {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("OriginChannelShare")
            .field("session_id", &self.session_id)
            .finish_non_exhaustive()
    }
}

impl<Channels: ChannelService> OriginChannelShare<Channels> {
    /// Share the items `session_id`'s tools create, reading its origin from
    /// `db` and writing grants through `channels`.
    pub fn new(session_id: AgentSessionId, db: PgPool, channels: Arc<Channels>) -> Self {
        Self {
            session_id,
            db,
            channels,
        }
    }

    /// The non-DM channel whose message opened the session, if one did.
    async fn origin_channel(&self) -> anyhow::Result<Option<Uuid>> {
        sqlx::query_scalar!(
            r#"SELECT channel.id
               FROM agent_session session
               JOIN comms_messages message
                 ON message.id = session.originating_message_id
                AND message.parent_entity_type = 'channel'
               JOIN comms_channels channel ON channel.id = message.parent_entity_id::uuid
               WHERE session.id = $1
                 AND channel.channel_type <> 'direct_message'"#,
            self.session_id.as_uuid(),
        )
        .fetch_optional(&self.db)
        .await
        .context("failed to read the channel a session was opened from")
    }

    async fn share(
        &self,
        user: &MacroUserIdStr<'static>,
        item: CreatedItem,
    ) -> anyhow::Result<Option<ReferenceShareOutcome>> {
        let Some(channel_id) = self.origin_channel().await? else {
            return Ok(None);
        };
        tracing::Span::current().record("channel_id", tracing::field::display(channel_id));
        let item_type = match item.item_type {
            CreatedItemType::Document => ReferencedShareItemType::Document,
            CreatedItemType::Database => ReferencedShareItemType::Database,
        };
        let results = self
            .channels
            .share_referenced_items_with_channel(
                user.clone(),
                channel_id,
                vec![ReferencedShareItem::new(item.id, item_type)],
            )
            .await
            .context("failed to share a created item with the session's channel")?;
        Ok(results.into_iter().next().map(|result| result.outcome))
    }
}

#[async_trait::async_trait]
impl<Channels: ChannelService> CreatedItemObserver for OriginChannelShare<Channels> {
    #[tracing::instrument(
        name = "agent_session.share_created_item",
        skip_all,
        fields(
            agent_session_id = %self.session_id,
            entity_id = %item.id,
            entity_type = ?item.item_type,
            channel_id = tracing::field::Empty,
            outcome = tracing::field::Empty,
        )
    )]
    async fn created(&self, user: &MacroUserIdStr<'static>, item: CreatedItem) {
        match self.share(user, item).await {
            Ok(outcome) => {
                tracing::Span::current().record("outcome", tracing::field::debug(outcome));
            }
            Err(error) => {
                tracing::warn!(error = ?error, "the created item was not shared with the session's channel");
            }
        }
    }
}
