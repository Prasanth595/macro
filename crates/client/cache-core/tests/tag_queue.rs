//! First-use tag metadata and dependent assignments survive engine restarts and settlement.
use cache_core::engine::{BeginOptimisticWrite, Engine, ReadResult};
use cache_core::identity::IdentityBinding;
use cache_core::link_patch::{LinkOperation, LinkPathSegment, OptimisticLinkPatch, RecordRoot};
use cache_core::queue::{MutationClaimRequest, MutationClaimToken};
use cache_core::store::InMemoryStorage;
use cache_core::value::EntityKey;
use pollster::block_on;
use serde_json::{Value, json};

const TAGS: &str = include_str!(
    "../../../../apps/web/src/lib/service-clients/service-storage/graphql/tags.graphql"
);
const TASKS: &str = "query Tasks { user { id soup { items { __typename id properties { id propertyDefinitionId value { __typename ... on GraphqlSelectOptionPropertyValue { optionIds } } } } } } }";
const ASSIGN: &str = "mutation Assign($input: UpdateEntityPropertyOptionsInput!) { updateEntityPropertyOptions(input: $input) { id propertyDefinitionId value { __typename ... on GraphqlSelectOptionPropertyValue { optionIds } } } }";
const PARENT: &str =
    "fragment Parent on GraphqlSoupDocument { id properties { id propertyDefinitionId } }";

fn definition(id: &str, options: Value) -> Value {
    json!({"__typename":"GraphqlPropertyDefinition", "id":id, "owner":{"__typename":"GraphqlPropertyDefinitionOwner","scope":"USER","principalId":"user-1"},
        "displayName":"Tags","dataType":"TAG","isMultiSelect":true,"isSystem":false,"isMetadata":false,"specificEntityType":null,
        "createdAt":"2026-10-21T00:00:00Z","updatedAt":"2026-10-21T00:00:00Z","options":options})
}
fn option(definition: &str, id: &str) -> Value {
    json!({"__typename":"GraphqlPropertyOption","id":id,"propertyDefinitionId":definition,"displayOrder":0,
        "value":{"__typename":"GraphqlStringPropertyOptionValue","value":"Offline tag"},"color":"#123456","createdAt":"2026-10-21T00:00:00Z","updatedAt":"2026-10-21T00:00:00Z"})
}
fn binding(key: &str, path: &[&str], references: &[&str]) -> IdentityBinding {
    IdentityBinding {
        local_key: EntityKey(key.to_owned().into()),
        response_path: path.iter().map(|s| s.to_string()).collect(),
        delete_record: false,
        reference_fields: references.iter().map(|s| s.to_string()).collect(),
        revalidation_variables: vec![],
    }
}
async fn read(engine: &mut Engine<InMemoryStorage>, document: &str, name: &str) -> Value {
    let ReadResult::Hit { data, .. } = engine
        .read_query(None, document, Some(name), &Default::default())
        .await
        .unwrap()
    else {
        panic!("cached {name} must remain readable");
    };
    data
}

#[test]
fn create_then_assign_follows_both_identities_after_acknowledgement_and_restart() {
    block_on(async {
        let mut engine = Engine::new(InMemoryStorage::new());
        engine.write_query(None, TAGS, Some("TagCatalog"), &Default::default(), &json!({"user":{"__typename":"GraphqlUser","id":"user-1","tagCatalog":{
            "__typename":"GraphqlTagCatalog","scopes":[{"__typename":"GraphqlTagOwner","scope":"USER","principalId":"user-1"}],"definitions":[]
        }}}), None).await.unwrap();
        engine.write_query(None, TASKS, Some("Tasks"), &Default::default(), &json!({"user":{"id":"user-1","soup":{"items":[{"__typename":"GraphqlSoupDocument","id":"task-1","properties":[]}]}}}), None).await.unwrap();
        let fragments = TAGS.split("query TagCatalog").next().unwrap();
        let ensure_vars =
            json!({"scope":"USER","teamId":null,"clientDefinitionId":"local-definition"})
                .as_object()
                .unwrap()
                .clone();
        let ensure = engine
            .begin_optimistic_write(
                None,
                BeginOptimisticWrite {
                    client_metadata: None,
                    uuid: "00000000-0000-4000-8000-000000000000",
                    query: TAGS,
                    operation_name: Some("EnsureTagSet"),
                    variables: &ensure_vars,
                    data: &json!({"ensureTagSet":definition("local-definition",json!([]))}),
                    identity_bindings: &[binding(
                        "GraphqlPropertyDefinition:local-definition",
                        &["ensureTagSet"],
                        &[
                            "GraphqlPropertyOption.propertyDefinitionId",
                            "GraphqlProperty.propertyDefinitionId",
                        ],
                    )],
                    link_patches: &[OptimisticLinkPatch {
                        query: fragments.into(),
                        operation_name: None,
                        variables_json: "{}".into(),
                        record_root: Some(RecordRoot {
                            fragment_name: "TagCatalogOwner".into(),
                            entity_key: EntityKey("GraphqlUser:user-1".into()),
                        }),
                        path: vec![
                            LinkPathSegment::Field {
                                field: "tagCatalog".into(),
                            },
                            LinkPathSegment::Field {
                                field: "definitions".into(),
                            },
                        ],
                        operation: LinkOperation::PrependUnique {
                            entity_key: EntityKey(
                                "GraphqlPropertyDefinition:local-definition".into(),
                            ),
                        },
                    }],
                    revalidations: &[],
                    created_at_ms: 0,
                },
            )
            .await
            .unwrap()
            .0;
        let create_vars = json!({"input":{"scope":"USER","clientDefinitionId":"local-definition","clientOptionId":"local-option","value":"Offline tag","color":"#123456"}}).as_object().unwrap().clone();
        let option_patch = OptimisticLinkPatch {
            query: TAGS.into(),
            operation_name: None,
            variables_json: "{}".into(),
            record_root: Some(RecordRoot {
                fragment_name: "TagDefinition".into(),
                entity_key: EntityKey("GraphqlPropertyDefinition:local-definition".into()),
            }),
            path: vec![LinkPathSegment::Field {
                field: "options".into(),
            }],
            operation: LinkOperation::PrependUnique {
                entity_key: EntityKey("GraphqlPropertyOption:local-option".into()),
            },
        };
        // A fragment-only recipe uses the same generated definition as the frontend.
        let mut option_patch = option_patch;
        option_patch.query = TAGS.split("query TagCatalog").next().unwrap().to_owned();
        let mut create_definition = definition("local-definition", json!([]));
        create_definition.as_object_mut().unwrap().remove("options");
        let create = engine.begin_optimistic_write(None, BeginOptimisticWrite { client_metadata:None,
            uuid:"11111111-1111-4111-8111-111111111111", query:TAGS, operation_name:Some("CreateTag"), variables:&create_vars,
            data:&json!({"createTag":{"__typename":"GraphqlCreatedTag","definition":create_definition,"option":option("local-definition","local-option")}}),
            identity_bindings:&[binding("GraphqlPropertyDefinition:local-definition", &["createTag","definition"], &["GraphqlPropertyOption.propertyDefinitionId","GraphqlProperty.propertyDefinitionId"]),
                binding("GraphqlPropertyOption:local-option", &["createTag","option"], &["GraphqlSelectOptionPropertyValue.optionIds"])],
            link_patches:&[option_patch], revalidations:&[], created_at_ms:1 }).await.unwrap().0;
        let assignment_vars = json!({"input":{"entityType":"DOCUMENT","entityId":"task-1","properties":[{"propertyDefinitionId":"local-definition","addOptionIds":["local-option"],"removeOptionIds":[]}]}}).as_object().unwrap().clone();
        let assignment_patch = OptimisticLinkPatch {
            query: PARENT.into(),
            operation_name: None,
            variables_json: "{}".into(),
            record_root: Some(RecordRoot {
                fragment_name: "Parent".into(),
                entity_key: EntityKey("GraphqlSoupDocument:task-1".into()),
            }),
            path: vec![LinkPathSegment::Field {
                field: "properties".into(),
            }],
            operation: LinkOperation::UpsertByField {
                entity_key: EntityKey("GraphqlProperty:local-assignment".into()),
                where_field: "propertyDefinitionId".into(),
                equals: json!("local-definition"),
            },
        };
        let assignment = engine.begin_optimistic_write(None, BeginOptimisticWrite { client_metadata:None,
            uuid:"22222222-2222-4222-8222-222222222222", query:ASSIGN, operation_name:Some("Assign"), variables:&assignment_vars,
            data:&json!({"updateEntityPropertyOptions":[{"id":"local-assignment","propertyDefinitionId":"local-definition","value":{"__typename":"GraphqlSelectOptionPropertyValue","optionIds":["local-option"]}}]}),
            identity_bindings:&[binding("GraphqlPropertyDefinition:local-definition", &[], &["GraphqlProperty.propertyDefinitionId"]),
                binding("GraphqlPropertyOption:local-option", &[], &["GraphqlSelectOptionPropertyValue.optionIds"])],
            link_patches:&[assignment_patch], revalidations:&[], created_at_ms:2 }).await.unwrap().0;
        let mut engine = Engine::new(engine.into_storage());
        assert_eq!(
            read(&mut engine, TAGS, "TagCatalog").await["user"]["tagCatalog"]["definitions"][0]["options"]
                [0]["id"],
            "local-option"
        );
        assert_eq!(
            read(&mut engine, TASKS, "Tasks").await["user"]["soup"]["items"][0]["properties"][0]["value"]
                ["optionIds"],
            json!(["local-option"])
        );
        let claim = engine
            .claim_next_mutation(MutationClaimRequest {
                owner: "runner".into(),
                now_ms: 10,
                lease_expires_at_ms: 100,
            })
            .await
            .unwrap()
            .unwrap();
        engine
            .commit_optimistic_write_with_outcome(
                ensure,
                MutationClaimToken {
                    owner: "runner".into(),
                    generation: claim.lease_generation,
                },
                TAGS,
                Some("EnsureTagSet"),
                &ensure_vars,
                &json!({"ensureTagSet":definition("server-definition",json!([]))}),
            )
            .await
            .unwrap();
        let mut engine = Engine::new(engine.into_storage());
        let catalog = read(&mut engine, TAGS, "TagCatalog").await;
        assert_eq!(
            catalog["user"]["tagCatalog"]["definitions"][0]["id"],
            "server-definition"
        );
        assert_eq!(
            catalog["user"]["tagCatalog"]["definitions"][0]["options"][0]["propertyDefinitionId"],
            "server-definition"
        );
        let claim = engine
            .claim_next_mutation(MutationClaimRequest {
                owner: "runner".into(),
                now_ms: 11,
                lease_expires_at_ms: 100,
            })
            .await
            .unwrap()
            .unwrap();
        engine.commit_optimistic_write_with_outcome(create, MutationClaimToken { owner:"runner".into(), generation:claim.lease_generation }, TAGS, Some("CreateTag"), &create_vars,
            &json!({"createTag":{"__typename":"GraphqlCreatedTag","definition":definition("server-definition",json!([option("server-definition","server-option")])),"option":option("server-definition","server-option")}})).await.unwrap();
        let mut engine = Engine::new(engine.into_storage());
        let catalog = read(&mut engine, TAGS, "TagCatalog").await;
        assert_eq!(
            catalog["user"]["tagCatalog"]["definitions"][0]["id"],
            "server-definition"
        );
        assert_eq!(
            catalog["user"]["tagCatalog"]["definitions"][0]["options"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        let tasks = read(&mut engine, TASKS, "Tasks").await;
        let assigned = &tasks["user"]["soup"]["items"][0]["properties"][0];
        assert_eq!(assigned["propertyDefinitionId"], "server-definition");
        assert_eq!(assigned["value"]["optionIds"], json!(["server-option"]));
        let claim = engine
            .claim_next_mutation(MutationClaimRequest {
                owner: "runner".into(),
                now_ms: 12,
                lease_expires_at_ms: 100,
            })
            .await
            .unwrap()
            .unwrap();
        engine.commit_optimistic_write_with_outcome(assignment, MutationClaimToken { owner:"runner".into(), generation:claim.lease_generation }, ASSIGN, Some("Assign"), &assignment_vars,
            &json!({"updateEntityPropertyOptions":[{"__typename":"GraphqlProperty","id":"server-assignment","propertyDefinitionId":"server-definition","value":{"__typename":"GraphqlSelectOptionPropertyValue","optionIds":["server-option"]}}]})).await.unwrap();
        let mut engine = Engine::new(engine.into_storage());
        let tasks = read(&mut engine, TASKS, "Tasks").await;
        assert_eq!(
            tasks["user"]["soup"]["items"][0]["properties"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            tasks["user"]["soup"]["items"][0]["properties"][0]["id"],
            "server-assignment"
        );
        let delete_vars =
            json!({"propertyDefinitionId":"local-definition","optionId":"local-option"})
                .as_object()
                .unwrap()
                .clone();
        let mut deleting = binding(
            "GraphqlPropertyOption:local-option",
            &[],
            &["GraphqlSelectOptionPropertyValue.optionIds"],
        );
        deleting.delete_record = true;
        let delete_patch = OptimisticLinkPatch {
            query: fragments.into(),
            operation_name: None,
            variables_json: "{}".into(),
            record_root: Some(RecordRoot {
                fragment_name: "TagDefinition".into(),
                entity_key: EntityKey("GraphqlPropertyDefinition:local-definition".into()),
            }),
            path: vec![LinkPathSegment::Field {
                field: "options".into(),
            }],
            operation: LinkOperation::Remove {
                entity_key: EntityKey("GraphqlPropertyOption:local-option".into()),
            },
        };
        for attempt in 0..2 {
            let uuid = if attempt == 0 {
                "33333333-3333-4333-8333-333333333333"
            } else {
                "44444444-4444-4444-8444-444444444444"
            };
            let deletion = engine.begin_optimistic_write(None, BeginOptimisticWrite {
                client_metadata: None, uuid, query: TAGS, operation_name: Some("DeleteTag"), variables: &delete_vars,
                data: &json!({"deleteTag":{"graphqlTypeName":"GraphqlPropertyOption","entityId":"local-option"}}),
                identity_bindings: &[binding("GraphqlPropertyDefinition:local-definition", &[], &[]), deleting.clone()],
                link_patches: std::slice::from_ref(&delete_patch), revalidations: &[], created_at_ms: 20 + attempt,
            }).await.unwrap().0;
            engine = Engine::new(engine.into_storage());
            assert!(
                read(&mut engine, TAGS, "TagCatalog").await["user"]["tagCatalog"]["definitions"][0]
                    ["options"]
                    .as_array()
                    .unwrap()
                    .is_empty()
            );
            let claim = engine
                .claim_next_mutation(MutationClaimRequest {
                    owner: "runner".into(),
                    now_ms: 30 + attempt,
                    lease_expires_at_ms: 100,
                })
                .await
                .unwrap()
                .unwrap();
            let token = MutationClaimToken {
                owner: "runner".into(),
                generation: claim.lease_generation,
            };
            if attempt == 0 {
                engine
                    .rollback_optimistic_write_with_outcome(deletion, token)
                    .await
                    .unwrap();
                engine = Engine::new(engine.into_storage());
                assert_eq!(
                    read(&mut engine, TAGS, "TagCatalog").await["user"]["tagCatalog"]["definitions"]
                        [0]["options"][0]["id"],
                    "server-option"
                );
            } else {
                engine.commit_optimistic_write_with_outcome(deletion, token, TAGS, Some("DeleteTag"), &delete_vars,
                    &json!({"deleteTag":{"graphqlTypeName":"GraphqlPropertyOption","entityId":"server-option"}})).await.unwrap();
                engine = Engine::new(engine.into_storage());
                // A delayed catalog response cannot resurrect a committed deletion.
                engine
                    .write_query(
                        None,
                        TAGS,
                        Some("TagCatalog"),
                        &Default::default(),
                        &catalog,
                        None,
                    )
                    .await
                    .unwrap();
                assert!(read(&mut engine,TAGS,"TagCatalog").await["user"]["tagCatalog"]["definitions"][0]["options"].as_array().unwrap().is_empty());
            }
        }
    });
}
