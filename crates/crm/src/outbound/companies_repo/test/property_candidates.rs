use super::helpers::*;
use crate::domain::{
    auth::CrmTeamReceipt,
    companies_repo::CompanyPropertyCandidateRequest,
    model::CrmError,
    service::{CrmService, CrmServiceImpl},
};
use crate::outbound::{
    companies_repo::CompaniesRepositoryImpl, no_op_resolver::NoOpCompanyMetadataResolver,
};
use entity_access::domain::models::{
    Entity, EntityAccessReceipt, EntityPermission, EntityType, MemberTeamRole, TeamRole,
};
use macro_user_id::user_id::MacroUserIdStr;
use models_grouping::{CandidateCursor, CandidateDirection, CandidateQuery};
use properties::PropertiesService;
use sqlx::PgPool;
use uuid::Uuid;

struct Notifications;
impl properties::NotificationService for Notifications {
    type Err = anyhow::Error;
    async fn send_task_assigned<'a>(
        &self,
        _: properties::domain::model::TaskAssignedNotification<'a>,
    ) -> Result<(), Self::Err> {
        unreachable!("read-only query")
    }
}
type Definitions = properties::PropertiesServiceImpl<
    properties::PropertiesPgRepo,
    properties::PermissionServiceImpl<entity_access::domain::ports::NoOpEntityAccessService>,
    Notifications,
>;

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn dates_preserve_team_visibility_hidden_policy_and_pagination(
    pool: PgPool,
) -> anyhow::Result<()> {
    let team = Uuid::now_v7();
    let owner = MacroUserIdStr::try_from("macro|date-owner@test.com".to_owned())?;
    seed_team(&pool, team, owner.as_ref()).await?;
    enable_crm_for_team(&pool, team).await?;
    let first = insert_company(&pool, team, true, &["first.test"]).await?;
    let second = insert_company(&pool, team, true, &["second.test"]).await?;
    let undated = insert_company(&pool, team, true, &["undated.test"]).await?;
    let hidden = insert_company(&pool, team, true, &["hidden.test"]).await?;
    sqlx::query!(
        "UPDATE crm_companies SET hidden = TRUE WHERE id = $1",
        hidden
    )
    .execute(&pool)
    .await?;
    let property = Uuid::now_v7();
    sqlx::query!("INSERT INTO property_definitions (id, user_id, display_name, data_type, is_multi_select) VALUES ($1, $2, 'Review Date', 'DATE', false)", property, owner.as_ref()).execute(&pool).await?;
    for (id, date) in [
        (first, "2026-01-01T00:00:00Z"),
        (second, "2026-01-02T00:00:00Z"),
        (hidden, "2025-01-01T00:00:00Z"),
    ] {
        sqlx::query!("INSERT INTO entity_properties (id, entity_id, entity_type, property_definition_id, values) VALUES ($1, $2, 'COMPANY', $3, $4)", Uuid::now_v7(), id.to_string(), property, serde_json::json!({"type":"Date","value":date})).execute(&pool).await?;
    }
    let definitions = Definitions::new(properties::PropertiesPgRepo::new(pool.clone()), None, None);
    let service = CrmServiceImpl::new(
        CompaniesRepositoryImpl::new(pool.clone()),
        NoOpCompanyMetadataResolver,
    );
    let receipt = |role| -> anyhow::Result<CrmTeamReceipt<MemberTeamRole>> {
        Ok(CrmTeamReceipt::from_team_receipt(
            EntityAccessReceipt::try_new_authenticated_user(
                owner.clone(),
                Entity {
                    entity_id: team.to_string(),
                    entity_type: EntityType::Team,
                },
                EntityPermission::TeamRole { role },
            )?,
        )?)
    };
    let mut selection = CandidateQuery {
        date_property_id: Some(property),
        timestamp_sort: None,
        direction: CandidateDirection::Ascending,
        grouping: None,
        cursor: None,
        limit: 1,
    };
    let mut ids = Vec::new();
    for _ in 0..3 {
        let page = service
            .get_company_property_candidates(CompanyPropertyCandidateRequest {
                access: receipt(TeamRole::Member)?,
                selection: definitions
                    .authorize_property_query(owner.clone(), None, selection.clone())
                    .await?,
                company_ids: vec![],
                hidden: None,
                properties: None,
            })
            .await?;
        assert_eq!(page.groups[0].total_count, 3);
        let candidate = &page.candidates[0];
        ids.push(candidate.identity.id.clone());
        selection.cursor = Some(CandidateCursor {
            identity: candidate.identity.clone(),
            sort_value: candidate.sort_value,
        });
    }
    assert_eq!(
        ids,
        [first.to_string(), second.to_string(), undated.to_string()]
    );
    selection.cursor = None;
    let denied = service
        .get_company_property_candidates(CompanyPropertyCandidateRequest {
            access: receipt(TeamRole::Member)?,
            selection: definitions
                .authorize_property_query(owner.clone(), None, selection.clone())
                .await?,
            company_ids: vec![],
            hidden: Some(true),
            properties: None,
        })
        .await
        .unwrap_err();
    assert!(matches!(denied, CrmError::AdminRoleRequired));
    let hidden_page = service
        .get_company_property_candidates(CompanyPropertyCandidateRequest {
            access: receipt(TeamRole::Admin)?,
            selection: definitions
                .authorize_property_query(owner.clone(), None, selection.clone())
                .await?,
            company_ids: vec![],
            hidden: Some(true),
            properties: None,
        })
        .await?;
    assert_eq!(hidden_page.candidates[0].identity.id, hidden.to_string());
    sqlx::query!(
        "UPDATE team_crm_settings SET crm_enabled = FALSE WHERE team_id = $1",
        team
    )
    .execute(&pool)
    .await?;
    let disabled = service
        .get_company_property_candidates(CompanyPropertyCandidateRequest {
            access: receipt(TeamRole::Admin)?,
            selection: definitions
                .authorize_property_query(owner, None, selection)
                .await?,
            company_ids: vec![],
            hidden: None,
            properties: None,
        })
        .await?;
    assert!(disabled.candidates.is_empty());
    Ok(())
}
