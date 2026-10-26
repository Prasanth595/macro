//! Property-date selection over the company listing's authorized scope.
use super::*;
use crate::domain::companies_repo::CompanyPropertyCandidateRequest;
use models_grouping::CandidatePage;
use models_pagination::SimpleSortMethod;
use properties::query_support::{
    CandidateRow, build_property_candidate_query, decode_candidate_page, push_property_filter,
};

impl CompaniesRepositoryImpl {
    pub(super) async fn query_company_property_candidates(
        &self,
        request: CompanyPropertyCandidateRequest,
    ) -> Result<CandidatePage, CrmError> {
        let timestamp = match request
            .selection
            .query()
            .timestamp_sort
            .unwrap_or(SimpleSortMethod::UpdatedAt)
        {
            SimpleSortMethod::CreatedAt => "c.first_interaction",
            SimpleSortMethod::UpdatedAt => "c.last_interaction",
            SimpleSortMethod::ViewedAt => "uh.\"updatedAt\"",
            SimpleSortMethod::ViewedUpdated => "COALESCE(uh.\"updatedAt\", c.last_interaction)",
        };
        let mut query = build_property_candidate_query(&request.selection, |query| {
            query.push("SELECT c.id::text AS id, 'COMPANY'::text AS entity_type, ")
                .push(timestamp)
                .push(" AS activity_at, NULL::text AS project_id FROM crm_companies c LEFT JOIN \"UserHistory\" uh ON uh.\"itemId\" = c.id::text AND uh.\"itemType\" = 'crm_company' AND uh.\"userId\" = ")
                .push_bind(request.selection.viewer().as_ref().to_owned())
                .push(" WHERE c.team_id = ").push_bind(request.access.team_id())
                .push(" AND c.hidden = ").push_bind(request.hidden.unwrap_or(false))
                .push(" AND EXISTS (SELECT 1 FROM team_crm_settings tcs WHERE tcs.team_id = c.team_id AND tcs.crm_enabled)");
            if !request.company_ids.is_empty() {
                query.push(" AND c.id = ANY(").push_bind(request.company_ids.clone()).push(")");
            }
            query.push(" AND ");
            push_property_filter(query, request.properties.as_deref(), "c.id::text", "'COMPANY'");
            Ok(())
        }).map_err(CrmError::StorageLayerError)?;
        let rows = query
            .build_query_as::<CandidateRow>()
            .persistent(false)
            .fetch_all(&self.pool)
            .await
            .map_err(|error| CrmError::StorageLayerError(error.into()))?;
        Ok(decode_candidate_page(rows, request.selection.query()))
    }
}
