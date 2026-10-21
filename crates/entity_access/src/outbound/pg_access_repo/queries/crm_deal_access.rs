//! Query for CRM deal access level.

use crate::domain::models::{AccessLevel, CrmEntityAccess, TeamRole};
use macro_user_id::{lowercased::Lowercase, user_id::MacroUserId};
use sqlx::PgPool;
use uuid::Uuid;

/// Resolve the access level a user has for a CRM deal, together with the
/// deal's owning `team_id`.
///
/// Joins `crm_deals` against the user's `team_user` row. Every team role can
/// edit a deal, matching a visible company. Returns `None` when the user is
/// not on that team.
#[tracing::instrument(err, skip(pool))]
pub async fn get_crm_deal_access(
    pool: &PgPool,
    deal_id: &Uuid,
    user_id: &MacroUserId<Lowercase<'_>>,
) -> Result<Option<CrmEntityAccess>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT
            d.team_id AS "team_id!",
            tu.team_role AS "role!: TeamRole"
        FROM crm_deals d
        JOIN team_user tu
            ON tu.team_id = d.team_id
           AND tu.user_id = $1
        WHERE d.id = $2
        "#,
        user_id.as_ref(),
        deal_id,
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        let access_level = match r.role {
            TeamRole::Member | TeamRole::Admin => AccessLevel::Edit,
            TeamRole::Owner => AccessLevel::Owner,
        };
        CrmEntityAccess {
            access_level,
            team_id: r.team_id,
            team_role: r.role,
        }
    }))
}

/// Resolve team-scoped access to a deal owned by the team.
#[tracing::instrument(err, skip(pool))]
pub async fn get_team_crm_deal_access(
    pool: &PgPool,
    deal_id: &Uuid,
    team_id: &Uuid,
) -> Result<Option<CrmEntityAccess>, sqlx::Error> {
    sqlx::query_as!(
        CrmEntityAccess,
        r#"
        SELECT
            'view'::"AccessLevel" AS "access_level!: AccessLevel",
            team_id AS "team_id!",
            'member'::team_role AS "team_role!: TeamRole"
        FROM crm_deals
        WHERE id = $1
          AND team_id = $2
        "#,
        deal_id,
        team_id,
    )
    .fetch_optional(pool)
    .await
}
