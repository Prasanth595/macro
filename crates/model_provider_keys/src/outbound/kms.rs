#[cfg(test)]
mod test;

use std::collections::HashMap;

use cursor_api_key::cipher::KmsCiphertexts;

use crate::domain::{
    EncryptedProviderApiKey, KeyOwner, ModelProvider, ProviderApiKey, ProviderKeyCipher,
    ProviderKeyError, Result,
};

/// The encryption scheme this adapter writes.
const ENCRYPTION_VERSION: i16 = 1;

/// Name the purpose in the encryption context, so neither a Cursor key nor
/// any other feature's ciphertext decrypts as a provider key, and a team's
/// key never decrypts as a person's or the reverse.
const TEAM_ENCRYPTION_PURPOSE: &str = "team-model-provider-api-key";
const PERSONAL_ENCRYPTION_PURPOSE: &str = "personal-model-provider-api-key";

/// Direct `kms:Encrypt` under the Cursor key's CMK, as `cursor_api_key` does:
/// a provider key is far below KMS's 4 KB limit, and the services that
/// register and read provider keys are the ones already granted that CMK.
///
/// The context binds the owner (team or user) and the provider, so KMS
/// refuses a row moved to another owner or relabelled as another provider's
/// key.
pub struct KmsProviderKeyCipher<Kms> {
    kms: Kms,
}

impl<Kms> KmsProviderKeyCipher<Kms> {
    /// Encrypt and decrypt through `kms`.
    pub fn new(kms: Kms) -> Self {
        Self { kms }
    }
}

fn encryption_context(owner: &KeyOwner, provider: ModelProvider) -> HashMap<String, String> {
    let (purpose, owner_key, owner_id) = match owner {
        KeyOwner::Team(team_id) => (
            TEAM_ENCRYPTION_PURPOSE,
            "macro:team-id",
            team_id.to_string(),
        ),
        KeyOwner::User(user_id) => (
            PERSONAL_ENCRYPTION_PURPOSE,
            "macro:user-id",
            user_id.as_ref().to_owned(),
        ),
    };
    HashMap::from([
        ("macro:purpose".to_owned(), purpose.to_owned()),
        (
            "macro:encryption-version".to_owned(),
            ENCRYPTION_VERSION.to_string(),
        ),
        (owner_key.to_owned(), owner_id),
        ("macro:provider".to_owned(), provider.as_str().to_owned()),
    ])
}

#[async_trait::async_trait]
impl<Kms: KmsCiphertexts + 'static> ProviderKeyCipher for KmsProviderKeyCipher<Kms> {
    async fn encrypt(
        &self,
        owner: &KeyOwner,
        key: &ProviderApiKey,
    ) -> Result<EncryptedProviderApiKey> {
        let (key_ciphertext, kms_key_id) = self
            .kms
            .encrypt(
                encryption_context(owner, key.provider()),
                key.expose().as_bytes(),
            )
            .await
            .map_err(|_| ProviderKeyError::Cipher)?;
        Ok(EncryptedProviderApiKey {
            key_ciphertext,
            encryption_version: ENCRYPTION_VERSION,
            kms_key_id,
        })
    }

    async fn decrypt(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
        encrypted: &EncryptedProviderApiKey,
    ) -> Result<ProviderApiKey> {
        if encrypted.encryption_version != ENCRYPTION_VERSION {
            return Err(ProviderKeyError::Cipher);
        }
        let plaintext = self
            .kms
            .decrypt(
                &encrypted.kms_key_id,
                &encrypted.key_ciphertext,
                encryption_context(owner, provider),
            )
            .await
            .map_err(|_| ProviderKeyError::Cipher)?;
        let plaintext = std::str::from_utf8(&plaintext).map_err(|_| ProviderKeyError::Cipher)?;
        ProviderApiKey::parse(provider, plaintext).map_err(|_| ProviderKeyError::Cipher)
    }
}
