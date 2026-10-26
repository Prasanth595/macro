//! Generate synthetic document capsules through the canonical Rust wire encoder.
use predicate_index::RecordKey;
use serde_json::json;
use soup_filter_projection::{SoupCacheProjectionSupplement, encode_cache_projection_supplement};
use uuid::Uuid;

fn main() {
    let records: Vec<_> = (1_u128..=5_002)
        .map(|index| {
            let id = Uuid::from_u128(index).to_string();
            let property_id = Uuid::from_u128(index + 10_000).to_string();
            let projection =
                encode_cache_projection_supplement(&SoupCacheProjectionSupplement::document(
                    RecordKey::new(format!("GraphqlSoupDocument:{id}"))
                        .expect("fixture keys fit the wire contract"),
                    false,
                    true,
                    vec![],
                ))
                .expect("fixture facts satisfy the wire contract");
            json!({ "id": id, "propertyId": property_id, "projection": projection })
        })
        .collect();
    println!(
        "{}",
        serde_json::to_string(&records).expect("fixture strings serialize")
    );
}
