use super::*;
use item_filters::ast::properties::{DateRange, PropertyEntityType};
use sqlx::PgPool;
use uuid::Uuid;

#[sqlx::test(migrations = false)]
async fn date_predicates_preserve_boolean_logic_and_type_scope(pool: PgPool) -> anyhow::Result<()> {
    sqlx::query!("DROP SCHEMA public CASCADE")
        .execute(&pool)
        .await?;
    sqlx::query!("CREATE SCHEMA public").execute(&pool).await?;
    sqlx::query!("CREATE TABLE entity_properties (entity_id text, entity_type text, property_definition_id uuid, values jsonb)").execute(&pool).await?;
    let property = Uuid::from_u128(1);
    sqlx::query!("INSERT INTO entity_properties (entity_id, entity_type, property_definition_id, values) VALUES ('present', 'CHANNEL', $1, '{\"type\":\"Date\",\"value\":\"2026-01-02T00:00:00Z\"}'), ('wrong', 'CHANNEL', $1, '{\"type\":\"String\",\"value\":\"not a timestamp\"}'), ('cleared', 'CHANNEL', $1, '{\"type\":\"Date\",\"value\":null}'), ('scoped', 'TASK', $1, '{\"type\":\"Date\",\"value\":\"2026-01-02T00:00:00Z\"}')", property).execute(&pool).await?;
    let range = Expr::val(PropertiesLiteral {
        property_definition_id: property,
        entity_type: Some(PropertyEntityType::Channel),
        value: PropertyMatchValue::DateRange(DateRange {
            start: Some("2026-01-02T00:00:00Z".parse()?),
            end: Some("2026-01-03T00:00:00Z".parse()?),
        }),
    });
    let present = Expr::val(PropertiesLiteral {
        property_definition_id: property,
        entity_type: None,
        value: PropertyMatchValue::DatePresent,
    });
    let filter = Expr::or(range, Expr::is_not(present));
    let mut query = QueryBuilder::new(
        "SELECT candidate.id::text FROM (VALUES ('present'), ('wrong'), ('cleared'), ('scoped'), ('absent')) candidate(id) WHERE ",
    );
    push_property_filter(&mut query, Some(&filter), "candidate.id", "'CHANNEL'");
    query.push(" ORDER BY candidate.id");
    let ids: Vec<String> = query.build_query_scalar().fetch_all(&pool).await?;
    assert_eq!(ids, ["absent", "cleared", "present", "scoped", "wrong"]);
    let mut query = QueryBuilder::new(
        "SELECT candidate.id::text FROM (VALUES ('present'), ('wrong'), ('cleared'), ('scoped'), ('absent')) candidate(id) WHERE ",
    );
    if let Expr::Or(range, _) = &filter {
        push_property_filter(&mut query, Some(range), "candidate.id", "'CHANNEL'");
    }
    let ids: Vec<String> = query.build_query_scalar().fetch_all(&pool).await?;
    assert_eq!(ids, ["present"]);
    Ok(())
}
