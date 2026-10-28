use super::OriginChannelShare;
use agent_session::domain::model::AgentSessionId;
use ai_toolset::{CreatedItem, CreatedItemObserver, CreatedItemType};
use channels::domain::{
    models::{
        AttachmentEntityReference, ChannelAttachmentType, ChannelParticipant,
        ReferenceShareOutcome, ReferenceShareResult, ReferencedShareItem, ReferencedShareItemType,
    },
    ports::{
        ChannelAttachmentsPage, ChannelMessagesErr, ChannelMutationErr, ChannelPictureAccess,
        ChannelService,
    },
};
use macro_db_migrator::MACRO_DB_MIGRATIONS;
use macro_user_id::user_id::MacroUserIdStr;
use macro_uuid::Uuid;
use models_pagination::{CreatedAt, Query};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Records the grants the observer asks for.
#[derive(Default)]
struct RecordingChannels {
    shares: Mutex<Vec<(MacroUserIdStr<'static>, Uuid, Vec<ReferencedShareItem>)>>,
}

impl ChannelService for RecordingChannels {
    async fn set_channel_picture(
        &self,
        _access: ChannelPictureAccess,
        _picture_id: Option<Uuid>,
    ) -> Result<(), ChannelMutationErr> {
        unimplemented!("not used when sharing created items")
    }

    async fn get_channel_attachments(
        &self,
        _channel_id: Uuid,
        _query: Query<Uuid, CreatedAt, ()>,
        _limit: u16,
        _attachment_type: Option<ChannelAttachmentType>,
    ) -> Result<ChannelAttachmentsPage, ChannelMessagesErr> {
        unimplemented!("not used when sharing created items")
    }

    async fn get_channel_participants(
        &self,
        _channel_id: Uuid,
    ) -> Result<Vec<ChannelParticipant>, ChannelMessagesErr> {
        unimplemented!("not used when sharing created items")
    }

    async fn get_user_display_names(
        &self,
        _user_ids: Vec<MacroUserIdStr<'static>>,
    ) -> Result<HashMap<MacroUserIdStr<'static>, String>, ChannelMessagesErr> {
        unimplemented!("not used when sharing created items")
    }

    async fn get_attachment_references(
        &self,
        _entity_type: String,
        _entity_id: String,
        _user_id: String,
    ) -> Result<Vec<AttachmentEntityReference>, ChannelMessagesErr> {
        unimplemented!("not used when sharing created items")
    }

    async fn share_referenced_items_with_channel(
        &self,
        actor: MacroUserIdStr<'static>,
        channel_id: Uuid,
        items: Vec<ReferencedShareItem>,
    ) -> Result<Vec<ReferenceShareResult>, ChannelMutationErr> {
        let results = items
            .iter()
            .map(|item| ReferenceShareResult {
                entity_id: item.entity_id().to_string(),
                entity_type: item.entity_type(),
                outcome: ReferenceShareOutcome::Shared,
            })
            .collect();
        self.shares
            .lock()
            .expect("share lock")
            .push((actor, channel_id, items));
        Ok(results)
    }
}

const OWNER: &str = "macro|origin-share-owner@example.com";

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn a_document_created_in_a_channel_session_is_shared_with_that_channel(pool: PgPool) {
    let channel_id = Uuid::from_u128(0x01);
    let message_id = Uuid::from_u128(0x02);
    let session_id = AgentSessionId::new_from_uuid(Uuid::from_u128(0x03));
    sqlx::query!(
        "INSERT INTO comms_channels (id, name, channel_type, owner_id) VALUES ($1, 'launch', 'private', $2)",
        channel_id,
        OWNER,
    )
    .execute(&pool)
    .await
    .expect("create the channel");
    sqlx::query!(
        "INSERT INTO comms_messages (id, parent_entity_type, parent_entity_id, sender_id, content) VALUES ($1, 'channel', $2::uuid::text, $3, '')",
        message_id,
        channel_id,
        OWNER,
    )
    .execute(&pool)
    .await
    .expect("post the mention");
    sqlx::query!(
        "INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace, originating_message_id) VALUES ($1, $2, $3, 'test', 'macro', '/workspace', $4)",
        session_id.as_uuid(),
        OWNER,
        bot_id::MACRO_NEW_BOT_ID.as_uuid(),
        message_id,
    )
    .execute(&pool)
    .await
    .expect("open the session from the mention");
    let channels = Arc::new(RecordingChannels::default());
    let observer = OriginChannelShare::new(session_id, pool, Arc::clone(&channels));

    observer
        .created(
            &MacroUserIdStr::try_from(OWNER.to_string()).expect("owner id"),
            CreatedItem {
                id: "0199a000-0000-7000-8000-000000000004".to_string(),
                item_type: CreatedItemType::Document,
            },
        )
        .await;

    assert_eq!(
        *channels.shares.lock().expect("share lock"),
        vec![(
            MacroUserIdStr::try_from(OWNER.to_string()).expect("owner id"),
            Uuid::from_u128(0x01),
            vec![ReferencedShareItem::new(
                "0199a000-0000-7000-8000-000000000004",
                ReferencedShareItemType::Document,
            )],
        )]
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn a_database_created_in_a_channel_session_is_shared_with_that_channel(pool: PgPool) {
    let channel_id = Uuid::from_u128(0x11);
    let message_id = Uuid::from_u128(0x12);
    let session_id = AgentSessionId::new_from_uuid(Uuid::from_u128(0x13));
    sqlx::query!(
        "INSERT INTO comms_channels (id, name, channel_type, owner_id) VALUES ($1, 'launch', 'private', $2)",
        channel_id,
        OWNER,
    )
    .execute(&pool)
    .await
    .expect("create the channel");
    sqlx::query!(
        "INSERT INTO comms_messages (id, parent_entity_type, parent_entity_id, sender_id, content) VALUES ($1, 'channel', $2::uuid::text, $3, '')",
        message_id,
        channel_id,
        OWNER,
    )
    .execute(&pool)
    .await
    .expect("post the mention");
    sqlx::query!(
        "INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace, originating_message_id) VALUES ($1, $2, $3, 'test', 'macro', '/workspace', $4)",
        session_id.as_uuid(),
        OWNER,
        bot_id::MACRO_NEW_BOT_ID.as_uuid(),
        message_id,
    )
    .execute(&pool)
    .await
    .expect("open the session from the mention");
    let channels = Arc::new(RecordingChannels::default());
    let observer = OriginChannelShare::new(session_id, pool, Arc::clone(&channels));

    observer
        .created(
            &MacroUserIdStr::try_from(OWNER.to_string()).expect("owner id"),
            CreatedItem {
                id: "0199a000-0000-7000-8000-000000000014".to_string(),
                item_type: CreatedItemType::Database,
            },
        )
        .await;

    assert_eq!(
        *channels.shares.lock().expect("share lock"),
        vec![(
            MacroUserIdStr::try_from(OWNER.to_string()).expect("owner id"),
            Uuid::from_u128(0x11),
            vec![ReferencedShareItem::new(
                "0199a000-0000-7000-8000-000000000014",
                ReferencedShareItemType::Database,
            )],
        )]
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn a_session_opened_in_a_direct_message_shares_nothing(pool: PgPool) {
    let channel_id = Uuid::from_u128(0x21);
    let message_id = Uuid::from_u128(0x22);
    let session_id = AgentSessionId::new_from_uuid(Uuid::from_u128(0x23));
    sqlx::query!(
        "INSERT INTO comms_channels (id, channel_type, owner_id) VALUES ($1, 'direct_message', $2)",
        channel_id,
        OWNER,
    )
    .execute(&pool)
    .await
    .expect("create the direct message");
    sqlx::query!(
        "INSERT INTO comms_messages (id, parent_entity_type, parent_entity_id, sender_id, content) VALUES ($1, 'channel', $2::uuid::text, $3, '')",
        message_id,
        channel_id,
        OWNER,
    )
    .execute(&pool)
    .await
    .expect("post the mention");
    sqlx::query!(
        "INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace, originating_message_id) VALUES ($1, $2, $3, 'test', 'macro', '/workspace', $4)",
        session_id.as_uuid(),
        OWNER,
        bot_id::MACRO_NEW_BOT_ID.as_uuid(),
        message_id,
    )
    .execute(&pool)
    .await
    .expect("open the session from the mention");
    let channels = Arc::new(RecordingChannels::default());
    let observer = OriginChannelShare::new(session_id, pool, Arc::clone(&channels));

    observer
        .created(
            &MacroUserIdStr::try_from(OWNER.to_string()).expect("owner id"),
            CreatedItem {
                id: "0199a000-0000-7000-8000-000000000024".to_string(),
                item_type: CreatedItemType::Document,
            },
        )
        .await;

    assert_eq!(*channels.shares.lock().expect("share lock"), vec![]);
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn a_session_opened_outside_a_channel_shares_nothing(pool: PgPool) {
    let session_id = AgentSessionId::new_from_uuid(Uuid::from_u128(0x33));
    sqlx::query!(
        "INSERT INTO agent_session (id, owner_id, bot_id, model, harness, workspace) VALUES ($1, $2, $3, 'test', 'macro', '/workspace')",
        session_id.as_uuid(),
        OWNER,
        bot_id::MACRO_NEW_BOT_ID.as_uuid(),
    )
    .execute(&pool)
    .await
    .expect("open the session directly");
    let channels = Arc::new(RecordingChannels::default());
    let observer = OriginChannelShare::new(session_id, pool, Arc::clone(&channels));

    observer
        .created(
            &MacroUserIdStr::try_from(OWNER.to_string()).expect("owner id"),
            CreatedItem {
                id: "0199a000-0000-7000-8000-000000000034".to_string(),
                item_type: CreatedItemType::Document,
            },
        )
        .await;

    assert_eq!(*channels.shares.lock().expect("share lock"), vec![]);
}
