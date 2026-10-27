//! SQL grouping and property-value expressions for Soup queries.

use models_grouping::{GroupByField, date_bucket_sql_key, date_bucket_sql_order};
use std::borrow::Cow;

/// SQL expressions derived from one property value and its definition.
pub(super) struct PropertyValueSql {
    /// Nullable numeric sort key for the complete stored value.
    pub sort_key: String,
    /// SQL type used to bind the sort key.
    pub sort_type: &'static str,
    /// Group key for one expanded value; absent values retain the empty key.
    pub group_key: String,
    /// Nullable display order for one expanded option.
    pub group_order: String,
}

/// Guard a DATE value before casting its JSON payload.
pub(super) fn property_date_expression(alias: &str) -> String {
    format!(
        "CASE WHEN {alias}.values->>'type' = 'Date' THEN ({alias}.values->>'value')::timestamptz END"
    )
}

/// Derive sorting and grouping from the same per-type rules.
/// All arguments are trusted SQL aliases or expressions owned by this adapter.
pub(super) fn property_value_sql(alias: &str, data_type: &str, element: &str) -> PropertyValueSql {
    let date = property_date_expression(alias);
    let option_order = format!(
        "(SELECT po.display_order::double precision FROM property_options po WHERE po.id::text = {element}#>>'{{}}' AND po.property_definition_id = {alias}.property_definition_id)"
    );
    let selected_order = format!(
        "(SELECT min(po.display_order)::double precision FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof({alias}.values->'value') = 'array' THEN {alias}.values->'value' ELSE '[]'::jsonb END) chosen(id) JOIN property_options po ON po.id::text = chosen.id AND po.property_definition_id = {alias}.property_definition_id)"
    );
    let number = format!(
        "CASE WHEN jsonb_typeof({alias}.values->'value') = 'number' THEN ({alias}.values->>'value')::double precision END"
    );
    let boolean = format!(
        "CASE WHEN jsonb_typeof({alias}.values->'value') = 'boolean' THEN CASE WHEN ({alias}.values->>'value')::boolean THEN 1::double precision ELSE 0::double precision END END"
    );
    let option_group = format!("CASE WHEN {option_order} IS NOT NULL THEN {element}#>>'{{}}' END");
    let branches = [
        (
            "'DATE'",
            "Date",
            format!("EXTRACT(EPOCH FROM {date})::double precision * 1000000"),
            "NULL::text".to_owned(),
            "NULL::double precision".to_owned(),
        ),
        (
            "'NUMBER'",
            "Number",
            number,
            "NULL::text".to_owned(),
            "NULL::double precision".to_owned(),
        ),
        (
            "'BOOLEAN'",
            "Boolean",
            boolean,
            "NULL::text".to_owned(),
            "NULL::double precision".to_owned(),
        ),
        (
            "'SELECT_STRING', 'SELECT_NUMBER', 'TAG'",
            "SelectOption",
            selected_order,
            option_group,
            option_order,
        ),
        (
            "'ENTITY'",
            "EntityReference",
            "NULL::double precision".to_owned(),
            format!("{element}->>'entity_id'"),
            "NULL::double precision".to_owned(),
        ),
        (
            "'LINK'",
            "Link",
            "NULL::double precision".to_owned(),
            format!("{element}#>>'{{}}'"),
            "NULL::double precision".to_owned(),
        ),
    ];
    let mut sort_key = String::from("CASE");
    let mut group_key = String::from("CASE");
    let mut group_order = String::from("CASE");
    for (types, variant, sort, group, order) in branches {
        let condition = format!(
            " WHEN {data_type} IN ({types}) AND {alias}.values->>'type' = '{variant}' THEN "
        );
        sort_key.push_str(&condition);
        sort_key.push_str(&sort);
        group_key.push_str(&condition);
        group_key.push_str(&group);
        group_order.push_str(&condition);
        group_order.push_str(&order);
    }
    sort_key.push_str(" ELSE NULL::double precision END");
    group_key.push_str(" ELSE NULL::text END");
    group_order.push_str(" ELSE NULL::double precision END");
    PropertyValueSql {
        sort_key,
        sort_type: "double precision",
        group_key: format!("COALESCE({group_key}, '')"),
        group_order,
    }
}

/// Build the group select expression for a field.
pub fn group_select_expr(field: &GroupByField) -> Cow<'static, str> {
    match field {
        GroupByField::Date => Cow::Owned(date_bucket_sql_key("sort_ts")),
        GroupByField::EntityType => Cow::Borrowed("item_type"),
        GroupByField::Project => Cow::Borrowed("COALESCE(project_id::text, '')"),
        GroupByField::Property { .. } => Cow::Owned(
            property_value_sql("ep_group", "ep_group.data_type", "ep_group.val").group_key,
        ),
    }
}

/// Build the group order expression for a field.
pub fn group_order_expr(field: &GroupByField) -> Cow<'static, str> {
    match field {
        GroupByField::Date => Cow::Owned(date_bucket_sql_order("sort_ts")),
        GroupByField::EntityType | GroupByField::Project => Cow::Borrowed("\"group_key\""),
        GroupByField::Property { .. } => {
            Cow::Borrowed("(\"group_key\" = '') ASC, \"group_order\" ASC NULLS LAST, \"group_key\"")
        }
    }
}

/// Result of building a group JOIN clause with optional bind parameter.
pub struct GroupJoinClause {
    /// SQL JOIN clause; the optional entity type uses the fixed `$10` slot.
    pub sql: String,
    /// Entity type value to bind at `$10`, if present.
    pub entity_type_bind: Option<String>,
}

/// Expand option, tag, entity and link values into their server-derived groups.
/// Scalar values never expand arrays, including malformed DATE payloads.
pub fn group_join_clause(field: &GroupByField) -> Option<GroupJoinClause> {
    let GroupByField::Property {
        property_definition_id,
        entity_type,
        ..
    } = field
    else {
        return None;
    };
    let entity_type_filter = if entity_type.is_some() {
        "AND ep.entity_type = $10::property_entity_type"
    } else {
        ""
    };
    let order = property_value_sql("ep", "pd_group.data_type", "elem.val").group_order;
    Some(GroupJoinClause {
        sql: format!(
            "LEFT JOIN LATERAL (
                SELECT ep.values, ep.property_definition_id, pd_group.data_type, elem.val, {order} AS group_order
                FROM entity_properties ep
                JOIN property_definitions pd_group ON pd_group.id = ep.property_definition_id
                LEFT JOIN LATERAL jsonb_array_elements(
                    CASE WHEN pd_group.data_type IN ('SELECT_STRING', 'SELECT_NUMBER', 'TAG', 'ENTITY', 'LINK')
                        AND jsonb_typeof(ep.values->'value') = 'array'
                        THEN ep.values->'value' ELSE '[]'::jsonb END
                ) elem(val) ON TRUE
                WHERE ep.entity_id = t.id::text
                  AND ep.entity_type = t.property_entity_type
                  AND ep.property_definition_id = '{property_definition_id}'
                  {entity_type_filter}
            ) ep_group ON TRUE"
        ),
        entity_type_bind: entity_type.clone(),
    })
}

#[cfg(test)]
mod test;
