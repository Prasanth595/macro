//! Reuse the shared DATE candidate pipeline without changing timestamp cursors.

use super::*;
use models_grouping::{CandidateDirection, CandidateQuery};
use soup::domain::models::property_dates::PropertyDateRequest;

/// A flat read using the deployed timestamp or selected-property cursor.
pub(crate) enum SoupReadRequest {
    /// The deployed timestamp and relevance query pipeline.
    Legacy(Box<SoupRequest<EntityFilterAst>>),
    /// The cross-source DATE-property query pipeline.
    PropertyDate(Box<PropertyDateRequest>),
}

/// A grouped read using timestamp or selected-property grouping.
pub(crate) enum GroupedReadRequest {
    /// The deployed timestamp grouping pipeline.
    Legacy(Box<GroupedSortQuery<'static>>),
    /// The cross-source DATE-property grouping pipeline.
    PropertyDate(Box<PropertyDateRequest>),
}

/// Parse a selected DATE definition and its intrinsic sort direction.
fn selected_sort(
    sort: Option<GraphqlSimpleSortMethod>,
    property: Option<ID>,
) -> async_graphql::Result<Option<(Uuid, CandidateDirection)>> {
    let direction = match sort {
        Some(GraphqlSimpleSortMethod::PropertyDateEarliest) => CandidateDirection::Ascending,
        Some(GraphqlSimpleSortMethod::PropertyDateLatest) => CandidateDirection::Descending,
        _ => return Ok(None),
    };
    let property = parse_id(
        property.ok_or_else(|| {
            async_graphql::Error::new("property-date sort requires sortPropertyDefinitionId")
        })?,
        "sortPropertyDefinitionId",
    )?;
    Ok(Some((property, direction)))
}

impl SoupInput {
    /// Convert a flat transport input without changing deployed timestamp cursors.
    pub(crate) fn into_read_request(
        self,
        viewer: MacroUserIdStr<'static>,
        links: Vec<Uuid>,
    ) -> async_graphql::Result<SoupReadRequest> {
        match self {
            Self::Initial(input) => {
                let Some((id, direction)) =
                    selected_sort(input.sort_method, input.sort_property_definition_id.clone())?
                else {
                    return Ok(SoupReadRequest::Legacy(Box::new(
                        Self::Initial(input).into_request(viewer, links)?,
                    )));
                };
                if input.sort_direction.is_some() {
                    return Err(async_graphql::Error::new(
                        "property-date sort defines its own direction",
                    ));
                }
                let filters = input
                    .filters
                    .map(GraphqlEntityFilterAst::into_ast)
                    .transpose()?
                    .unwrap_or_default();
                let mut request = PropertyDateRequest::initial(
                    viewer,
                    None,
                    CandidateQuery {
                        date_property_id: Some(id),
                        direction,
                        timestamp_sort: None,
                        grouping: None,
                        cursor: None,
                        limit: input.limit.unwrap_or(20).clamp(1, 500),
                    },
                    filters,
                    true,
                )?;
                request.soup_type = soup_type(input.expand);
                request.context.email_preview_view = email_preview_view(input.email_view)?;
                request.link_ids = links;
                Ok(SoupReadRequest::PropertyDate(Box::new(request)))
            }
            Self::Continuation(input) => {
                let value = Base64Str::<serde_json::Value>::new_from_string(input.cursor.clone())
                    .decode_json()
                    .map_err(|error| {
                        async_graphql::Error::new(format!("invalid cursor: {error}"))
                    })?;
                if value.get("selection").is_none() {
                    return Ok(SoupReadRequest::Legacy(Box::new(
                        Self::Continuation(input).into_request(viewer, links)?,
                    )));
                }
                if input.sort_direction.is_some() {
                    return Err(async_graphql::Error::new(
                        "property-date cursor defines its own direction",
                    ));
                }
                let mut request =
                    PropertyDateRequest::continue_from(viewer, None, input.cursor, true)?;
                if request.context.selection.grouping.is_some() {
                    return Err(async_graphql::Error::new(
                        "flat query cannot continue a group cursor",
                    ));
                }
                request.soup_type = soup_type(input.expand);
                if let Some(view) = input.email_view
                    && request.context.email_preview_view != email_preview_view(Some(view))?
                {
                    return Err(async_graphql::Error::new(
                        "property-date cursor conflicts with email view",
                    ));
                }
                request.link_ids = links;
                Ok(SoupReadRequest::PropertyDate(Box::new(request)))
            }
        }
    }
}

impl GroupedSoupInput {
    /// Convert grouped transport input and enforce frozen continuation context.
    pub(crate) fn into_read_request(
        self,
        viewer: MacroUserIdStr<'static>,
    ) -> async_graphql::Result<GroupedReadRequest> {
        match self {
            Self::Initial(input) => {
                let field = input.group_by.into_group_by_field()?;
                let selected = selected_sort(input.sort_method, input.sort_property_definition_id)?;
                let filters = input
                    .filters
                    .map(GraphqlEntityFilterAst::into_ast)
                    .transpose()?
                    .unwrap_or_default();
                let limit = input.limit.unwrap_or(20).clamp(1, 500);
                let grouping = GroupingConfig {
                    field,
                    group_key: None,
                    per_group_limit: Some(u32::from(limit)),
                };
                if selected.is_none() && grouping.field.date_ranges().is_none() {
                    return Ok(GroupedReadRequest::Legacy(Box::new(
                        GroupedSortQuery::initial(
                            viewer,
                            limit,
                            input
                                .sort_method
                                .unwrap_or(GraphqlSimpleSortMethod::ViewedUpdated)
                                .into_model()?,
                            filters,
                            grouping,
                        )?,
                    )));
                }
                let (date_property_id, direction, timestamp_sort) = match selected {
                    Some((id, direction)) => (Some(id), direction, None),
                    None => {
                        let GroupedSortMethod::Timestamp(sort) = input
                            .sort_method
                            .unwrap_or(GraphqlSimpleSortMethod::ViewedUpdated)
                            .into_model()?;
                        (None, CandidateDirection::Descending, Some(sort))
                    }
                };
                Ok(GroupedReadRequest::PropertyDate(Box::new(
                    PropertyDateRequest::initial(
                        viewer,
                        None,
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
                    )?,
                )))
            }
            Self::Continuation(input) => {
                let value = Base64Str::<serde_json::Value>::new_from_string(input.cursor.clone())
                    .decode_json()
                    .map_err(|error| {
                        async_graphql::Error::new(format!("invalid cursor: {error}"))
                    })?;
                if value.get("selection").is_none() {
                    return Ok(GroupedReadRequest::Legacy(Box::new(
                        Self::Continuation(input).into_request(viewer)?,
                    )));
                }
                let request =
                    PropertyDateRequest::continue_from(viewer, None, input.cursor, false)?;
                let grouping =
                    request.context.selection.grouping.as_ref().ok_or_else(|| {
                        async_graphql::Error::new("group cursor requires grouping")
                    })?;
                if grouping.field != input.group_by.into_group_by_field()?
                    || grouping.group_key.as_deref() != Some(input.group_key.as_str())
                {
                    return Err(async_graphql::Error::new(
                        "property-date cursor conflicts with grouping",
                    ));
                }
                Ok(GroupedReadRequest::PropertyDate(Box::new(request)))
            }
        }
    }
}
