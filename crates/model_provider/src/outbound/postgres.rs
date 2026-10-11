//! Compare-and-swap persistence with workspace-bound authenticated encryption.
use crate::domain::{models::*, ports::ProviderStore};
use aes_gcm::{
    Aes256Gcm,
    aead::{Aead, AeadCore, KeyInit, OsRng, Payload},
};
use async_trait::async_trait;
use sqlx::PgPool;

/// Encrypted configuration repository. The existing credential key is supplied by the host.
pub struct PgProviderStore {
    pool: PgPool,
    cipher: Aes256Gcm,
}
impl PgProviderStore {
    /// Bind a pool and validated 32-byte credential encryption key.
    pub fn new(pool: PgPool, key: &[u8; 32]) -> Self {
        Self {
            pool,
            cipher: Aes256Gcm::new(key.into()),
        }
    }
    fn encrypt(&self, scope: &str, settings: &Settings) -> Result<Vec<u8>, ProviderError> {
        let data = serde_json::to_vec(settings).map_err(|_| ProviderError::Encryption)?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = self
            .cipher
            .encrypt(
                &nonce,
                Payload {
                    msg: &data,
                    aad: scope.as_bytes(),
                },
            )
            .map_err(|_| ProviderError::Encryption)?;
        Ok([&nonce[..], &ciphertext].concat())
    }
    fn decrypt(&self, scope: &str, data: &[u8]) -> Result<Settings, ProviderError> {
        if data.len() <= 12 {
            return Err(ProviderError::Encryption);
        }
        let nonce: &[u8; 12] = data[..12]
            .try_into()
            .map_err(|_| ProviderError::Encryption)?;
        let plaintext = self
            .cipher
            .decrypt(
                nonce.into(),
                Payload {
                    msg: &data[12..],
                    aad: scope.as_bytes(),
                },
            )
            .map_err(|_| ProviderError::Encryption)?;
        serde_json::from_slice(&plaintext).map_err(|_| ProviderError::Encryption)
    }
}
impl From<sqlx::Error> for ProviderError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(Box::new(error))
    }
}
#[async_trait]
impl ProviderStore for PgProviderStore {
    async fn load(&self, workspace: &Workspace) -> Result<Settings, ProviderError> {
        let key = workspace.key();
        let row = sqlx::query!(
            "SELECT revision, configuration FROM workspace_ai_providers WHERE workspace_id = $1",
            key
        )
        .fetch_optional(&self.pool)
        .await?;
        match row {
            None => Ok(Settings::default()),
            Some(row) => {
                let mut settings = self.decrypt(&key, &row.configuration)?;
                settings.revision = row.revision;
                Ok(settings)
            }
        }
    }
    async fn save(&self, workspace: &Workspace, settings: &Settings) -> Result<i64, ProviderError> {
        let key = workspace.key();
        let (user, team) = match workspace {
            Workspace::Personal(user) => (Some(user.as_ref()), None),
            Workspace::Team(team) => (None, Some(*team)),
        };
        let data = self.encrypt(&key, settings)?;
        // The expected revision guards both initial inserts and updates; a stale
        // request cannot recreate or overwrite another editor's configuration.
        let revision = sqlx::query_scalar!(
            r#"INSERT INTO workspace_ai_providers (workspace_id, user_id, team_id, revision, configuration)
               SELECT $1, $2, $3, 1, $4 WHERE $5::BIGINT = 0
               ON CONFLICT (workspace_id) DO NOTHING RETURNING revision"#,
            key, user, team, data, settings.revision
        ).fetch_optional(&self.pool).await?;
        if let Some(revision) = revision {
            return Ok(revision);
        }
        sqlx::query_scalar!(
            r#"UPDATE workspace_ai_providers SET configuration = $2, revision = revision + 1, updated_at = NOW()
               WHERE workspace_id = $1 AND revision = $3 RETURNING revision"#,
            key, data, settings.revision
        ).fetch_optional(&self.pool).await?.ok_or(ProviderError::Conflict)
    }
}

#[cfg(test)]
mod test;
