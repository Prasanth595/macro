use super::*;
use crate::store::InMemoryStorage;
use pollster::block_on;

#[test]
fn exhaustive_reads_missing_records_and_record_updates() {
    use predicate_index::{
        ExactFact, ExactValue, IndexDocument, IndexQuery, IntegerFact, PartitionPredicate,
        PredicateExpr, Profile, Token,
    };
    use std::sync::Arc;
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let token = |text: &str| Token::new(text).unwrap();
        let spec = live_query::LiveQuerySpec {
            query: ValidatedIndexQuery::new(IndexQuery {
                profile: Profile::new(token("collection-test")),
                partitions: vec![PartitionPredicate {
                    partition: token("email"),
                    predicate: PredicateExpr::Exact {
                        attribute: token("read"),
                        value: ExactValue::utf8("false").unwrap(),
                    },
                }],
                sort_attribute: token("sort"),
                sort_direction: SortDirection::Desc,
                tie_break_direction: SortDirection::Desc,
                limit: 1,
            })
            .unwrap(),
            baseline: vec![],
            selection: Arc::new(
                RecordSelection::parse(
                    crate::meta::bundled_schema_ref(),
                    "fragment Item on GraphqlSoupEmailThread { id read: isRead }",
                    "Item",
                )
                .unwrap(),
            ),
        };
        let CoverageOutcome::Started { scan_id, .. } = engine
            .begin_collection_coverage("alice", generation, "v1", "GraphqlSoupEmailThread:")
            .await
            .unwrap()
        else {
            panic!()
        };
        let keys: Vec<_> = (0..5_002)
            .map(|n| EntityKey::entity("GraphqlSoupEmailThread", &[&n.to_string()]))
            .collect();
        for chunk in keys.chunks(BATCH) {
            engine
                .append_collection_coverage("alice", generation, scan_id, chunk)
                .await
                .unwrap();
        }
        engine
            .complete_collection_coverage("alice", generation, scan_id)
            .await
            .unwrap();
        assert!(
            engine
                .read_collection_live_query("read", spec.clone(), "alice", &["v1".into()], None)
                .await
                .unwrap()
                .is_none()
        );
        let entries = keys
            .iter()
            .enumerate()
            .map(|(n, key)| {
                (
                    key.clone(),
                    Record {
                        fields: BTreeMap::from([
                            (
                                "__typename".into(),
                                CacheValue::String("GraphqlSoupEmailThread".into()),
                            ),
                            ("id".into(), CacheValue::String(n.to_string())),
                            ("isRead".into(), CacheValue::Bool(false)),
                        ]),
                    },
                )
            })
            .collect();
        let projections = keys
            .iter()
            .enumerate()
            .map(|(n, key)| {
                ProjectionMutation::Replace(IndexDocument {
                    record_key: RecordKey::new(key.to_string()).unwrap(),
                    profile: Profile::new(token("collection-test")),
                    partition: token("email"),
                    exact_facts: vec![ExactFact {
                        attribute: token("read"),
                        value: ExactValue::utf8("false").unwrap(),
                    }],
                    integer_facts: vec![],
                    sort_facts: vec![IntegerFact {
                        attribute: token("sort"),
                        value: n as i64,
                    }],
                })
            })
            .collect();
        engine
            .put_records_with_projections(None, entries, projections)
            .await
            .unwrap();
        let first = engine
            .read_collection_live_query("read", spec.clone(), "alice", &["v1".into()], None)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(first.keys.as_ref().unwrap().len(), 5_002);
        assert_eq!(first.upserts.len(), 5_002);
        engine
            .put_records_with_projections(
                None,
                vec![(
                    keys[0].clone(),
                    Record {
                        fields: BTreeMap::from([("isRead".into(), CacheValue::Bool(true))]),
                    },
                )],
                vec![],
            )
            .await
            .unwrap();
        let next = engine
            .read_collection_live_query(
                "read",
                spec.clone(),
                "alice",
                &["v1".into()],
                Some(first.revision.parse().unwrap()),
            )
            .await
            .unwrap()
            .unwrap();
        assert_eq!(next.patches.len(), 1);
        engine.release_live_query("read");
        let released = engine
            .read_collection_live_query(
                "read",
                spec.clone(),
                "alice",
                &["v1".into()],
                Some(next.revision.parse().unwrap()),
            )
            .await
            .unwrap()
            .unwrap();
        assert!(released.reset);

        let variables = serde_json::json!({"input":{"threadId":"new"}})
            .as_object()
            .unwrap()
            .clone();
        let (transaction, _) = engine.begin_optimistic_write_with_projections(None, BeginOptimisticWrite {
            client_metadata: None,
            uuid: "00000000-0000-4000-8000-000000000001",
            query: "mutation Read($input: MarkEmailThreadSeenInput!) { markEmailThreadSeen(input: $input) { id isRead } }",
            operation_name: None,
            variables: &variables,
            data: &serde_json::json!({"markEmailThreadSeen":{"id":"new","isRead":false}}),
            link_patches: &[], revalidations: &[], identity_bindings: &[], created_at_ms: 0,
        }, vec![predicate_index::OptimisticProjectionMutation::Replace(IndexDocument {
            record_key: RecordKey::new("GraphqlSoupEmailThread:new").unwrap(),
            profile: Profile::new(token("collection-test")), partition: token("email"),
            exact_facts: vec![ExactFact { attribute: token("read"), value: ExactValue::utf8("false").unwrap() }],
            integer_facts: vec![], sort_facts: vec![IntegerFact { attribute: token("sort"), value: 9_999 }],
        })]).await.unwrap();
        let pending = engine
            .read_collection_live_query(
                "read",
                spec.clone(),
                "alice",
                &["v1".into()],
                Some(released.revision.parse().unwrap()),
            )
            .await
            .unwrap()
            .unwrap();
        assert!(pending.optimistic);
        assert_eq!(pending.keys.as_ref().unwrap().len(), 5_003);
        assert!(
            pending
                .upserts
                .iter()
                .any(|row| row.record_key.as_ref() == "GraphqlSoupEmailThread:new")
        );
        let claim = engine
            .claim_next_mutation(MutationClaimRequest {
                owner: "test".into(),
                now_ms: 1,
                lease_expires_at_ms: 100,
            })
            .await
            .unwrap()
            .unwrap();
        engine
            .rollback_optimistic_write(
                transaction,
                MutationClaimToken {
                    owner: "test".into(),
                    generation: claim.lease_generation,
                },
            )
            .await
            .unwrap();
        let rollback = engine
            .read_collection_live_query(
                "read",
                spec,
                "alice",
                &["v1".into()],
                Some(pending.revision.parse().unwrap()),
            )
            .await
            .unwrap()
            .unwrap();
        assert!(!rollback.optimistic);
        assert_eq!(rollback.keys.as_ref().unwrap().len(), 5_002);
        assert!(
            rollback
                .removed
                .iter()
                .any(|key| key.as_ref() == "GraphqlSoupEmailThread:new")
        );
    });
}

#[test]
fn interrupted_replacement_empty_completion_and_stale_scan() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let CoverageOutcome::Started { scan_id: first, .. } = engine
            .begin_collection_coverage("alice", generation, "scope-v1", "Thing:")
            .await
            .unwrap()
        else {
            panic!()
        };
        engine
            .append_collection_coverage(
                "alice",
                generation,
                first,
                &[EntityKey::entity("Thing", &["one"])],
            )
            .await
            .unwrap();
        let CoverageOutcome::Started {
            scan_id: second, ..
        } = engine
            .begin_collection_coverage("alice", generation, "scope-v1", "Thing:")
            .await
            .unwrap()
        else {
            panic!()
        };
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, second)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, first)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
        let catalog = engine.load_collection_catalog().await.unwrap().unwrap();
        assert!(catalog.scopes["scope-v1"].members.is_empty());
    });
}

#[test]
fn concurrent_scopes_do_not_cancel_each_other() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let CoverageOutcome::Started { scan_id: left, .. } = engine
            .begin_collection_coverage("alice", generation, "left-v1", "Thing:")
            .await
            .unwrap()
        else {
            panic!()
        };
        let CoverageOutcome::Started { scan_id: right, .. } = engine
            .begin_collection_coverage("alice", generation, "right-v1", "Thing:")
            .await
            .unwrap()
        else {
            panic!()
        };
        engine
            .complete_collection_coverage("alice", generation, right)
            .await
            .unwrap();
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, left)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
        let catalog = engine.load_collection_catalog().await.unwrap().unwrap();
        assert_eq!(catalog.scopes.len(), 2);
    });
}

#[test]
fn identity_generation_and_invalidation_fence_scans() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let CoverageOutcome::Started { scan_id, .. } = engine
            .begin_collection_coverage("alice", generation, "s", "Thing:")
            .await
            .unwrap()
        else {
            panic!()
        };
        assert!(matches!(
            engine
                .complete_collection_coverage("bob", generation, scan_id)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", Uuid::now_v7(), scan_id)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
        engine.invalidate_collection_coverage().await.unwrap();
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, scan_id)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
    });
}

#[test]
fn candidates_require_explicit_append_and_membership_is_not_truncated() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let CoverageOutcome::Started { scan_id, .. } = engine
            .begin_collection_coverage("alice", generation, "s", "Thing:")
            .await
            .unwrap()
        else {
            panic!()
        };
        let keys: Vec<_> = (0..5_101)
            .map(|n| EntityKey::entity("Thing", &[&n.to_string()]))
            .collect();
        for chunk in keys.chunks(BATCH) {
            engine
                .append_collection_coverage("alice", generation, scan_id, chunk)
                .await
                .unwrap();
        }
        engine
            .complete_collection_coverage("alice", generation, scan_id)
            .await
            .unwrap();
        assert_eq!(
            engine
                .load_collection_catalog()
                .await
                .unwrap()
                .unwrap()
                .scopes["s"]
                .members
                .len(),
            5_101
        );
        let CoverageOutcome::Started {
            scan_id: replacement,
            ..
        } = engine
            .begin_collection_coverage("alice", generation, "s", "Thing:")
            .await
            .unwrap()
        else {
            panic!()
        };
        engine
            .fence_collection_candidates([EntityKey::entity("Thing", &["new"])])
            .await
            .unwrap();
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, replacement)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
        engine
            .append_collection_coverage(
                "alice",
                generation,
                replacement,
                &[EntityKey::entity("Thing", &["new"])],
            )
            .await
            .unwrap();
        engine
            .complete_collection_coverage("alice", generation, replacement)
            .await
            .unwrap();
        let catalog = engine.load_collection_catalog().await.unwrap().unwrap();
        assert_eq!(catalog.scopes["s"].members.len(), 1);
        assert!(catalog.scopes["s"].members.contains("Thing:new"));
    });
}

#[test]
fn a_cold_scan_waits_for_the_first_server_identity_witness() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        let generation = engine.current_storage_generation().await.unwrap();
        let CoverageOutcome::Started { scan_id, .. } = engine
            .begin_collection_coverage("alice", generation, "scope", "Thing:")
            .await
            .unwrap()
        else {
            panic!("cold scans must start before hydration");
        };
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, scan_id)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
        engine.bind_identity("alice").await.unwrap();
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, scan_id)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
    });
}

#[test]
fn newer_concurrent_scans_can_replace_an_earlier_completion() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let CoverageOutcome::Started { scan_id: older, .. } = engine
            .begin_collection_coverage("alice", generation, "scope", "Thing:")
            .await
            .unwrap()
        else {
            panic!();
        };
        let CoverageOutcome::Started { scan_id: newer, .. } = engine
            .begin_collection_coverage("alice", generation, "scope", "Thing:")
            .await
            .unwrap()
        else {
            panic!();
        };
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, older)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, newer)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
    });
}

#[test]
fn abandoned_scans_and_old_scopes_do_not_exhaust_future_coverage() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        for index in 0..MAX_SCOPES + 4 {
            let CoverageOutcome::Started { scan_id, .. } = engine
                .begin_collection_coverage(
                    "alice",
                    generation,
                    &format!("abandoned-{index}"),
                    "Thing:",
                )
                .await
                .unwrap()
            else {
                panic!("abandoned scans must be evictable");
            };
            if index == MAX_SCOPES + 3 {
                assert!(matches!(
                    engine
                        .complete_collection_coverage("alice", generation, scan_id)
                        .await
                        .unwrap(),
                    CoverageOutcome::Committed { .. }
                ));
            }
        }
        for index in 0..MAX_SCOPES + 4 {
            let CoverageOutcome::Started { scan_id, .. } = engine
                .begin_collection_coverage(
                    "alice",
                    generation,
                    &format!("completed-{index}"),
                    "Thing:",
                )
                .await
                .unwrap()
            else {
                panic!("completed scopes must be evictable");
            };
            assert!(matches!(
                engine
                    .complete_collection_coverage("alice", generation, scan_id)
                    .await
                    .unwrap(),
                CoverageOutcome::Committed { .. }
            ));
        }
        assert_eq!(
            engine
                .load_collection_catalog()
                .await
                .unwrap()
                .unwrap()
                .scopes
                .len(),
            MAX_SCOPES
        );
    });
}

#[test]
fn invalidation_allows_a_fresh_scan_and_corrupt_optional_metadata_does_not_block_writes() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        engine
            .invalidate_keys([&EntityKey::entity("Thing", &["gone"])])
            .unwrap();
        let CoverageOutcome::Started { scan_id, .. } = engine
            .begin_collection_coverage("alice", generation, "scope", "Thing:")
            .await
            .unwrap()
        else {
            panic!("fresh scans must recover after invalidation");
        };
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, scan_id)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
        engine
            .storage
            .put_batch(vec![(
                EntityKey(CATALOG_KEY.into()),
                Record {
                    fields: BTreeMap::from([(
                        CATALOG_FIELD.into(),
                        CacheValue::String("{broken".into()),
                    )]),
                },
            )])
            .await
            .unwrap();
        engine
            .put_records_with_projections(
                None,
                vec![(EntityKey::entity("Thing", &["new"]), Record::default())],
                vec![],
            )
            .await
            .unwrap();
        let CoverageOutcome::Started { scan_id, .. } = engine
            .begin_collection_coverage("alice", generation, "scope", "Thing:")
            .await
            .unwrap()
        else {
            panic!("a new scan must repair optional coverage metadata");
        };
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, scan_id)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
    });
}

#[test]
fn a_full_corpus_replaces_filtered_access_evidence_without_deleting_records() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let key = EntityKey::entity("Thing", &["revoked"]);
        engine
            .storage
            .put_batch(vec![(key.clone(), Record::default())])
            .await
            .unwrap();
        let CoverageOutcome::Started { scan_id: old, .. } = engine
            .begin_collection_coverage("alice", generation, "filtered", "Thing:")
            .await
            .unwrap()
        else {
            panic!();
        };
        engine
            .append_collection_coverage("alice", generation, old, std::slice::from_ref(&key))
            .await
            .unwrap();
        engine
            .complete_collection_coverage("alice", generation, old)
            .await
            .unwrap();
        let CoverageOutcome::Started {
            scan_id: pending, ..
        } = engine
            .begin_collection_coverage("alice", generation, "in-flight", "Thing:")
            .await
            .unwrap()
        else {
            panic!();
        };
        let CoverageOutcome::Started {
            scan_id: corpus, ..
        } = engine
            .begin_collection_corpus_coverage("alice", generation, "all", "Thing:")
            .await
            .unwrap()
        else {
            panic!();
        };
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, corpus)
                .await
                .unwrap(),
            CoverageOutcome::Committed { .. }
        ));
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, pending)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
        let catalog = engine.load_collection_catalog().await.unwrap().unwrap();
        assert_eq!(
            catalog
                .scopes
                .keys()
                .map(String::as_str)
                .collect::<Vec<_>>(),
            ["all"]
        );
        assert!(engine.storage.get_batch(&[key]).await.unwrap()[0].is_some());
    });
}

#[test]
fn an_older_corpus_scan_cannot_replace_newer_filtered_membership() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.bind_identity("alice").await.unwrap();
        let generation = engine.current_storage_generation().await.unwrap();
        let key = EntityKey::entity("Thing", &["revoked"]);
        engine
            .storage
            .put_batch(vec![(key.clone(), Record::default())])
            .await
            .unwrap();
        let CoverageOutcome::Started {
            scan_id: corpus, ..
        } = engine
            .begin_collection_corpus_coverage("alice", generation, "all", "Thing:")
            .await
            .unwrap()
        else {
            panic!();
        };
        engine
            .append_collection_coverage("alice", generation, corpus, &[key])
            .await
            .unwrap();
        let CoverageOutcome::Started {
            scan_id: filtered, ..
        } = engine
            .begin_collection_coverage("alice", generation, "filtered", "Thing:")
            .await
            .unwrap()
        else {
            panic!();
        };
        engine
            .complete_collection_coverage("alice", generation, filtered)
            .await
            .unwrap();
        assert!(matches!(
            engine
                .complete_collection_coverage("alice", generation, corpus)
                .await
                .unwrap(),
            CoverageOutcome::Incomplete { .. }
        ));
        let catalog = engine.load_collection_catalog().await.unwrap().unwrap();
        assert!(catalog.scopes.contains_key("filtered"));
        assert!(!catalog.scopes.contains_key("all"));
    });
}
