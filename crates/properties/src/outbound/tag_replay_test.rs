//! Replay and authorization regressions through the real properties domain and database.
use super::properties_pg_repo::PropertiesPgRepo;
use crate::PropertiesService;
use crate::domain::{
    error::PropertiesErr,
    model::{
        EditReceipt, EntityPropertyOptionUpdate, PropertyDefinitionOwner, TagScope,
        canonical_entity_type,
    },
    ports::{MockNotificationService, MockPermissionService, PropertiesRepo},
    service_impl::PropertiesServiceImpl,
    tag_replay::{CreateTag, TagReplayService, UpdateTag},
};
use macro_db_migrator::MACRO_DB_MIGRATIONS;
use macro_user_id::user_id::MacroUserIdStr;
use models_properties::service::property_option::PropertyOptionValue;
use models_properties::{
    EntityType, api::SetPropertyValue, service::property_value::PropertyValue,
};
use sqlx::PgPool;
use uuid::Uuid;

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("properties"))
)]
async fn lost_acknowledgement_preserves_identity_after_rename_and_delete(
    pool: PgPool,
) -> anyhow::Result<()> {
    let service = PropertiesServiceImpl::new(
        PropertiesPgRepo::new(pool.clone()),
        None::<MockPermissionService>,
        None::<MockNotificationService>,
    );
    let user = MacroUserIdStr::parse_from_str("macro|user1@test.com")?;
    let request = CreateTag {
        scope: TagScope::User,
        team_id: None,
        client_definition_id: Uuid::new_v4(),
        client_option_id: Uuid::new_v4(),
        value: "Offline label".into(),
        color: "#FF0000".into(),
    };
    let first = service.create_tag(&user, None, request.clone()).await?;
    let second = service.create_tag(&user, None, request.clone()).await?;
    assert_eq!(first.option.id, second.option.id);
    assert_ne!(first.option.id, request.client_option_id);
    assert_eq!(second.tag_set.options.len(), 1);
    let access = EditReceipt::dangerously_assert_authenticated_user(
        user.clone(),
        "offline-tag-task",
        canonical_entity_type(EntityType::Document),
    );
    // REST task creation and the GraphQL picker share these domain entry points.
    let assigned = service
        .set_entity_property(
            &access,
            request.client_definition_id,
            Some(SetPropertyValue::MultiSelectOption {
                option_ids: vec![request.client_option_id],
            }),
        )
        .await?;
    assert_eq!(assigned.definition.id, first.option.property_definition_id);
    assert_eq!(
        assigned.value,
        Some(PropertyValue::SelectOption(vec![first.option.id]))
    );
    let removed = service
        .bulk_update_entity_property_options(
            &access,
            vec![EntityPropertyOptionUpdate {
                property_definition_id: request.client_definition_id,
                add_option_ids: vec![],
                remove_option_ids: vec![request.client_option_id],
            }],
        )
        .await?;
    assert_eq!(
        removed[0].property_definition_id,
        first.option.property_definition_id
    );
    assert!(removed[0].option_ids.is_empty());
    service
        .update_tag(
            &user,
            None,
            request.client_definition_id,
            request.client_option_id,
            UpdateTag {
                value: Some("Renamed offline".into()),
                color: Some("#00FF00".into()),
            },
        )
        .await?;
    let replay = service.create_tag(&user, None, request.clone()).await?;
    assert_eq!(replay.option.id, first.option.id);
    assert_eq!(
        replay.option.value,
        PropertyOptionValue::String("Renamed offline".into())
    );
    assert_eq!(replay.option.color.as_deref(), Some("#00FF00"));
    assert_eq!(
        service
            .delete_tag(
                &user,
                None,
                request.client_definition_id,
                request.client_option_id
            )
            .await?,
        first.option.id
    );
    assert_eq!(
        service
            .delete_tag(
                &user,
                None,
                request.client_definition_id,
                request.client_option_id
            )
            .await?,
        first.option.id
    );
    assert!(matches!(
        service.create_tag(&user, None, request).await,
        Err(PropertiesErr::OptionNotFound)
    ));
    assert!(
        PropertiesPgRepo::new(pool)
            .get_property_option(first.option.id)
            .await?
            .is_none()
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("properties"))
)]
async fn client_handles_are_scoped_to_the_authenticated_user(pool: PgPool) -> anyhow::Result<()> {
    let service = PropertiesServiceImpl::new(
        PropertiesPgRepo::new(pool.clone()),
        None::<MockPermissionService>,
        None::<MockNotificationService>,
    );
    let user = MacroUserIdStr::parse_from_str("macro|user1@test.com")?;
    let other = MacroUserIdStr::parse_from_str("macro|user2@test.com")?;
    let request = CreateTag {
        scope: TagScope::User,
        team_id: None,
        client_definition_id: Uuid::new_v4(),
        client_option_id: Uuid::new_v4(),
        value: "Private".into(),
        color: "#123456".into(),
    };
    let first = service.create_tag(&user, None, request.clone()).await?;
    let second = service.create_tag(&other, None, request.clone()).await?;
    assert_ne!(first.option.id, second.option.id);
    assert_ne!(
        first.option.property_definition_id,
        second.option.property_definition_id
    );
    assert!(
        service
            .update_tag(
                &other,
                None,
                first.option.property_definition_id,
                first.option.id,
                UpdateTag {
                    value: Some("Forbidden".into()),
                    color: None
                }
            )
            .await
            .is_err()
    );
    service
        .delete_tag(
            &other,
            None,
            request.client_definition_id,
            request.client_option_id,
        )
        .await?;
    assert!(
        PropertiesPgRepo::new(pool)
            .get_property_option(first.option.id)
            .await?
            .is_some()
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("properties"))
)]
async fn concurrent_replays_commit_one_option_and_never_rebind_a_handle(
    pool: PgPool,
) -> anyhow::Result<()> {
    let repo = PropertiesPgRepo::new(pool);
    let user = MacroUserIdStr::parse_from_str("macro|user1@test.com")?;
    let definition = repo
        .get_or_create_tag_definition(PropertyDefinitionOwner::User(&user))
        .await?
        .definition
        .id;
    let client = Uuid::new_v4();
    let (left, right) = tokio::try_join!(
        repo.create_tag_option_with_client_id(
            user.as_ref(),
            client,
            definition,
            "Concurrent",
            Some("#123456")
        ),
        repo.create_tag_option_with_client_id(
            user.as_ref(),
            client,
            definition,
            "Concurrent",
            Some("#123456")
        ),
    )?;
    use crate::domain::tag_replay::CreateTagOptionOutcome;
    let (
        CreateTagOptionOutcome::Present {
            option: left,
            created: left_created,
        },
        CreateTagOptionOutcome::Present {
            option: right,
            created: right_created,
        },
    ) = (left, right)
    else {
        panic!("expected committed options");
    };
    assert_eq!(left.id, right.id);
    assert_ne!(left_created, right_created);
    assert_eq!(repo.get_property_options(definition).await?.len(), 1);
    assert!(matches!(
        repo.create_tag_option_with_client_id(user.as_ref(), client, Uuid::new_v4(), "Other", None)
            .await?,
        CreateTagOptionOutcome::DefinitionConflict
    ));
    let handle = Uuid::new_v4();
    assert_eq!(
        repo.bind_property_definition_client_id(user.as_ref(), handle, definition)
            .await?,
        definition
    );
    assert_eq!(
        repo.bind_property_definition_client_id(user.as_ref(), handle, Uuid::new_v4())
            .await?,
        definition
    );
    Ok(())
}

#[sqlx::test(
    migrator = "MACRO_DB_MIGRATIONS",
    fixtures(path = "../../fixtures", scripts("properties"))
)]
async fn queued_team_creation_cannot_move_to_a_different_team(pool: PgPool) -> anyhow::Result<()> {
    let service = PropertiesServiceImpl::new(
        PropertiesPgRepo::new(pool),
        None::<MockPermissionService>,
        None::<MockNotificationService>,
    );
    let user = MacroUserIdStr::parse_from_str("macro|user1@test.com")?;
    let error = service
        .ensure_tag_set_with_client_id(
            &user,
            None,
            TagScope::Team,
            Some(Uuid::new_v4()),
            Uuid::new_v4(),
        )
        .await;
    assert!(matches!(error, Err(PropertiesErr::PermissionDenied)));
    Ok(())
}
