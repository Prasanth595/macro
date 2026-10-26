//! Bound property predicates shared by source-owned DATE candidate queries.

#[cfg(test)]
mod test;

use filter_ast::Expr;
use item_filters::ast::properties::{PropertiesLiteral, PropertyMatchValue};
use sqlx::{Postgres, QueryBuilder};

/// Append an exact property predicate for an authorized source row.
///
/// The SQL expressions are adapter-owned column expressions, not request input.
/// Match the source entity type as well as its ID, including inside negations.
pub fn push_property_filter(
    query: &mut QueryBuilder<'_, Postgres>,
    filter: Option<&Expr<PropertiesLiteral>>,
    entity_id_sql: &str,
    entity_type_sql: &str,
) {
    let Some(filter) = filter else {
        query.push("TRUE");
        return;
    };
    // Traverse iteratively so deeply nested request trees cannot exhaust the stack.
    enum Part<'a> {
        Node(&'a Expr<PropertiesLiteral>),
        Sql(&'static str),
    }
    let mut parts = vec![Part::Node(filter)];
    while let Some(part) = parts.pop() {
        match part {
            Part::Sql(sql) => {
                query.push(sql);
            }
            Part::Node(Expr::And(left, right)) | Part::Node(Expr::Or(left, right)) => {
                let operator = if matches!(part, Part::Node(Expr::And(_, _))) {
                    " AND "
                } else {
                    " OR "
                };
                query.push("(");
                parts.extend([
                    Part::Sql(")"),
                    Part::Node(right),
                    Part::Sql(operator),
                    Part::Node(left),
                ]);
            }
            Part::Node(Expr::Not(inner)) => {
                query.push("(NOT ");
                parts.extend([Part::Sql(")"), Part::Node(inner)]);
            }
            Part::Node(Expr::Literal(literal)) => {
                push_literal(query, literal, entity_id_sql, entity_type_sql);
            }
        }
    }
}

fn push_literal(
    query: &mut QueryBuilder<'_, Postgres>,
    literal: &PropertiesLiteral,
    entity_id_sql: &str,
    entity_type_sql: &str,
) {
    query.push("EXISTS (SELECT 1 FROM entity_properties property_filter WHERE property_filter.entity_id = ");
    query
        .push(entity_id_sql)
        .push(" AND property_filter.entity_type::text = ")
        .push(entity_type_sql);
    query
        .push(" AND property_filter.property_definition_id = ")
        .push_bind(literal.property_definition_id);
    if let Some(entity_type) = literal.entity_type {
        query
            .push(" AND property_filter.entity_type::text = ")
            .push_bind(entity_type.to_string());
    }
    query.push(" AND ");
    const DATE: &str = "CASE WHEN property_filter.values->>'type' = 'Date' THEN (property_filter.values->>'value')::timestamptz END";
    match &literal.value {
        PropertyMatchValue::SelectOption(id) => {
            query
                .push("property_filter.values->'value' ? ")
                .push_bind(id.to_string());
        }
        PropertyMatchValue::EntityRef(id) => {
            query
                .push("property_filter.values->'value' @> ")
                .push_bind(serde_json::json!([{"entity_id": id.to_string()}]))
                .push("::jsonb");
        }
        PropertyMatchValue::DatePresent => {
            query.push(DATE).push(" IS NOT NULL");
        }
        PropertyMatchValue::DateRange(range) => {
            query.push(DATE).push(" IS NOT NULL");
            if let Some(start) = range.start {
                query.push(" AND ").push(DATE).push(" >= ").push_bind(start);
            }
            if let Some(end) = range.end {
                query.push(" AND ").push(DATE).push(" < ").push_bind(end);
            }
        }
    }
    query.push(")");
}
