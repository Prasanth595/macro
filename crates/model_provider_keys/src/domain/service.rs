#[cfg(test)]
mod test;

use entity_access::domain::models::{
    AdminTeamRole, EntityAccessReceipt, EntityType, MemberTeamRole, RequiredPermission,
};
use macro_user_id::{cowlike::CowLike, user_id::MacroUserIdStr};

use super::models::{
    AvailableKeys, KeyOwner, KeySource, ModelProvider, ProviderApiKey, ProviderKeyError,
    ProviderKeyList, UsableProviderKey,
};
use super::ports::{KeyPlans, ModelKeys, ProviderKeyCipher, ProviderKeyRepo, Result};

/// Registering, listing and using provider keys.
///
/// A person manages their own keys. For a team's, members can see which
/// providers have a key and run turns on them; only admins and the owner can
/// register or remove one. Both team rules come from the receipt's type,
/// minted by the team access extractor.
///
/// Keys are a paid-plan feature: saving one and running turns on one both
/// need the person's plan to include them. A key saved before a downgrade is
/// kept, listed and removable, but no turn runs on it.
pub struct ProviderKeyService<Repo, Cipher, Plans> {
    repo: Repo,
    cipher: Cipher,
    plans: Plans,
}

impl<Repo, Cipher, Plans> ProviderKeyService<Repo, Cipher, Plans> {
    /// Store keys in `repo`, encrypted with `cipher`, for people `plans`
    /// allows.
    pub fn new(repo: Repo, cipher: Cipher, plans: Plans) -> Self {
        Self {
            repo,
            cipher,
            plans,
        }
    }
}

impl<Repo: ProviderKeyRepo, Cipher: ProviderKeyCipher, Plans: KeyPlans>
    ProviderKeyService<Repo, Cipher, Plans>
{
    /// Which providers the caller's team has a key for.
    pub async fn list_team(
        &self,
        team: &EntityAccessReceipt<MemberTeamRole>,
    ) -> Result<ProviderKeyList> {
        self.list(&team_owner(team)?, receipt_user(team)?).await
    }

    /// Register or replace the team's key for `provider`, returning every
    /// provider the team now has a key for.
    pub async fn register_team(
        &self,
        team: &EntityAccessReceipt<AdminTeamRole>,
        provider: ModelProvider,
        supplied: &str,
    ) -> Result<ProviderKeyList> {
        self.register(&team_owner(team)?, receipt_user(team)?, provider, supplied)
            .await
    }

    /// Forget the team's key for `provider`, returning the providers that
    /// still have one. Does not revoke the key at the provider.
    pub async fn remove_team(
        &self,
        team: &EntityAccessReceipt<AdminTeamRole>,
        provider: ModelProvider,
    ) -> Result<ProviderKeyList> {
        self.remove(&team_owner(team)?, receipt_user(team)?, provider)
            .await
    }

    /// Which providers `user` has their own key for.
    pub async fn list_personal(&self, user: &MacroUserIdStr<'_>) -> Result<ProviderKeyList> {
        self.list(&user_owner(user), user).await
    }

    /// Register or replace `user`'s own key for `provider`, returning every
    /// provider they now have a key for.
    pub async fn register_personal(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        supplied: &str,
    ) -> Result<ProviderKeyList> {
        self.register(&user_owner(user), user, provider, supplied)
            .await
    }

    /// Forget `user`'s own key for `provider`, returning the providers that
    /// still have one. Does not revoke the key at the provider.
    pub async fn remove_personal(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
    ) -> Result<ProviderKeyList> {
        self.remove(&user_owner(user), user, provider).await
    }

    async fn list(&self, owner: &KeyOwner, viewer: &MacroUserIdStr<'_>) -> Result<ProviderKeyList> {
        Ok(ProviderKeyList {
            keys: self.repo.list(owner).await?,
            usable: self.plans.allows_keys(viewer).await?,
        })
    }

    /// The key is parsed before anything else, so a malformed value never
    /// reaches KMS or the table.
    async fn register(
        &self,
        owner: &KeyOwner,
        actor: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        supplied: &str,
    ) -> Result<ProviderKeyList> {
        let key = ProviderApiKey::parse(provider, supplied)
            .map_err(|_| ProviderKeyError::MalformedKey)?;
        if !self.plans.allows_keys(actor).await? {
            return Err(ProviderKeyError::PlanRequired);
        }
        let encrypted = self.cipher.encrypt(owner, &key).await?;
        self.repo
            .upsert(owner, provider, &encrypted, key.prefix())
            .await?;
        self.list(owner, actor).await
    }

    async fn remove(
        &self,
        owner: &KeyOwner,
        actor: &MacroUserIdStr<'_>,
        provider: ModelProvider,
    ) -> Result<ProviderKeyList> {
        self.repo.delete(owner, provider).await?;
        self.list(owner, actor).await
    }
}

#[async_trait::async_trait]
impl<Repo: ProviderKeyRepo, Cipher: ProviderKeyCipher, Plans: KeyPlans> ModelKeys
    for ProviderKeyService<Repo, Cipher, Plans>
{
    async fn usable_key(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        source: KeySource,
    ) -> Result<Option<UsableProviderKey>> {
        if !self.plans.allows_keys(user).await? {
            return Ok(None);
        }
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
        if !self.plans.allows_keys(user).await? {
            return Ok(AvailableKeys::default());
        }
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

fn receipt_user<T: RequiredPermission>(
    receipt: &EntityAccessReceipt<T>,
) -> Result<&MacroUserIdStr<'static>> {
    receipt
        .get_authenticated_user()
        .map_err(|_| ProviderKeyError::Forbidden)
}
