use std::sync::Mutex;

use entity_access::domain::models::{Entity, EntityPermission, TeamRole};
use macro_uuid::Uuid;

use super::*;
use crate::domain::models::{EncryptedProviderApiKey, StoredProviderKey};

const TEAM: &str = "00000000-0000-0000-0000-0000000000aa";

fn user() -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from("macro|member@example.com".to_owned()).expect("valid user id")
}

fn receipt<T: RequiredPermission>(role: TeamRole) -> EntityAccessReceipt<T> {
    EntityAccessReceipt::try_new_authenticated_user(
        user(),
        Entity {
            entity_id: TEAM.to_owned(),
            entity_type: EntityType::Team,
        },
        EntityPermission::TeamRole { role },
    )
    .expect("the role satisfies the requirement")
}

fn encrypted() -> EncryptedProviderApiKey {
    EncryptedProviderApiKey {
        key_ciphertext: vec![1],
        encryption_version: 1,
        kms_key_id: "kms".to_owned(),
    }
}

#[derive(Default)]
struct FakeRepo {
    stored: Mutex<Vec<(KeyOwner, ModelProvider, String)>>,
}

#[async_trait::async_trait]
impl ProviderKeyRepo for FakeRepo {
    async fn upsert(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
        _encrypted: &EncryptedProviderApiKey,
        key_prefix: &str,
    ) -> Result<ProviderKeyStatus> {
        self.stored
            .lock()
            .expect("lock")
            .push((owner.clone(), provider, key_prefix.to_owned()));
        Ok(ProviderKeyStatus {
            provider,
            updated_at: chrono::Utc::now(),
        })
    }

    async fn list(&self, _owner: &KeyOwner) -> Result<Vec<ProviderKeyStatus>> {
        Ok(Vec::new())
    }

    async fn delete(&self, _owner: &KeyOwner, _provider: ModelProvider) -> Result<bool> {
        Ok(true)
    }

    async fn usable(
        &self,
        _user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        source: KeySource,
    ) -> Result<Option<StoredProviderKey>> {
        Ok(self
            .stored
            .lock()
            .expect("lock")
            .iter()
            .find(|(owner, stored, _)| {
                *stored == provider
                    && matches!(
                        (owner, source),
                        (KeyOwner::User(_), KeySource::Personal)
                            | (KeyOwner::Team(_), KeySource::Team)
                    )
            })
            .map(|(owner, _, _)| StoredProviderKey {
                id: Uuid::nil(),
                owner: owner.clone(),
                encrypted: encrypted(),
            }))
    }

    async fn available(&self, _user: &MacroUserIdStr<'_>) -> Result<AvailableKeys> {
        Ok(AvailableKeys::default())
    }
}

#[derive(Default)]
struct FakeCipher {
    encrypted: Mutex<usize>,
    decrypted_for: Mutex<Vec<KeyOwner>>,
}

#[async_trait::async_trait]
impl ProviderKeyCipher for FakeCipher {
    async fn encrypt(
        &self,
        _owner: &KeyOwner,
        _key: &ProviderApiKey,
    ) -> Result<EncryptedProviderApiKey> {
        *self.encrypted.lock().expect("lock") += 1;
        Ok(encrypted())
    }

    async fn decrypt(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
        _encrypted: &EncryptedProviderApiKey,
    ) -> Result<ProviderApiKey> {
        self.decrypted_for.lock().expect("lock").push(owner.clone());
        let plaintext = match provider {
            ModelProvider::Anthropic => "sk-ant-api03-abc",
            ModelProvider::OpenAi => "sk-proj-abc",
        };
        ProviderApiKey::parse(provider, plaintext).map_err(|_| ProviderKeyError::Cipher)
    }
}

#[tokio::test]
async fn an_admin_registers_a_key_for_the_receipts_team_with_its_prefix() {
    let service = ProviderKeyService::new(FakeRepo::default(), FakeCipher::default());

    service
        .register_team(
            &receipt(TeamRole::Admin),
            ModelProvider::Anthropic,
            "sk-ant-api03-abc",
        )
        .await
        .expect("registered");

    assert_eq!(
        *service.repo.stored.lock().expect("lock"),
        vec![(
            KeyOwner::Team(TEAM.parse().expect("uuid")),
            ModelProvider::Anthropic,
            "sk-ant-".to_owned()
        )]
    );
}

#[tokio::test]
async fn a_person_registers_their_own_key_under_themselves() {
    let service = ProviderKeyService::new(FakeRepo::default(), FakeCipher::default());

    service
        .register_personal(&user(), ModelProvider::OpenAi, "sk-proj-abc")
        .await
        .expect("registered");

    assert_eq!(
        *service.repo.stored.lock().expect("lock"),
        vec![(
            KeyOwner::User(user()),
            ModelProvider::OpenAi,
            "sk-".to_owned()
        )]
    );
}

#[tokio::test]
async fn a_usable_key_is_decrypted_under_its_owners_context() {
    let service = ProviderKeyService::new(FakeRepo::default(), FakeCipher::default());
    service
        .register_personal(&user(), ModelProvider::Anthropic, "sk-ant-api03-abc")
        .await
        .expect("registered");

    let key = service
        .usable_key(&user(), ModelProvider::Anthropic, KeySource::Personal)
        .await
        .expect("looked up")
        .expect("the person has a key");

    assert_eq!(key.source, KeySource::Personal);
    assert_eq!(
        *service.cipher.decrypted_for.lock().expect("lock"),
        vec![KeyOwner::User(user())]
    );
    assert!(
        service
            .usable_key(&user(), ModelProvider::Anthropic, KeySource::Team)
            .await
            .expect("looked up")
            .is_none(),
        "a personal key never answers for the team"
    );
}

#[tokio::test]
async fn a_malformed_key_never_reaches_kms_or_the_table() {
    let service = ProviderKeyService::new(FakeRepo::default(), FakeCipher::default());

    let error = service
        .register_team(
            &receipt(TeamRole::Owner),
            ModelProvider::OpenAi,
            "sk-ant-api03-abc",
        )
        .await
        .expect_err("an Anthropic key is not an OpenAI key");
    assert!(matches!(error, ProviderKeyError::MalformedKey));

    let error = service
        .register_personal(&user(), ModelProvider::Anthropic, "sk-proj-abc")
        .await
        .expect_err("an OpenAI key is not an Anthropic key");
    assert!(matches!(error, ProviderKeyError::MalformedKey));

    assert_eq!(*service.cipher.encrypted.lock().expect("lock"), 0);
    assert!(service.repo.stored.lock().expect("lock").is_empty());
}

#[test]
fn a_member_cannot_hold_the_receipt_registering_needs() {
    let member_as_admin = EntityAccessReceipt::<AdminTeamRole>::try_new_authenticated_user(
        user(),
        Entity {
            entity_id: TEAM.to_owned(),
            entity_type: EntityType::Team,
        },
        EntityPermission::TeamRole {
            role: TeamRole::Member,
        },
    );
    assert!(member_as_admin.is_err());
}

#[tokio::test]
async fn a_receipt_for_anything_but_a_team_is_refused() {
    let service = ProviderKeyService::new(FakeRepo::default(), FakeCipher::default());
    let document = EntityAccessReceipt::<MemberTeamRole>::try_new_authenticated_user(
        user(),
        Entity {
            entity_id: TEAM.to_owned(),
            entity_type: EntityType::Document,
        },
        EntityPermission::TeamRole {
            role: TeamRole::Member,
        },
    )
    .expect("the role satisfies the requirement");

    assert!(matches!(
        service.list_team(&document).await,
        Err(ProviderKeyError::Forbidden)
    ));
}
