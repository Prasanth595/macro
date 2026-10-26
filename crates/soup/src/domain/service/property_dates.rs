//! Source-owned candidate selection and bounded hydration for DATE queries.

use super::*;
use crate::domain::models::{
    property_candidates::{PropertyCandidateRequest, merge_candidate_pages},
    property_dates::{PropertyDatePage, PropertyDateRequest},
};
use models_grouping::{CandidateIdentity, CandidatePage};
use tracing::Instrument;

impl<T, U, V, C, K, Crm, F> SoupImpl<T, U, V, C, K, Crm, F>
where
    T: SoupRepo,
    anyhow::Error: From<T::Err>,
    U: FrecencyQueryService,
    V: EmailPreviewServiceReadOnly,
    C: ChannelListService,
    K: CallRecordQueryService,
    Crm: CrmService,
    F: GithubPullRequestListing,
{
    #[tracing::instrument(
        name = "soup.property_dates.read",
        skip_all,
        fields(
            property_definition_id = request.context.selection.date_property_id.map(|id| id.to_string()),
            group_property_definition_id = request.context.selection.grouping.as_ref()
                .and_then(|grouping| grouping.field.date_ranges().map(|(id, _)| id.to_string())),
            limit = request.context.selection.limit,
            candidate_count = tracing::field::Empty,
            group_count = tracing::field::Empty,
            hydrated_count = tracing::field::Empty,
        ),
        err
    )]
    pub(super) async fn property_date_page(
        &self,
        request: PropertyDateRequest,
    ) -> Result<PropertyDatePage, SoupErr> {
        request.context.validate()?;
        let selection = self
            .property_queries
            .as_ref()
            .ok_or_else(|| {
                SoupErr::SoupDbErr(anyhow::anyhow!(
                    "property query authorizer is not configured"
                ))
            })?
            .authorize_selection(
                request.viewer.clone(),
                request.team.clone(),
                request.context.selection.clone(),
            )
            .await?;
        let filters = &request.context.filters;
        if filters.document_filter.is_none()
            && filters.chat_filter.is_none()
            && filters.project_filter.is_none()
            && filters.calendar_event_filter.is_none()
            && filters.initiative_filter.is_none()
            && filters.database_row_filter.is_none()
            && filters.properties_filter.is_none()
        {
            return Err(SoupErr::AstErr(item_filters::ast::ExpandErr::ApiAst(
                "property-date reads require a Soup item or property filter".into(),
            )));
        }

        let mut filters = request.context.filters.clone();
        if (filters.requests_crm_scope() || filters.requests_crm_admin()) && request.team.is_none()
        {
            return Err(SoupErr::CrmTeamRequired);
        }
        if let Some(favorites) = self
            .favorite_entities(&request.viewer, Some(&filters))
            .await?
        {
            filters = favorites::apply(filters, &favorites);
        }
        if let Some(resolved) = self
            .resolve_crm_associations(&request.viewer, request.team.as_ref(), Some(&filters))
            .await?
        {
            filters = resolved.apply(filters);
        }
        let mut pages = Vec::with_capacity(request.context.sources.len());
        for source in &request.context.sources {
            match source {
                crate::domain::models::property_dates::PropertyDateSource::Soup => {
                    pages.push(
                        self.soup_storage
                            .property_candidate_page(PropertyCandidateRequest {
                                filter: filters.clone(),
                                selection: selection.clone(),
                            })
                            .instrument(tracing::info_span!("soup.property_dates.local"))
                            .await
                            .map_err(|error| SoupErr::SoupDbErr(anyhow::Error::from(error)))?,
                    );
                }
            }
        }
        let candidates = merge_candidate_pages(pages, &request.context.selection)
            .map_err(|error| SoupErr::SoupDbErr(error.into()))?;
        let span = tracing::Span::current();
        span.record("candidate_count", candidates.candidates.len());
        span.record("group_count", candidates.groups.len());
        let items = self
            .hydrate_property_date_candidates(&request, &candidates)
            .instrument(tracing::info_span!("soup.property_dates.hydrate"))
            .await?;
        span.record("hydrated_count", items.len());
        Ok(PropertyDatePage {
            candidates,
            items,
            context: request.context,
        })
    }

    async fn hydrate_property_date_candidates(
        &self,
        request: &PropertyDateRequest,
        candidates: &CandidatePage,
    ) -> Result<HashMap<CandidateIdentity, SoupProjectionHydration<EnrichedSoupItem>>, SoupErr>
    {
        let mut main = Vec::new();
        let mut projects = Vec::new();
        let mut keys = HashMap::new();
        for candidate in &candidates.candidates {
            let identity = &candidate.identity;
            let entity = super::super::models::property_candidates::candidate_entity(identity);
            let key = (entity.entity_type, entity.entity_id.to_string());
            if keys.insert(key, identity.clone()).is_some() {
                continue;
            }
            match entity.entity_type {
                EntityType::Project if matches!(request.soup_type, SoupType::Expanded) => {
                    projects.push(entity)
                }
                _ => main.push(entity),
            }
        }
        let mut hydrated = self
            .handle_soup_by_ids(
                request.soup_type,
                AdvancedSortParams {
                    entities: &main,
                    user_id: request.viewer.copied(),
                },
                request.include_projection,
            )
            .await
            .map_err(anyhow::Error::from)?;
        if !projects.is_empty() {
            hydrated.extend(
                self.soup_storage
                    .unexpanded_soup_by_ids(AdvancedSortParams {
                        entities: &projects,
                        user_id: request.viewer.copied(),
                    })
                    .await
                    .map_err(anyhow::Error::from)?
                    .into_iter()
                    .map(SoupCandidate::plain),
            );
        }
        if request.load_frecency {
            hydrated = self
                .populate_frecency_page(
                    request.viewer.copied(),
                    Paginated::from_parts(hydrated, None::<()>),
                )
                .await?
                .items;
        }
        let facts: HashMap<_, _> = hydrated
            .iter()
            .filter_map(|candidate| {
                let entity = candidate.item.entity();
                candidate
                    .document_server_facts
                    .clone()
                    .map(|facts| ((entity.entity_type, entity.entity_id.to_string()), facts))
            })
            .collect();
        let enriched = self
            .populate_properties_items(request.viewer.copied(), hydrated)
            .await?;
        Ok(enriched
            .into_iter()
            .filter_map(|item| {
                let entity = item.item.entity();
                let identity = (entity.entity_type, entity.entity_id.to_string());
                let key = keys.get(&identity)?.clone();
                let document_server_facts = facts.get(&identity).cloned();
                Some((
                    key,
                    SoupProjectionHydration {
                        item,
                        document_server_facts,
                    },
                ))
            })
            .collect())
    }
}
