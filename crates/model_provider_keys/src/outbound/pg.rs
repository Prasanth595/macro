#[cfg(test)]
mod test;

use macro_user_id::{cowlike::CowLike, user_id::MacroUserIdStr};
use sqlx::PgPool;

use crate::domain::{
    AvailableKeys, EncryptedProviderApiKey, KeyOwner, KeySource, ModelProvider, ProviderKeyError,
    ProviderKeyRepo, ProviderKeyStatus, Result, StoredProviderKey,
};

/// Provider keys in `cursor_configs`: one row per owner (a user or a team)
/// and provider, beside users' Cursor rows.
#[derive(Clone)]
pub struct PgProviderKeyRepo {
    pool: PgPool,
}

impl PgProviderKeyRepo {
    /// Read and write keys through `pool`.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn storage(error: sqlx::Error) -> ProviderKeyError {
    ProviderKeyError::Storage(error.into())
}

fn provider(stored: &str) -> Result<ModelProvider> {
    ModelProvider::parse(stored)
        .ok_or_else(|| ProviderKeyError::Storage(anyhow::anyhow!("unknown provider {stored:?}")))
}

fn encrypted(
    key_ciphertext: Vec<u8>,
    encryption_version: i16,
    kms_key_id: String,
) -> EncryptedProviderApiKey {
    EncryptedProviderApiKey {
        key_ciphertext,
        encryption_version,
        kms_key_id,
    }
}

#[async_trait::async_trait]
impl ProviderKeyRepo for PgProviderKeyRepo {
    async fn upsert(
        &self,
        owner: &KeyOwner,
        provider: ModelProvider,
        encrypted: &EncryptedProviderApiKey,
        key_prefix: &str,
    ) -> Result<ProviderKeyStatus> {
        let updated_at = match owner {
            KeyOwner::Team(team_id) => {
                sqlx::query_scalar!(
                    r#"
                INSERT INTO cursor_configs (
                    team_id, provider, key_ciphertext, encryption_version, kms_key_id, key_prefix
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (team_id, provider) DO UPDATE SET
                    key_ciphertext     = EXCLUDED.key_ciphertext,
                    encryption_version = EXCLUDED.encryption_version,
                    kms_key_id         = EXCLUDED.kms_key_id,
                    key_prefix         = EXCLUDED.key_prefix,
                    updated_at         = NOW()
                RETURNING updated_at
                "#,
                    team_id,
                    provider.as_str(),
                    &encrypted.key_ciphertext,
                    encrypted.encryption_version,
                    encrypted.kms_key_id,
                    key_prefix,
                )
                .fetch_one(&self.pool)
                .await
            }
            KeyOwner::User(user_id) => {
                sqlx::query_scalar!(
                    r#"
                INSERT INTO cursor_configs (
                    user_id, provider, key_ciphertext, encryption_version, kms_key_id, key_prefix
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id, provider) DO UPDATE SET
                    key_ciphertext     = EXCLUDED.key_ciphertext,
                    encryption_version = EXCLUDED.encryption_version,
                    kms_key_id         = EXCLUDED.kms_key_id,
                    key_prefix         = EXCLUDED.key_prefix,
                    updated_at         = NOW()
                RETURNING updated_at
                "#,
                    user_id.as_ref(),
                    provider.as_str(),
                    &encrypted.key_ciphertext,
                    encrypted.encryption_version,
                    encrypted.kms_key_id,
                    key_prefix,
                )
                .fetch_one(&self.pool)
                .await
            }
        }
        .map_err(storage)?;
        Ok(ProviderKeyStatus {
            provider,
            updated_at,
        })
    }

    async fn list(&self, owner: &KeyOwner) -> Result<Vec<ProviderKeyStatus>> {
        let rows = match owner {
            KeyOwner::Team(team_id) => {
                sqlx::query_as!(
                    StatusRow,
                    r#"
                SELECT provider, updated_at
                FROM cursor_configs
                WHERE team_id = $1
                ORDER BY provider
                "#,
                    team_id,
                )
                .fetch_all(&self.pool)
                .await
            }
            KeyOwner::User(user_id) => {
                sqlx::query_as!(
                    StatusRow,
                    r#"
                SELECT provider, updated_at
                FROM cursor_configs
                WHERE user_id = $1 AND provider <> 'cursor'
                ORDER BY provider
                "#,
                    user_id.as_ref(),
                )
                .fetch_all(&self.pool)
                .await
            }
        }
        .map_err(storage)?;
        rows.into_iter()
            .map(|row| {
                Ok(ProviderKeyStatus {
                    provider: provider(&row.provider)?,
                    updated_at: row.updated_at,
                })
            })
            .collect()
    }

    async fn delete(&self, owner: &KeyOwner, provider: ModelProvider) -> Result<bool> {
        let result = match owner {
            KeyOwner::Team(team_id) => {
                sqlx::query!(
                    "DELETE FROM cursor_configs WHERE team_id = $1 AND provider = $2",
                    team_id,
                    provider.as_str(),
                )
                .execute(&self.pool)
                .await
            }
            KeyOwner::User(user_id) => {
                sqlx::query!(
                    "DELETE FROM cursor_configs WHERE user_id = $1 AND provider = $2",
                    user_id.as_ref(),
                    provider.as_str(),
                )
                .execute(&self.pool)
                .await
            }
        }
        .map_err(storage)?;
        Ok(result.rows_affected() > 0)
    }

    async fn usable(
        &self,
        user: &MacroUserIdStr<'_>,
        provider: ModelProvider,
        source: KeySource,
    ) -> Result<Option<StoredProviderKey>> {
        match source {
            KeySource::Personal => {
                let row = sqlx::query!(
                    r#"
                    SELECT id, key_ciphertext, encryption_version, kms_key_id
                    FROM cursor_configs
                    WHERE user_id = $1 AND provider = $2
                    "#,
                    user.as_ref(),
                    provider.as_str(),
                )
                .fetch_optional(&self.pool)
                .await
                .map_err(storage)?;
                Ok(row.map(|row| StoredProviderKey {
                    id: row.id,
                    owner: KeyOwner::User(user.clone().into_owned()),
                    encrypted: encrypted(
                        row.key_ciphertext,
                        row.encryption_version,
                        row.kms_key_id,
                    ),
                }))
            }
            KeySource::Team => {
                let row = sqlx::query!(
                    r#"
                    SELECT
                        team_key.id,
                        team_key.team_id AS "team_id!",
                        team_key.key_ciphertext,
                        team_key.encryption_version,
                        team_key.kms_key_id
                    FROM cursor_configs team_key
                    JOIN team_user membership ON membership.team_id = team_key.team_id
                    WHERE membership.user_id = $1 AND team_key.provider = $2
                    ORDER BY team_key.updated_at DESC
                    LIMIT 1
                    "#,
                    user.as_ref(),
                    provider.as_str(),
                )
                .fetch_optional(&self.pool)
                .await
                .map_err(storage)?;
                Ok(row.map(|row| StoredProviderKey {
                    id: row.id,
                    owner: KeyOwner::Team(row.team_id),
                    encrypted: encrypted(
                        row.key_ciphertext,
                        row.encryption_version,
                        row.kms_key_id,
                    ),
                }))
            }
        }
    }

    async fn available(&self, user: &MacroUserIdStr<'_>) -> Result<AvailableKeys> {
        let rows = sqlx::query!(
            r#"
            SELECT provider AS "provider!", TRUE AS "personal!"
            FROM cursor_configs
            WHERE user_id = $1 AND provider <> 'cursor'
            UNION
            SELECT team_key.provider, FALSE
            FROM cursor_configs team_key
            JOIN team_user membership ON membership.team_id = team_key.team_id
            WHERE membership.user_id = $1
            ORDER BY 1
            "#,
            user.as_ref(),
        )
        .fetch_all(&self.pool)
        .await
        .map_err(storage)?;
        let mut available = AvailableKeys::default();
        for row in rows {
            let provider = provider(&row.provider)?;
            if row.personal {
                available.personal.push(provider);
            } else {
                available.team.push(provider);
            }
        }
        Ok(available)
    }
}

struct StatusRow {
    provider: String,
    updated_at: chrono::DateTime<chrono::Utc>,
}
