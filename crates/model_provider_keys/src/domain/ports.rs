use macro_user_id::user_id::MacroUserIdStr;

use super::models::{
    AvailableKeys, EncryptedProviderApiKey, KeyOwner, KeySource, ModelProvider, ProviderApiKey,
    ProviderKeyError, ProviderKeyStatus, StoredProviderKey, UsableProviderKey,
};

/// Result alias for this crate.
pub type Result<T> = std::result::Result<T, ProviderKeyError>;

/// Encrypts a key so only its owner and provider can decrypt it.
#[async_trait::async_trait]
pub trait ProviderKeyCipher: Send + Sync + 'static {
    /// Encrypt `key` for `owner`.
    async fn encrypt(
        &self,
        owner: &KeyOwner,
        key: &ProviderApiKey,
    ) -> Result<EncryptedProviderApiKey>;

    /// Decrypt a `provider` key that belongs to `owner`.
    async fn decrypt(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
        encrypted: &EncryptedProviderApiKey,
    ) -> Result<ProviderApiKey>;
}

/// Where provider keys are stored. Never decrypts.
#[async_trait::async_trait]
pub trait ProviderKeyRepo: Send + Sync + 'static {
    /// Register or replace `owner`'s key for `provider`.
    async fn upsert(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
        encrypted: &EncryptedProviderApiKey,
        key_prefix: &str,
    ) -> Result<ProviderKeyStatus>;

    /// The providers `owner` has a key for.
    async fn list(&self, owner: &KeyOwner) -> Result<Vec<ProviderKeyStatus>>;

    /// Forget `owner`'s key for `provider`, reporting whether there was one.
    async fn delete(&self, owner: &KeyOwner, provider: ModelProvider) -> Result<bool>;

    /// The `provider` key `user` may use from `source`: their own, or that of
    /// a team they are currently a member of.
    async fn usable(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        source: KeySource,
    ) -> Result<Option<StoredProviderKey>>;

    /// The providers `user` has their own key for, and those the teams they
    /// are currently a member of have keys for.
    async fn available(&self, user: &MacroUserIdStr<'_>) -> Result<AvailableKeys>;
}

/// What AI chat asks before running a turn on a provider key.
///
/// Every answer reflects current team membership: a user removed from the
/// team gets no team key on their next turn.
#[async_trait::async_trait]
pub trait ModelKeys: Send + Sync + 'static {
    /// The `provider` key from `source` that `user` may run a turn on,
    /// decrypted.
    async fn usable_key(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        source: KeySource,
    ) -> Result<Option<UsableProviderKey>>;

    /// The providers `user` has a key for, by source, without decrypting
    /// anything.
    async fn available(&self, user: &MacroUserIdStr<'_>) -> Result<AvailableKeys>;
}

/// A deployment with no provider keys: every turn runs on Macro's allowance.
#[derive(Debug, Clone, Copy, Default)]
pub struct NoModelKeys;

#[async_trait::async_trait]
impl ModelKeys for NoModelKeys {
    async fn usable_key(
        &self,
        _user: &MacroUserIdStr<'_>,
        _provider: ModelProvider,
        _source: KeySource,
    ) -> Result<Option<UsableProviderKey>> {
        Ok(None)
    }

    async fn available(&self, _user: &MacroUserIdStr<'_>) -> Result<AvailableKeys> {
        Ok(AvailableKeys::default())
    }
}
