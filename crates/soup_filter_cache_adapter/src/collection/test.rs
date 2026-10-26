use super::*;
use serde_json::json;

#[test]
fn canonical_scope_ignores_object_key_order_at_every_depth() {
    let left = json!({"tags": [{"b": 2, "a": {"z": 1, "c": 3}}], "owner": "alice"});
    let right = json!({"owner": "alice", "tags": [{"a": {"c": 3, "z": 1}, "b": 2}]});
    assert_eq!(
        exact_filter_scope_id(left.as_object().unwrap()),
        exact_filter_scope_id(right.as_object().unwrap())
    );
    assert_ne!(
        all_document_scope_id(),
        exact_filter_scope_id(left.as_object().unwrap())
    );
    assert!(all_document_scope_id().contains(item_filter_index::SOUP_FLAT_V6));
}

#[test]
fn membership_changing_filters_produce_distinct_scopes() {
    let base = json!({"ownedBy": "alice", "document": {"includeSnippets": true}});
    let other_owner = json!({"ownedBy": "bob", "document": {"includeSnippets": true}});
    let other_document = json!({"ownedBy": "alice", "document": {"includeSnippets": false}});
    assert_ne!(
        exact_filter_scope_id(base.as_object().unwrap()),
        exact_filter_scope_id(other_owner.as_object().unwrap())
    );
    assert_ne!(
        exact_filter_scope_id(base.as_object().unwrap()),
        exact_filter_scope_id(other_document.as_object().unwrap())
    );
}

#[test]
fn wire_rejects_extra_fields_invalid_keys_and_oversized_batches() {
    assert!(
        serde_json::from_value::<CollectionCoverageRequest>(json!({
            "kind": "begin", "userId": "alice", "storageGeneration": Uuid::nil(),
            "scope": {"kind": "documents", "filters": {}},
        }))
        .is_err()
    );
    assert!(
        serde_json::from_value::<CollectionCoverageRequest>(json!({
            "kind": "invalidate", "userId": "alice",
        }))
        .is_err()
    );
    for keys in [
        json!(["GraphqlSoupDocument:"]),
        json!(["GraphqlSoupProject:abc"]),
        json!(vec![
            "GraphqlSoupDocument:id";
            MAX_RECORD_SELECTION_KEYS + 1
        ]),
    ] {
        assert!(
            serde_json::from_value::<CollectionCoverageRequest>(json!({
                "kind": "append", "userId": "alice", "storageGeneration": Uuid::nil(),
                "scanId": Uuid::nil(), "keys": keys,
            }))
            .is_err()
        );
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[test]
fn exhaustive_read_uses_real_soup_document_facts_and_latest_scope() {
    use cache_core::engine::Engine;
    use cache_core::engine::live_query::LiveQuerySpec;
    use cache_core::predicate::ProjectionMutation;
    use cache_core::record_selection::RecordSelection;
    use cache_core::store::InMemoryStorage;
    use cache_core::value::{CacheValue, Record};
    use std::collections::BTreeMap;
    use std::sync::Arc;

    pollster::block_on(async {
        let user = "macro|phase-0@example.com";
        let id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        let key = format!("GraphqlSoupDocument:{id}");
        let filters = crate::test::production_documents_filters(json!({
            "literal": {"owner": user}
        }));
        let crate::SoupFilterCompileOutcome::Supported(query) =
            crate::compile_current_filter_request(filters.clone(), "UPDATED_AT", "DESC", 1)
                .unwrap()
        else {
            panic!("document filter must compile");
        };
        let spec = LiveQuerySpec {
            query,
            baseline: vec![],
            selection: Arc::new(
                RecordSelection::parse(
                    cache_core::meta::bundled_schema_ref(),
                    "fragment Doc on GraphqlSoupDocument { id }",
                    "Doc",
                )
                .unwrap(),
            ),
        };
        let mut engine = Engine::new(InMemoryStorage::new());
        engine
            .write_query(
                None,
                "query { __typename }",
                None,
                &Map::new(),
                &json!({"__typename": "Query"}),
                Some(user),
            )
            .await
            .unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let record = Record {
            fields: BTreeMap::from([
                (
                    "__typename".into(),
                    CacheValue::String("GraphqlSoupDocument".into()),
                ),
                ("id".into(), CacheValue::String(id.into())),
            ]),
        };
        let mut document = crate::test::differential_document(id, user, false, None, 1);
        document.profile = item_filter_index::vocabulary::profile_v6();
        engine
            .put_records_with_projections(
                None,
                vec![(EntityKey(key.clone().into()), record)],
                vec![ProjectionMutation::Replace(document)],
            )
            .await
            .unwrap();
        let filters = filters.as_object().unwrap();
        assert!(
            read_collection(&mut engine, "documents", spec.clone(), user, filters, None)
                .await
                .unwrap()
                .is_none()
        );
        let CollectionCoverageResponse::Started { scan_id, .. } = apply_coverage(
            &mut engine,
            CollectionCoverageRequest::Begin {
                user_id: user.into(),
                storage_generation: generation,
                scope: CollectionCoverageScope::Documents {},
            },
        )
        .await
        .unwrap() else {
            panic!()
        };
        apply_coverage(
            &mut engine,
            CollectionCoverageRequest::Append {
                user_id: user.into(),
                storage_generation: generation,
                scan_id,
                keys: vec![key.clone()],
            },
        )
        .await
        .unwrap();
        apply_coverage(
            &mut engine,
            CollectionCoverageRequest::Complete {
                user_id: user.into(),
                storage_generation: generation,
                scan_id,
            },
        )
        .await
        .unwrap();
        let broad = read_collection(&mut engine, "documents", spec.clone(), user, filters, None)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(broad.keys.unwrap().len(), 1);
        let CollectionCoverageResponse::Started { scan_id, .. } = apply_coverage(
            &mut engine,
            CollectionCoverageRequest::Begin {
                user_id: user.into(),
                storage_generation: generation,
                scope: CollectionCoverageScope::Filter {
                    filters: filters.clone(),
                },
            },
        )
        .await
        .unwrap() else {
            panic!()
        };
        apply_coverage(
            &mut engine,
            CollectionCoverageRequest::Complete {
                user_id: user.into(),
                storage_generation: generation,
                scan_id,
            },
        )
        .await
        .unwrap();
        let exact = read_collection(&mut engine, "documents", spec, user, filters, None)
            .await
            .unwrap()
            .unwrap();
        assert!(exact.keys.unwrap().is_empty());
    });
}

#[cfg(not(target_arch = "wasm32"))]
#[test]
fn filtered_scans_ignore_proven_nonmatches_but_never_invent_new_collection_members() {
    use cache_core::engine::live_query::LiveQuerySpec;
    use cache_core::predicate::ProjectionMutation;
    use cache_core::record_selection::RecordSelection;
    use cache_core::store::InMemoryStorage;
    use cache_core::value::{CacheValue, Record};
    use std::collections::BTreeMap;
    use std::sync::Arc;
    pollster::block_on(async {
        let user = "macro|phase-0@example.com";
        let other = "macro|other@example.com";
        let own_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        let other_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
        let third_id = "cccccccc-cccc-cccc-cccc-cccccccccccc";
        let filters = crate::test::production_documents_filters(json!({"literal":{"owner":user}}));
        let crate::SoupFilterCompileOutcome::Supported(query) =
            crate::compile_current_filter_request(filters.clone(), "UPDATED_AT", "DESC", 1)
                .unwrap()
        else {
            panic!();
        };
        let spec = LiveQuerySpec {
            query,
            baseline: vec![],
            selection: Arc::new(
                RecordSelection::parse(
                    cache_core::meta::bundled_schema_ref(),
                    "fragment Doc on GraphqlSoupDocument { id }",
                    "Doc",
                )
                .unwrap(),
            ),
        };
        let mut engine = Engine::new(InMemoryStorage::new());
        engine
            .write_query(
                None,
                "query { __typename }",
                None,
                &Map::new(),
                &json!({"__typename":"Query"}),
                Some(user),
            )
            .await
            .unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let response = apply_coverage(
            &mut engine,
            serde_json::from_value(json!({
                "kind":"begin", "userId":user, "storageGeneration":generation,
                "scope":{"kind":"filter", "filters":filters},
            }))
            .unwrap(),
        )
        .await
        .unwrap();
        assert!(
            serde_json::to_value(&response)
                .unwrap()
                .get("scanId")
                .is_some()
        );
        let CollectionCoverageResponse::Started { scan_id, .. } = response else {
            panic!("wire requests must start a filtered scan");
        };
        let record = |id: &str| {
            (
                EntityKey(format!("GraphqlSoupDocument:{id}").into()),
                Record {
                    fields: BTreeMap::from([
                        (
                            "__typename".into(),
                            CacheValue::String("GraphqlSoupDocument".into()),
                        ),
                        ("id".into(), CacheValue::String(id.into())),
                    ]),
                },
            )
        };
        let projection = |id: &str, owner: &str| {
            let mut document = crate::test::differential_document(id, owner, false, None, 1);
            document.profile = item_filter_index::vocabulary::profile_v6();
            ProjectionMutation::Replace(document)
        };
        engine
            .put_records_with_projections(
                None,
                vec![record(own_id), record(other_id)],
                vec![projection(own_id, user), projection(other_id, other)],
            )
            .await
            .unwrap();
        apply_coverage(
            &mut engine,
            CollectionCoverageRequest::Append {
                user_id: user.into(),
                storage_generation: generation,
                scan_id,
                keys: vec![format!("GraphqlSoupDocument:{own_id}")],
            },
        )
        .await
        .unwrap();
        assert!(matches!(
            apply_coverage(
                &mut engine,
                CollectionCoverageRequest::Complete {
                    user_id: user.into(),
                    storage_generation: generation,
                    scan_id,
                }
            )
            .await
            .unwrap(),
            CollectionCoverageResponse::Committed { .. }
        ));
        let filters = filters.as_object().unwrap();
        let first = read_collection(&mut engine, "owned", spec.clone(), user, filters, None)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(first.upserts.len(), 1);
        engine
            .put_records_with_projections(
                None,
                vec![record(third_id)],
                vec![projection(third_id, other)],
            )
            .await
            .unwrap();
        assert!(
            read_collection(
                &mut engine,
                "owned",
                spec.clone(),
                user,
                filters,
                Some(first.revision.parse().unwrap())
            )
            .await
            .unwrap()
            .is_some()
        );
        engine
            .put_records_with_projections(
                None,
                vec![record(other_id)],
                vec![projection(other_id, user)],
            )
            .await
            .unwrap();
        assert!(
            read_collection(&mut engine, "owned", spec, user, filters, None)
                .await
                .unwrap()
                .is_none()
        );
    });
}
