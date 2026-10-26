//! Property-date wire inputs and cursor decoding for the shared Soup pipeline.

/// Identify the shared date cursor without interpreting legacy timestamp cursors.
pub(super) fn is_property_date_cursor(encoded: &str) -> bool {
    models_pagination::Base64Str::<serde_json::Value>::new_from_string(encoded.to_owned())
        .decode_json()
        .is_ok_and(|value| value.get("selection").is_some())
}

use super::*;
use crate::domain::models::property_dates::{PropertyDateContext, PropertyDateRequest};
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use models_grouping::{CandidateDirection, CandidateQuery};
use models_pagination::Base64Str;

/// A generic date cursor with frozen selection, filters, and canonical identity.
pub struct PropertyDateCursor(pub Option<PropertyDateContext>);

impl<S: Send + Sync> FromRequestParts<S> for PropertyDateCursor {
    type Rejection = axum::response::Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let Query(params) = Query::<GroupedSoupCursorParams>::from_request_parts(parts, state)
            .await
            .map_err(IntoResponse::into_response)?;
        let Some(encoded) = params.cursor else {
            return Ok(Self(None));
        };
        let context = Base64Str::<PropertyDateContext>::new_from_string(encoded)
            .decode_json()
            .map_err(|_| {
                (StatusCode::BAD_REQUEST, "Invalid property-date cursor").into_response()
            })?;
        Ok(Self(Some(context)))
    }
}

impl Params {
    pub(super) fn property_date_sort(
        &self,
    ) -> Result<Option<(Uuid, CandidateDirection)>, SoupHandlerErr> {
        let direction = match self.sort_method {
            Some(SoupApiSort::PropertyDateEarliest) => CandidateDirection::Ascending,
            Some(SoupApiSort::PropertyDateLatest) => CandidateDirection::Descending,
            _ => return Ok(None),
        };
        let property = self
            .sort_property_definition_id
            .ok_or_else(|| invalid("property-date sorting requires sort_property_definition_id"))?;
        if self.sort_direction.is_some() {
            return Err(invalid(
                "property-date sorting takes its direction from sort_method",
            ));
        }
        Ok(Some((property, direction)))
    }
}

impl GroupedParams {
    pub(super) fn property_date_sort(
        &self,
    ) -> Result<Option<(Uuid, CandidateDirection)>, SoupHandlerErr> {
        let direction = match self.sort_method {
            Some(GroupedSoupSort::PropertyDateEarliest) => CandidateDirection::Ascending,
            Some(GroupedSoupSort::PropertyDateLatest) => CandidateDirection::Descending,
            _ => return Ok(None),
        };
        let property = self
            .sort_property_definition_id
            .ok_or_else(|| invalid("property-date sorting requires sort_property_definition_id"))?;
        Ok(Some((property, direction)))
    }
}

impl<T, U, EAS, Auth> SoupRouterState<T, U, EAS, Auth>
where
    T: SoupService,
    U: EmailService,
    EAS: EntityAccessService,
    Auth: MacroAuthorizationService,
{
    pub(super) async fn handle_property_dates<R>(
        &self,
        viewer: MacroUserIdStr<'static>,
        links: Vec<Uuid>,
        team: Option<EntityAccessReceipt<MemberTeamRole>>,
        ApiSoupRequestInner {
            filters,
            params,
            email_view,
        }: ApiSoupRequestInner<R>,
        context: Option<PropertyDateContext>,
    ) -> Result<Json<PaginatedOpaqueCursor<SoupApiItem>>, SoupHandlerErr>
    where
        SoupRequest<R>: IntoSoupReqAst,
        R: Clone + Serialize + Send,
    {
        let ast = SoupRequest {
            soup_type: SoupType::Expanded,
            limit: params.limit.unwrap_or(20),
            cursor: SoupQuery::new_sort_simple(SimpleSortMethod::UpdatedAt, filters),
            sort_direction: SoupSortDirection::Desc,
            user: viewer.clone(),
            email_preview_view: email_view.clone().unwrap_or_default(),
            link_ids: links.clone(),
        }
        .into_ast()
        .map_err(SoupHandlerErr::ExpandErr)?
        .cursor
        .filter()
        .clone()
        .unwrap_or_default();
        let supplied = params.property_date_sort()?;
        if context.is_some() && params.sort_method.is_some() && supplied.is_none() {
            return Err(invalid("property-date cursor conflicts with sort method"));
        }
        let mut request = if let Some(context) = context {
            validate_inputs(
                &context,
                supplied,
                params.sort_property_definition_id,
                params.limit,
                &ast,
            )?;
            if email_view
                .as_ref()
                .is_some_and(|view| view != &context.email_preview_view)
            {
                return Err(invalid("property-date cursor conflicts with email view"));
            }
            if context.selection.grouping.is_some() || context.selection.cursor.is_none() {
                return Err(invalid("invalid flat property-date cursor"));
            }
            PropertyDateRequest {
                viewer: viewer.clone(),
                team,
                context,
                include_projection: false,
                load_frecency: true,
                soup_type: SoupType::Expanded,
                link_ids: links,
            }
        } else {
            let (property, direction) = supplied
                .ok_or_else(|| invalid("property-date sorting requires a selected property"))?;
            let selection = CandidateQuery {
                date_property_id: Some(property),
                timestamp_sort: None,
                direction,
                grouping: None,
                cursor: None,
                limit: params.limit.unwrap_or(20).clamp(1, 500),
            };
            let mut request =
                PropertyDateRequest::initial(viewer.clone(), team, selection, ast, false)?;
            request.link_ids = links;
            request.context.email_preview_view = email_view.unwrap_or_default();
            request
        };
        request.load_frecency = true;
        request.soup_type = if params.expand == Some(false) {
            SoupType::UnExpanded
        } else {
            SoupType::Expanded
        };
        let mut page = self
            .service
            .get_property_date_page(request)
            .await?
            .into_flat()
            .map(|value| SoupApiItem::from_frecency_soup_item(value.item));
        mark_favorited(&*self.favorites, &viewer, page.items.iter_mut()).await;
        Ok(Json(page))
    }

    pub(super) async fn handle_property_date_groups(
        &self,
        viewer: MacroUserIdStr<'static>,
        links: Vec<Uuid>,
        team: Option<EntityAccessReceipt<MemberTeamRole>>,
        filters: EntityFilterAst,
        params: GroupedParams,
        cursor: Option<String>,
    ) -> Result<ApiGroupedSoupParts, SoupHandlerErr> {
        let supplied = params.property_date_sort()?;
        let grouping = GroupingConfig {
            field: params.group_by.into(),
            group_key: params.group_key,
            per_group_limit: params.limit.map(u32::from),
        };
        let mut request = if let Some(cursor) = cursor {
            let request = PropertyDateRequest::continue_from(viewer.clone(), team, cursor, false)?;
            validate_inputs(
                &request.context,
                supplied,
                params.sort_property_definition_id,
                params.limit,
                &filters,
            )?;
            let frozen = request
                .context
                .selection
                .grouping
                .as_ref()
                .ok_or_else(|| invalid("grouped cursor has no grouping"))?;
            if frozen.field != grouping.field || frozen.group_key != grouping.group_key {
                return Err(invalid(
                    "property-date cursor conflicts with grouping inputs",
                ));
            }
            if supplied.is_none()
                && let Some(sort) = params.sort_method
            {
                let timestamp = timestamp_sort(sort)?;
                if serde_json::to_value(timestamp).map_err(|_| SoupHandlerErr::Expand)?
                    != serde_json::to_value(request.context.selection.timestamp_sort)
                        .map_err(|_| SoupHandlerErr::Expand)?
                {
                    return Err(invalid(
                        "property-date cursor conflicts with timestamp sort",
                    ));
                }
            }
            request
        } else {
            let limit = params.limit.unwrap_or(20).clamp(1, 500);
            let mut grouping = grouping;
            grouping.per_group_limit = Some(u32::from(limit));
            let (date_property_id, direction, timestamp_sort) = match supplied {
                Some((id, direction)) => (Some(id), direction, None),
                None => (
                    None,
                    CandidateDirection::Descending,
                    timestamp_sort(params.sort_method.unwrap_or(GroupedSoupSort::ViewedUpdated))?,
                ),
            };
            PropertyDateRequest::initial(
                viewer.clone(),
                team,
                CandidateQuery {
                    date_property_id,
                    direction,
                    timestamp_sort,
                    grouping: Some(grouping),
                    cursor: None,
                    limit,
                },
                filters,
                false,
            )?
        };
        request.link_ids = links;
        let response = self
            .service
            .get_property_date_page(request)
            .await?
            .into_grouped()?;
        let mut items: HashMap<_, _> = response
            .items
            .into_iter()
            .map(|(key, value)| (key, SoupApiItem::from_frecency_soup_item(value)))
            .collect();
        mark_favorited(&*self.favorites, &viewer, items.values_mut()).await;
        Ok(ApiGroupedSoupParts {
            items,
            groups: response
                .groups
                .into_iter()
                .map(ApiGroupMeta::from)
                .collect(),
        })
    }
}

fn timestamp_sort(sort: GroupedSoupSort) -> Result<Option<SimpleSortMethod>, SoupHandlerErr> {
    Ok(Some(match sort {
        GroupedSoupSort::ViewedAt => SimpleSortMethod::ViewedAt,
        GroupedSoupSort::CreatedAt => SimpleSortMethod::CreatedAt,
        GroupedSoupSort::UpdatedAt => SimpleSortMethod::UpdatedAt,
        GroupedSoupSort::ViewedUpdated => SimpleSortMethod::ViewedUpdated,
        _ => return Err(invalid("expected timestamp sort")),
    }))
}

fn validate_inputs(
    context: &PropertyDateContext,
    supplied: Option<(Uuid, CandidateDirection)>,
    property: Option<Uuid>,
    limit: Option<u16>,
    filters: &EntityFilterAst,
) -> Result<(), SoupHandlerErr> {
    context
        .selection
        .validate()
        .map_err(|error| invalid(error.to_string()))?;
    if supplied.is_some_and(|(id, direction)| {
        context.selection.date_property_id != Some(id) || context.selection.direction != direction
    }) || property.is_some_and(|id| context.selection.date_property_id != Some(id))
        || limit.is_some_and(|limit| limit != context.selection.limit)
    {
        return Err(invalid("property-date cursor conflicts with sort inputs"));
    }
    if !filters.is_empty()
        && serde_json::to_value(filters).map_err(|_| SoupHandlerErr::Expand)?
            != serde_json::to_value(&context.filters).map_err(|_| SoupHandlerErr::Expand)?
    {
        return Err(invalid("property-date cursor conflicts with filters"));
    }
    Ok(())
}

fn invalid(message: impl Into<String>) -> SoupHandlerErr {
    SoupHandlerErr::ExpandErr(ExpandErr::ApiAst(message.into()))
}
