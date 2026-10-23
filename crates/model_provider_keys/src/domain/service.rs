#[cfg(test)]
mod test;

use entity_access::domain::models::{
    AdminTeamRole, EntityAccessReceipt, EntityType, MemberTeamRole, RequiredPermission,
};
use macro_user_id::{cowlike::CowLike, user_id::MacroUserIdStr};

use super::models::{
    AvailableKeys, KeyOwner, KeySource, ModelProvider, ProviderApiKey, ProviderKeyError,
    ProviderKeyStatus, UsableProviderKey,
};
use super::ports::{ModelKeys, ProviderKeyCipher, ProviderKeyRepo, Result};

/// Registering, listing and using provider keys.
///
/// A person manages their own keys. For a team's, members can see which
/// providers have a key and run turns on them; only admins and the owner can
/// register or remove one. Both team rules come from the receipt's type,
/// minted by the team access extractor.
pub struct ProviderKeyService<Repo, Cipher> {
    repo: Repo,
    cipher: Cipher,
}

impl<Repo, Cipher> ProviderKeyService<Repo, Cipher> {
    /// Store keys in `repo`, encrypted with `cipher`.
    pub fn new(repo: Repo, cipher: Cipher) -> Self {
        Self { repo, cipher }
    }
}

impl<Repo: ProviderKeyRepo, Cipher: ProviderKeyCipher> ProviderKeyService<Repo, Cipher> {
    /// Which providers the caller's team has a key for.
    pub async fn list_team(
        &self,
        team: &EntityAccessReceipt<MemberTeamRole>,
    ) -> Result<Vec<ProviderKeyStatus>> {
        self.repo.list(&team_owner(team)?).await
    }

    /// Register or replace the team's key for `provider`, returning every
    /// provider the team now has a key for.
    pub async fn register_team(
        &self,
        team: &EntityAccessReceipt<AdminTeamRole>,
        provider: ModelProvider,
        supplied: &str,
    ) -> Result<Vec<ProviderKeyStatus>> {
        self.register(&team_owner(team)?, provider, supplied).await
    }

    /// Forget the team's key for `provider`, returning the providers that
    /// still have one. Does not revoke the key at the provider.
    pub async fn remove_team(
        &self,
        team: &EntityAccessReceipt<AdminTeamRole>,
        provider: ModelProvider,
    ) -> Result<Vec<ProviderKeyStatus>> {
        self.remove(&team_owner(team)?, provider).await
    }

    /// Which providers `user` has their own key for.
    pub async fn list_personal(&self, user: &MacroUserIdStr<'_>) -> Result<Vec<ProviderKeyStatus>> {
        self.repo.list(&user_owner(user)).await
    }

    /// Register or replace `user`'s own key for `provider`, returning every
    /// provider they now have a key for.
    pub async fn register_personal(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        supplied: &str,
    ) -> Result<Vec<ProviderKeyStatus>> {
        self.register(&user_owner(user), provider, supplied).await
    }

    /// Forget `user`'s own key for `provider`, returning the providers that
    /// still have one. Does not revoke the key at the provider.
    pub async fn remove_personal(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
    ) -> Result<Vec<ProviderKeyStatus>> {
        self.remove(&user_owner(user), provider).await
    }

    /// The key is parsed before anything else, so a malformed value never
    /// reaches KMS or the table.
    async fn register(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
        supplied: &str,
    ) -> Result<Vec<ProviderKeyStatus>> {
        let key = ProviderApiKey::parse(provider, supplied)
            .map_err(|_| ProviderKeyError::MalformedKey)?;
        let encrypted = self.cipher.encrypt(owner, &key).await?;
        self.repo
            .upsert(owner, provider, &encrypted, key.prefix())
            .await?;
        self.repo.list(owner).await
    }

    async fn remove(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
    ) -> Result<Vec<ProviderKeyStatus>> {
        self.repo.delete(owner, provider).await?;
        self.repo.list(owner).await
    }
}

#[async_trait::async_trait]
impl<Repo: ProviderKeyRepo, Cipher: ProviderKeyCipher> ModelKeys
    for ProviderKeyService<Repo, Cipher>
{
    async fn usable_key(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        source: KeySource,
    ) -> Result<Option<UsableProviderKey>> {
        let Some(stored) = self.repo.usable(user, provider, source).await? else {
            return Ok(None);
        };
        let key = self
            .cipher
            .decrypt(&stored.owner, provider, &stored.encrypted)
            .await?;
        Ok(Some(UsableProviderKey {
            id: stored.id,
            source,
            key,
        }))
    }

    async fn available(&self, user: &MacroUserIdStr<'_>) -> Result<AvailableKeys> {
        self.repo.available(user).await
    }
}

fn user_owner(user: &MacroUserIdStr<'_>) -> KeyOwner {
    KeyOwner::User(user.clone().into_owned())
}

fn team_owner<T: RequiredPermission>(receipt: &EntityAccessReceipt<T>) -> Result<KeyOwner> {
    let entity = receipt.entity();
    if entity.entity_type != EntityType::Team {
        return Err(ProviderKeyError::Forbidden);
    }
    entity
        .entity_id
        .parse()
        .map(KeyOwner::Team)
        .map_err(|_| ProviderKeyError::Forbidden)
}
