//! Selected-property query conversion with shared frozen cursor validation.

use super::*;
use models_grouping::{CandidateDirection, CandidateQuery};
use soup::domain::models::property_dates::PropertyDateContext;

/// A flat read using a timestamp or selected-property query.
pub(crate) enum SoupReadRequest {
    /// The deployed timestamp and relevance query pipeline.
    Legacy(Box<SoupRequest<EntityFilterAst>>),
    /// A validated DATE selection; the resolver adds authenticated hydration inputs.
    PropertyDate {
        /// Immutable selection and filters.
        context: Box<PropertyDateContext>,
        /// Requested representation of source entities.
        soup_type: SoupType,
    },
}

/// A grouped read using timestamp or selected-property grouping.
pub(crate) enum GroupedReadRequest {
    /// The deployed timestamp grouping pipeline.
    Legacy(Box<GroupedSortRequest<'static>>),
    /// A validated DATE selection; the resolver adds authenticated hydration inputs.
    PropertyDate(Box<PropertyDateContext>),
}

/// Parse the selected DATE definition and intrinsic sort direction.
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
    /// Convert a flat input without changing deployed timestamp cursors.
    pub(crate) fn into_read_request(
        self,
        viewer: MacroUserIdStr<'static>,
        links: Vec<Uuid>,
    ) -> async_graphql::Result<SoupReadRequest> {
        let (context, representation) = match self {
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
                let context = PropertyDateContext::initial(
                    CandidateQuery {
                        date_property_id: Some(id),
                        direction,
                        timestamp_sort: None,
                        grouping: None,
                        cursor: None,
                        limit: input.limit.unwrap_or(20).clamp(1, 500),
                    },
                    filters,
                    email_preview_view(input.email_view)?,
                )?;
                (context, soup_type(input.expand))
            }
            Self::Continuation(input) => {
                let Some(context) = PropertyDateContext::try_decode(&input.cursor)? else {
                    return Ok(SoupReadRequest::Legacy(Box::new(
                        Self::Continuation(input).into_request(viewer, links)?,
                    )));
                };
                if input.sort_direction.is_some() {
                    return Err(async_graphql::Error::new(
                        "property-date cursor defines its own direction",
                    ));
                }
                if context.selection.grouping.is_some() {
                    return Err(async_graphql::Error::new(
                        "flat query cannot continue a group cursor",
                    ));
                }
                if let Some(view) = input.email_view
                    && context.email_preview_view != email_preview_view(Some(view))?
                {
                    return Err(async_graphql::Error::new(
                        "property-date cursor conflicts with email view",
                    ));
                }
                (context, soup_type(input.expand))
            }
        };
        Ok(SoupReadRequest::PropertyDate {
            context: Box::new(context),
            soup_type: representation,
        })
    }
}

impl GroupedSoupInput {
    /// Convert grouped input and enforce frozen continuation context.
    pub(crate) fn into_read_request(
        self,
        viewer: MacroUserIdStr<'static>,
    ) -> async_graphql::Result<GroupedReadRequest> {
        let context = match self {
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
                        GroupedSortRequest::initial(
                            viewer,
                            limit,
                            input
                                .sort_method
                                .unwrap_or(GraphqlSimpleSortMethod::ViewedUpdated)
                                .into_model()?,
                            filters,
                            grouping,
                        ),
                    )));
                }
                let (date_property_id, direction, timestamp_sort) = match selected {
                    Some((id, direction)) => (Some(id), direction, None),
                    None => (
                        None,
                        CandidateDirection::Descending,
                        Some(
                            input
                                .sort_method
                                .unwrap_or(GraphqlSimpleSortMethod::ViewedUpdated)
                                .into_model()?,
                        ),
                    ),
                };
                PropertyDateContext::initial(
                    CandidateQuery {
                        date_property_id,
                        direction,
                        timestamp_sort,
                        grouping: Some(grouping),
                        cursor: None,
                        limit,
                    },
                    filters,
                    Default::default(),
                )?
            }
            Self::Continuation(input) => {
                let Some(context) = PropertyDateContext::try_decode(&input.cursor)? else {
                    return Ok(GroupedReadRequest::Legacy(Box::new(
                        Self::Continuation(input).into_request(viewer)?,
                    )));
                };
                let grouping =
                    context.selection.grouping.as_ref().ok_or_else(|| {
                        async_graphql::Error::new("group cursor requires grouping")
                    })?;
                if grouping.field != input.group_by.into_group_by_field()?
                    || grouping.group_key.as_deref() != Some(input.group_key.as_str())
                {
                    return Err(async_graphql::Error::new(
                        "property-date cursor conflicts with grouping",
                    ));
                }
                context
            }
        };
        Ok(GroupedReadRequest::PropertyDate(Box::new(context)))
    }
}
