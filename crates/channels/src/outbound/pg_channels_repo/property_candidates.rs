//! DATE candidates reuse the channel list's authorization and complete filter.
use super::*;
use crate::domain::models::ChannelPropertyCandidateRequest;
use models_grouping::CandidatePage;
use models_pagination::SimpleSortMethod;
use properties::query_support::{
    CandidateRow, build_property_candidate_query, decode_candidate_page, push_property_filter,
};

impl PgChannelsRepo {
    pub(super) async fn query_channel_property_candidates(
        &self,
        req: ChannelPropertyCandidateRequest,
    ) -> Result<CandidatePage, rootcause::Report> {
        let prefix = if req
            .filter
            .as_deref()
            .is_some_and(channel_filter_mentions_participation)
        {
            CHANNEL_LIST_PREFIX_WITH_TEAM_CHANNELS
        } else {
            CHANNEL_LIST_PREFIX
        };
        let activity = match req
            .selection
            .query()
            .timestamp_sort
            .unwrap_or(SimpleSortMethod::UpdatedAt)
        {
            SimpleSortMethod::CreatedAt => "c.created_at",
            SimpleSortMethod::UpdatedAt => "c.updated_at",
            SimpleSortMethod::ViewedAt => "COALESCE(c.viewed_at, '1970-01-01 00:00:00+00')",
            SimpleSortMethod::ViewedUpdated => "COALESCE(c.viewed_at, c.updated_at)",
        };
        let mut query = build_property_candidate_query(&req.selection, |query| {
            // The shared list predicates refer to $1 for the authenticated viewer.
            query
                .push("WITH request_context AS (SELECT ")
                .push_bind(req.selection.viewer().as_ref().to_owned())
                .push("::text AS viewer), ")
                .push(prefix.trim_start().trim_start_matches("WITH "))
                .push(build_channel_list_filter(req.filter.as_deref()))
                .push(") SELECT c.id::text AS id, 'CHANNEL'::text AS entity_type, ")
                .push(activity)
                .push(" AS activity_at, NULL::text AS project_id FROM user_channels c WHERE ");
            push_property_filter(query, req.properties.as_deref(), "c.id::text", "'CHANNEL'");
            Ok(())
        })
        .map_err(|error| rootcause::report!(error))?;
        let rows = query
            .build_query_as::<CandidateRow>()
            .persistent(false)
            .fetch_all(&self.pool)
            .await?;
        Ok(decode_candidate_page(rows, req.selection.query()))
    }
}

#[cfg(test)]
mod test;
