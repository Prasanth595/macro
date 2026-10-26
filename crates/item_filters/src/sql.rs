//! Shared PostgreSQL value expressions for property readers.

/// Supply a guarded Date SQL expression as literal parts to a SQL macro.
/// This keeps callers such as SQLx compile-time checked without copying the parse.
#[macro_export]
macro_rules! with_property_date_sql {
    ($alias:literal, $callback:ident) => {
        $callback!(
            "CASE WHEN ",
            $alias,
            ".values->>'type' = 'Date' THEN (",
            $alias,
            ".values->>'value')::timestamptz END"
        )
    };
}

/// Read a JSON Date variant without casting values of another property type.
/// `alias` must be a trusted SQL identifier supplied by the adapter.
pub fn date_value(alias: &str) -> String {
    macro_rules! expression {
        ($($part:literal),*) => { concat!($($part),*) };
    }
    crate::with_property_date_sql!("__property_row", expression).replace("__property_row", alias)
}
