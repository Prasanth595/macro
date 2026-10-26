//! Source-owned candidate selection and bounded hydration for DATE queries.

use super::*;
use crate::domain::models::{
    property_candidates::{PropertyCandidateRequest, merge_candidate_pages},
    property_dates::{PropertyDatePage, PropertyDateRequest},
};
use call::domain::models::CallCandidateRequest;
use channels::domain::models::ChannelPropertyCandidateRequest;
use crm::domain::companies_repo::CompanyPropertyCandidateRequest;
use item_filters::ast::call::CallLiteral;
use models_grouping::{CandidateIdentity, CandidatePage};
use recursion::CollapsibleExt;
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
        let base = source_request(&request, filters.clone());
        // Channels and companies own property filtering in their candidate queries.
        // Clear only the old propertyless-discovery gate, never the actual source predicates.
        let mut discovery_filters = filters.clone();
        discovery_filters.properties_filter = None;
        let discovery = source_request(&request, discovery_filters);
        let channel_request = discovery.build_comms_request();
        let company_request = discovery.build_crm_company_request(&request.team);
        let call_request = discovery.build_call_request();
        let email_request = base.build_email_request(request.team.clone());
        let emails = async {
            let Some(emails) = email_request else {
                return Ok(CandidatePage::default());
            };
            self.email_service
                .get_email_property_candidates(
                    email::domain::models::EmailPropertyCandidateRequest {
                        emails,
                        selection: selection.clone(),
                    },
                )
                .await
                .map_err(SoupErr::from)
        }
        .instrument(tracing::info_span!("soup.property_dates.email"));
        let local = async {
            self.soup_storage
                .property_candidate_page(PropertyCandidateRequest {
                    filter: filters.clone(),
                    selection: selection.clone(),
                })
                .await
                .map_err(|error| SoupErr::SoupDbErr(anyhow::Error::from(error)))
        }
        .instrument(tracing::info_span!("soup.property_dates.local"));
        let channels = async {
            let Some(channel) = channel_request else {
                return Ok(CandidatePage::default());
            };
            self.comms_service
                .get_channel_property_candidates(ChannelPropertyCandidateRequest {
                    selection: selection.clone(),
                    filter: channel.query.filter().clone(),
                    properties: filters.properties_filter.clone(),
                })
                .await
                .map_err(|error| SoupErr::SoupDbErr(anyhow::anyhow!("{error:?}")))
        }
        .instrument(tracing::info_span!("soup.property_dates.channels"));
        let calls = async {
            let Some(call) = call_request else {
                return Ok(CandidatePage::default());
            };
            let filter = add_call_properties(call.query.filter().clone(), &filters);
            self.call_record_service
                .get_user_call_candidates(CallCandidateRequest {
                    filter,
                    selection: selection.clone(),
                })
                .await
                .map_err(|error| {
                    tracing::error!(?error, "call property candidate selection failed");
                    SoupErr::CallErr
                })
        }
        .instrument(tracing::info_span!("soup.property_dates.calls"));
        let companies = async {
            let Some(company) = company_request else {
                return Ok(CandidatePage::default());
            };
            self.crm_service
                .get_company_property_candidates(CompanyPropertyCandidateRequest {
                    access: company.access,
                    selection: selection.clone(),
                    company_ids: company.company_ids,
                    hidden: company.hidden,
                    properties: filters.properties_filter.clone(),
                })
                .await
                .map_err(|error| match error {
                    crm::domain::model::CrmError::AdminRoleRequired => SoupErr::CrmAdminRequired,
                    error => SoupErr::SoupDbErr(error.into()),
                })
        }
        .instrument(tracing::info_span!("soup.property_dates.companies"));
        let (local, channels, calls, companies, emails) =
            tokio::try_join!(local, channels, calls, companies, emails)?;
        let candidates = merge_candidate_pages(
            [local, channels, calls, companies, emails],
            &request.context.selection,
        )
        .map_err(|error| SoupErr::SoupDbErr(error.into()))?;
        let span = tracing::Span::current();
        span.record("candidate_count", candidates.candidates.len());
        span.record("group_count", candidates.groups.len());
        let items = self
            .hydrate_property_date_candidates(&request, &discovery, &candidates)
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
        base: &SoupRequest<Option<EntityFilterAst>>,
        candidates: &CandidatePage,
    ) -> Result<HashMap<CandidateIdentity, SoupProjectionHydration<EnrichedSoupItem>>, SoupErr>
    {
        let mut main = Vec::new();
        let mut projects = Vec::new();
        let mut channels = Vec::new();
        let mut calls = Vec::new();
        let mut companies = Vec::new();
        let mut emails = Vec::new();
        let mut keys = HashMap::new();
        for candidate in &candidates.candidates {
            let identity = &candidate.identity;
            let entity = candidate_entity(identity)?;
            let key = (entity.entity_type, entity.entity_id.to_string());
            if keys.insert(key, identity.clone()).is_some() {
                continue;
            }
            match entity.entity_type {
                EntityType::Project if matches!(request.soup_type, SoupType::Expanded) => {
                    projects.push(entity)
                }
                EntityType::Channel => channels.push(candidate_uuid(identity)?),
                EntityType::Call => calls.push(candidate_uuid(identity)?),
                EntityType::CrmCompany => companies.push(candidate_uuid(identity)?),
                EntityType::EmailThread => emails.push(candidate_uuid(identity)?),
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
        if !channels.is_empty() {
            let mut source = base
                .build_comms_request()
                .ok_or_else(|| invalid("missing channel source"))?;
            source.limit = Some(channels.len() as u32);
            source.query = Query::Sort(
                SimpleSortMethod::UpdatedAt,
                balanced_or_tree(
                    channels
                        .into_iter()
                        .map(|id| Expr::val(ChannelLiteral::ChannelId(id)))
                        .collect(),
                ),
            );
            hydrated.extend(self.handle_comms_request(Some(source)).await?);
        }
        if !calls.is_empty() {
            let mut source = base
                .build_call_request()
                .ok_or_else(|| invalid("missing call source"))?;
            source.limit = calls.len() as u32;
            source.query = Query::Sort(
                SimpleSortMethod::UpdatedAt,
                balanced_or_tree(
                    calls
                        .into_iter()
                        .map(|id| Expr::val(CallLiteral::CallId(id)))
                        .collect(),
                ),
            );
            hydrated.extend(self.handle_call_request(Some(source)).await?);
        }
        if !companies.is_empty() {
            let mut source = base
                .build_crm_company_request(&request.team)
                .ok_or_else(|| invalid("missing company source"))?;
            source.limit = companies.len() as i64;
            source.company_ids = companies;
            hydrated.extend(self.handle_crm_company_request(Some(source)).await?);
        }
        if !emails.is_empty() {
            let mut source = base
                .build_email_request(request.team.clone())
                .ok_or_else(|| invalid("missing email source"))?;
            source.limit = Some(emails.len() as u32);
            let identities = balanced_or_tree(
                emails
                    .into_iter()
                    .map(|id| Expr::val(item_filters::ast::email::EmailLiteral::ThreadId(id)))
                    .collect(),
            )
            .ok_or_else(|| invalid("missing email candidate ids"))?;
            source.query = Query::Sort(
                SimpleSortMethod::UpdatedAt,
                Some(Arc::new(match source.query.filter() {
                    Some(filter) => Expr::and((**filter).clone(), (*identities).clone()),
                    None => (*identities).clone(),
                })),
            );
            hydrated.extend(self.handle_email_request(Some(source)).await?);
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

fn source_request(
    request: &PropertyDateRequest,
    filters: EntityFilterAst,
) -> SoupRequest<Option<EntityFilterAst>> {
    SoupRequest {
        soup_type: SoupType::Expanded,
        limit: request.context.selection.limit,
        cursor: SoupQuery::new_sort_simple(SimpleSortMethod::UpdatedAt, Some(filters)),
        sort_direction: SoupSortDirection::Desc,
        user: request.viewer.clone(),
        email_preview_view: request.context.email_preview_view.clone(),
        link_ids: request.link_ids.clone(),
    }
}

fn add_call_properties(
    filter: LiteralTree<CallLiteral>,
    filters: &EntityFilterAst,
) -> LiteralTree<CallLiteral> {
    let Some(properties) = filters.properties_filter.as_deref() else {
        return filter;
    };
    let properties = properties.collapse_frames(|frame| match frame {
        filter_ast::ExprFrame::And(left, right) => Expr::and(left, right),
        filter_ast::ExprFrame::Or(left, right) => Expr::or(left, right),
        filter_ast::ExprFrame::Not(inner) => Expr::is_not(inner),
        filter_ast::ExprFrame::Literal(literal) => Expr::val(CallLiteral::Property(literal)),
    });
    Some(Arc::new(match filter {
        Some(filter) => Expr::and((*filter).clone(), properties),
        None => properties,
    }))
}

fn candidate_uuid(identity: &CandidateIdentity) -> Result<Uuid, SoupErr> {
    Uuid::parse_str(&identity.id).map_err(|error| invalid(error.to_string()))
}

fn candidate_entity(identity: &CandidateIdentity) -> Result<Entity<'static>, SoupErr> {
    let kind = match identity.entity_type.as_str() {
        "DOCUMENT" | "TASK" => EntityType::Document,
        "CHAT" => EntityType::Chat,
        "PROJECT" => EntityType::Project,
        "CALENDAR_EVENT" => EntityType::CalendarEvent,
        "INITIATIVE" => EntityType::Initiative,
        "DATABASE_ROW" => EntityType::DatabaseRow,
        "AGENT_SESSION" => EntityType::AgentSession,
        "CHANNEL" => EntityType::Channel,
        "CALL_RECORD" => EntityType::Call,
        "COMPANY" => EntityType::CrmCompany,
        "THREAD" => EntityType::EmailThread,
        _ => {
            return Err(invalid(format!(
                "unsupported candidate entity type {}",
                identity.entity_type
            )));
        }
    };
    Ok(kind.with_entity_string(identity.id.clone()))
}

fn invalid(message: impl Into<String>) -> SoupErr {
    SoupErr::AstErr(item_filters::ast::ExpandErr::ApiAst(message.into()))
}
