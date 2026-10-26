//! Soup-owned DATE candidate selection, grouping, counts, and keysets.

use super::*;
use crate::domain::models::property_candidates::{PropertyCandidateRequest, candidate_kind};
use models_grouping::{
    CandidateDirection, CandidateGroupStats, CandidateIdentity, CandidatePage, CandidateQuery,
    CandidateSortValue, GroupedCandidate, PropertyDateRangeError, PropertyDateRanges,
    PropertyEntityType as CandidateEntityType, date_bucket_sql_key,
};
use std::collections::HashSet;

pub(in crate::outbound::pg_soup_repo) async fn select(
    db: &PgPool,
    request: PropertyCandidateRequest,
) -> Result<CandidatePage, sqlx::Error> {
    let mut query = build_query(&request)?;
    let rows = query
        .build_query_as::<CandidateRow>()
        .persistent(false)
        .fetch_all(db)
        .await?;
    Ok(decode_candidate_page(rows, request.selection.query()))
}

/// Build one query over Soup's authorized, fully filtered source rows.
fn build_query(
    request: &PropertyCandidateRequest,
) -> Result<QueryBuilder<'static, Postgres>, sqlx::Error> {
    let descriptor = request.selection.query();
    descriptor.validate().map_err(type_err)?;
    let sort = descriptor
        .timestamp_sort
        .unwrap_or(SimpleSortMethod::UpdatedAt);
    let mut document_ids = DocumentIdArrays::starting_at(2);
    let source = source_sql(&request.filter, sort, &mut document_ids);
    let mut query = QueryBuilder::<Postgres>::new("WITH viewer AS (SELECT ");
    query
        .push_bind(request.selection.viewer().as_ref().to_owned())
        .push("::text AS user_id)");
    let arrays = document_ids.into_binds();
    if !arrays.is_empty() {
        query.push(", document_ids AS (SELECT ");
        for (index, ids) in arrays.into_iter().enumerate() {
            if index > 0 {
                query.push(", ");
            }
            match ids {
                FilterParameter::DocumentIds(ids) => {
                    query.push_bind(ids).push("::text[]");
                }
                FilterParameter::Date(date) => {
                    query.push_bind(date).push("::timestamptz");
                }
            }
            query.push(format!(" AS value_{index}"));
        }
        query.push(")");
    }
    // The ordinary source predicates use the viewer as their first bound value.
    query.push(", user_source_ids AS (SELECT cp.channel_id::text AS source_id FROM comms_channel_participants cp WHERE cp.user_id = (SELECT user_id FROM viewer) AND cp.left_at IS NULL UNION ALL SELECT t.team_id::text FROM team_user t WHERE t.user_id = (SELECT user_id FROM viewer) UNION ALL SELECT user_id FROM viewer), source_kinds(entity_type, group_key) AS (VALUES ");
    for (index, kind) in [
        CandidateEntityType::Document,
        CandidateEntityType::Task,
        CandidateEntityType::Chat,
        CandidateEntityType::Project,
        CandidateEntityType::CalendarEvent,
        CandidateEntityType::Initiative,
        CandidateEntityType::DatabaseRow,
    ]
    .into_iter()
    .enumerate()
    {
        if index > 0 {
            query.push(", ");
        }
        query
            .push("(")
            .push_bind(kind)
            .push("::property_entity_type, ")
            .push_bind(candidate_kind(kind).1)
            .push("::text)");
    }
    query.push("), source_rows AS (").push(source).push("), dated AS (SELECT source.id, source.property_entity_type AS entity_type, source.sort_ts AS activity_at, source.project_id, kinds.group_key AS entity_group_key, ");
    if let Some(property) = descriptor.date_property_id {
        push_date_property_value(&mut query, property);
    } else {
        query.push("source.sort_ts");
    }
    query.push(" AS sort_value, ");
    let field = descriptor.grouping.as_ref().map(|grouping| &grouping.field);
    if let Some((property, _)) = field.and_then(GroupByField::date_ranges) {
        if let Some(GroupByField::Property {
            entity_type: Some(entity_type),
            ..
        }) = field
        {
            let entity_type: CandidateEntityType = entity_type.parse().map_err(type_err)?;
            query
                .push("CASE WHEN source.property_entity_type = ")
                .push_bind(entity_type)
                .push(" THEN ");
            push_date_property_value(&mut query, property);
            query.push(" ELSE NULL END");
        } else {
            push_date_property_value(&mut query, property);
        }
    } else {
        query.push("NULL::timestamptz");
    }
    query.push(" AS group_date FROM source_rows source JOIN source_kinds kinds ON kinds.entity_type = source.property_entity_type), source_candidates AS (SELECT candidate.id, candidate.entity_type, candidate.sort_value, ");
    match field {
        None => {
            query.push("''::text");
        }
        Some(GroupByField::Date) => {
            query.push(date_bucket_sql_key("candidate.activity_at"));
        }
        Some(GroupByField::EntityType) => {
            query.push("candidate.entity_group_key");
        }
        Some(GroupByField::Project) => {
            query.push("COALESCE(candidate.project_id, '')");
        }
        Some(GroupByField::Property { .. }) => {
            if let Some((_, ranges)) = field.and_then(GroupByField::date_ranges) {
                push_date_range_bucket(&mut query, ranges)
                    .map_err(|error| type_err(format!("{error:?}")))?;
            } else {
                query.push("COALESCE(CASE grouped_property.values->>'type' WHEN 'EntityReference' THEN grouped_property.value->>'entity_id' WHEN 'SelectOption' THEN grouped_property.value#>>'{}' WHEN 'Link' THEN grouped_property.value#>>'{}' ELSE NULL END, '')");
            }
        }
    }
    query.push(" AS group_key FROM dated candidate ");
    if let Some(GroupByField::Property {
        property_definition_id,
        entity_type,
        bucketing: None,
    }) = field
    {
        query.push("LEFT JOIN LATERAL (SELECT ep.values, element.value FROM entity_properties ep LEFT JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(ep.values->'value') = 'array' THEN ep.values->'value' ELSE '[]'::jsonb END) AS element(value) ON TRUE WHERE ep.entity_id = candidate.id AND ep.entity_type = candidate.entity_type AND ep.property_definition_id = ").push_bind(*property_definition_id);
        if let Some(entity_type) = entity_type {
            let entity_type: CandidateEntityType = entity_type.parse().map_err(type_err)?;
            query.push(" AND ep.entity_type = ").push_bind(entity_type);
        }
        query.push(") grouped_property ON TRUE");
    }
    query.push(")");
    push_page(&mut query, descriptor);
    Ok(query)
}

fn document_task_joins() -> String {
    format!(
        " LEFT JOIN entity_properties ep_assignees ON dt.sub_type = 'task' AND ep_assignees.entity_id = d.id AND ep_assignees.entity_type = 'TASK' AND ep_assignees.property_definition_id = '{}' LEFT JOIN entity_properties ep_status ON dt.sub_type = 'task' AND ep_status.entity_id = d.id AND ep_status.entity_type = 'TASK' AND ep_status.property_definition_id = '{}' ",
        SystemPropertyKey::ASSIGNEES_UUID,
        SystemPropertyKey::STATUS_UUID
    )
}

fn push_date_property_value(query: &mut QueryBuilder<'_, Postgres>, property_definition_id: Uuid) {
    query
        .push("(SELECT ")
        .push(item_filters::sql::date_value("ep"))
        .push(" FROM entity_properties ep WHERE ep.property_definition_id = ")
        .push_bind(property_definition_id)
        .push(" AND ep.entity_id = source.id AND ep.entity_type = source.property_entity_type)");
}

fn push_date_range_bucket(
    query: &mut QueryBuilder<'_, Postgres>,
    ranges: &PropertyDateRanges,
) -> Result<(), PropertyDateRangeError> {
    ranges.validate()?;
    let (last, preceding) = ranges
        .ranges
        .split_last()
        .ok_or(PropertyDateRangeError::RangeCount)?;
    query.push("CASE WHEN group_date IS NULL THEN ");
    query.push_bind(ranges.missing_value_bucket_key.clone());
    for range in preceding {
        query.push(" WHEN group_date < ");
        query.push_bind(range.end.ok_or(PropertyDateRangeError::InvalidBounds)?);
        query.push(" THEN ");
        query.push_bind(range.key.clone());
    }
    query.push(" ELSE ");
    query.push_bind(last.key.clone());
    query.push(" END");
    Ok(())
}

fn push_page(query: &mut QueryBuilder<'_, Postgres>, descriptor: &CandidateQuery) {
    query.push(", canonical AS (SELECT id COLLATE \"C\" AS id, entity_type, sort_value, group_key COLLATE \"C\" AS group_key FROM source_candidates), dedup AS (SELECT DISTINCT ON (group_key, entity_type, id) id, entity_type, sort_value, group_key FROM canonical WHERE id IS NOT NULL AND entity_type IS NOT NULL AND group_key IS NOT NULL");
    if let Some(key) = descriptor
        .grouping
        .as_ref()
        .and_then(|g| g.group_key.as_ref())
    {
        query.push(" AND group_key = ");
        query.push_bind(key.clone());
    }
    let direction = match descriptor.direction {
        CandidateDirection::Ascending => "ASC",
        CandidateDirection::Descending => "DESC",
    };
    query.push(" ORDER BY group_key, entity_type, id, sort_value ");
    query.push(direction);
    query.push(" NULLS LAST), ");
    if let Some(cursor) = &descriptor.cursor {
        query.push("cursor_position AS (SELECT ");
        query.push_bind(cursor.sort_value.0);
        query.push("::timestamptz AS sort_value, ");
        query.push_bind(cursor.identity.entity_type);
        query.push("::property_entity_type AS entity_type, ");
        query.push_bind(cursor.identity.id.clone());
        query.push("::text AS id), ");
    }
    query.push("positioned AS (SELECT d.*, ");
    if descriptor.cursor.is_some() {
        query.push("CASE WHEN d.sort_value IS NULL AND c.sort_value IS NOT NULL THEN TRUE WHEN d.sort_value IS NOT NULL AND c.sort_value IS NULL THEN FALSE WHEN d.sort_value IS NULL AND c.sort_value IS NULL THEN (d.id, d.entity_type::text COLLATE \"C\") > (c.id, c.entity_type::text COLLATE \"C\") ELSE (d.sort_value ");
        query.push(
            if matches!(descriptor.direction, CandidateDirection::Ascending) {
                ">"
            } else {
                "<"
            },
        );
        query.push(" c.sort_value OR (d.sort_value = c.sort_value AND (d.id, d.entity_type::text COLLATE \"C\") > (c.id, c.entity_type::text COLLATE \"C\"))) END AS after_cursor FROM dedup d CROSS JOIN cursor_position c), ");
    } else {
        query.push("TRUE AS after_cursor FROM dedup d), ");
    }
    query.push("stats AS (SELECT group_key, count(*)::bigint AS total_count, count(*) FILTER (WHERE NOT after_cursor)::bigint AS before_or_at_cursor_count, array_agg(DISTINCT entity_type) AS entity_types FROM positioned GROUP BY group_key), ranked AS (SELECT id, entity_type, sort_value, group_key, row_number() OVER (PARTITION BY group_key ORDER BY sort_value ");
    query.push(direction);
    query.push(" NULLS LAST, id ASC, entity_type::text COLLATE \"C\" ASC) AS row_number FROM positioned WHERE after_cursor) SELECT stats.group_key, stats.total_count, stats.before_or_at_cursor_count, stats.entity_types, ranked.id, ranked.entity_type, ranked.sort_value, ranked.row_number FROM stats LEFT JOIN ranked ON ranked.group_key = stats.group_key AND ranked.row_number <= ");
    let limit = i64::from(descriptor.per_group_limit());
    query.push_bind(limit + 1);
    query.push(" ORDER BY stats.group_key, ranked.row_number");
}

#[derive(sqlx::FromRow)]
struct CandidateRow {
    entity_types: Vec<CandidateEntityType>,
    group_key: String,
    total_count: i64,
    before_or_at_cursor_count: i64,
    id: Option<String>,
    entity_type: Option<CandidateEntityType>,
    sort_value: Option<DateTime<Utc>>,
    row_number: Option<i64>,
}

fn decode_candidate_page(rows: Vec<CandidateRow>, descriptor: &CandidateQuery) -> CandidatePage {
    let limit = i64::from(descriptor.per_group_limit());
    let mut page = CandidatePage::default();
    let mut entity_types = HashSet::new();
    for row in rows {
        entity_types.extend(row.entity_types);
        if page
            .groups
            .last()
            .is_none_or(|g: &CandidateGroupStats| g.group_key != row.group_key)
        {
            page.groups.push(CandidateGroupStats {
                group_key: row.group_key.clone(),
                total_count: row.total_count,
                before_or_at_cursor_count: row.before_or_at_cursor_count,
                has_more: false,
            });
        }
        if row.row_number.is_some_and(|n| n > limit) {
            if let Some(group) = page.groups.last_mut() {
                group.has_more = true;
            }
        } else if let (Some(id), Some(entity_type)) = (row.id, row.entity_type) {
            page.candidates.push(GroupedCandidate {
                identity: CandidateIdentity { id, entity_type },
                sort_value: CandidateSortValue(row.sort_value),
                group_key: row.group_key,
            });
        }
    }
    page.entity_types = entity_types.into_iter().collect();
    page.entity_types.sort_by_key(|kind| kind.to_string());
    descriptor.order_page_groups(&mut page);
    page
}

fn source_sql(
    filter: &EntityFilterAst,
    sort: SimpleSortMethod,
    document_ids: &mut DocumentIdArrays,
) -> String {
    let mut sources = Vec::new();
    if !document_filter_is_impossible(filter.document_filter.as_deref())
        && properties_filter_can_apply_to(
            filter.properties_filter.as_deref(),
            &[PropertyEntityType::Document, PropertyEntityType::Task],
        )
    {
        sources.push(format!(
            "{}{}{}{}{}",
            grouped_document_top_clause(sort),
            if document_filter_needs_task_property_joins(filter.document_filter.as_deref()) {
                document_task_joins()
            } else {
                String::new()
            },
            document_top_where_clause(sort),
            build_document_filter(filter.document_filter.as_deref(), Some(document_ids)),
            build_properties_filter(filter.properties_filter.as_deref(), "d.id"),
        ));
    }
    if !chat_filter_is_impossible(filter.chat_filter.as_deref())
        && properties_filter_can_apply_to(
            filter.properties_filter.as_deref(),
            &[PropertyEntityType::Chat],
        )
    {
        sources.push(format!(
            "{}{}{}{}",
            grouped_chat_top_clause(sort),
            chat_top_where_clause(),
            build_chat_filter(filter.chat_filter.as_deref()),
            build_properties_filter(filter.properties_filter.as_deref(), "c.id")
        ));
    }
    if !project_filter_is_impossible(filter.project_filter.as_deref())
        && properties_filter_can_apply_to(
            filter.properties_filter.as_deref(),
            &[PropertyEntityType::Project],
        )
    {
        sources.push(format!(
            "{}{}{}{}",
            grouped_project_top_clause(sort),
            project_top_where_clause(),
            build_project_filter(filter.project_filter.as_deref()),
            build_properties_filter(filter.properties_filter.as_deref(), "p.id")
        ));
    }
    if !calendar_event_filter_is_impossible(filter.calendar_event_filter.as_deref())
        && properties_filter_can_apply_to(
            filter.properties_filter.as_deref(),
            &[PropertyEntityType::CalendarEvent],
        )
    {
        sources.push(format!(
            "{}{}{}",
            grouped_calendar_event_top_clause(sort),
            build_calendar_event_filter(filter.calendar_event_filter.as_deref()),
            build_properties_filter(filter.properties_filter.as_deref(), "event.id::text")
        ));
    }
    if initiative_opted_in(filter.initiative_filter.as_deref())
        && properties_filter_can_apply_to(
            filter.properties_filter.as_deref(),
            &[PropertyEntityType::Initiative],
        )
    {
        sources.push(format!(
            "{}{}{}",
            initiative_top_clause(sort, true),
            build_initiative_filter(filter.initiative_filter.as_deref(), document_ids),
            build_properties_filter(filter.properties_filter.as_deref(), "i.id::text")
        ));
    }
    if database_row_opted_in(filter.database_row_filter.as_deref())
        && properties_filter_can_apply_to(
            filter.properties_filter.as_deref(),
            &[PropertyEntityType::DatabaseRow],
        )
    {
        sources.push(format!(
            "{}{}{}",
            database_row_top_clause(sort, true),
            build_database_row_filter(filter.database_row_filter.as_deref()),
            build_properties_filter(filter.properties_filter.as_deref(), "r.id::text")
        ));
    }
    if sources.is_empty() {
        "SELECT NULL::text AS item_type, NULL::text AS id, NULL::timestamptz AS sort_ts, NULL::text AS project_id, NULL::property_entity_type AS property_entity_type WHERE FALSE".into()
    } else {
        sources.join(" UNION ALL ")
    }
}

#[cfg(test)]
mod test;
