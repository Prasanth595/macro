//! Declared tag references survive creator acknowledgement and later queue rebuilds.
use cache_core::identity::{IdentityBinding, IdentityMap, remap_patch, remap_updates};
use cache_core::link_patch::{LinkOperation, LinkPathSegment, OptimisticLinkPatch, RecordRoot};
use cache_core::value::{CacheValue, EntityKey, Record};
use serde_json::json;
use std::collections::BTreeMap;

#[test]
fn tag_identity_rebases_embedded_option_ids_without_rewriting_user_content() {
    let bindings = [IdentityBinding {
        local_key: EntityKey("GraphqlPropertyOption:local-tag".into()),
        response_path: vec![],
        delete_record: false,
        reference_fields: vec!["GraphqlSelectOptionPropertyValue.optionIds".into()],
        revalidation_variables: vec![],
    }];
    let identities = IdentityMap::from([(
        bindings[0].local_key.clone(),
        EntityKey("GraphqlPropertyOption:server-tag".into()),
    )]);
    let key = EntityKey("GraphqlProperty:assignment".into());
    let records = BTreeMap::from([(
        key.clone(),
        Record {
            fields: BTreeMap::from([
                ("displayName".into(), CacheValue::String("local-tag".into())),
                (
                    "value".into(),
                    CacheValue::Object(BTreeMap::from([
                        (
                            "__typename".into(),
                            CacheValue::String("GraphqlSelectOptionPropertyValue".into()),
                        ),
                        (
                            "optionIds".into(),
                            CacheValue::List(vec![
                                CacheValue::String("local-tag".into()),
                                CacheValue::String("other-tag".into()),
                            ]),
                        ),
                    ])),
                ),
            ]),
        },
    )]);
    let rewritten = remap_updates(records, &bindings, &identities);
    assert_eq!(
        rewritten[&key].fields["displayName"],
        CacheValue::String("local-tag".into())
    );
    let CacheValue::Object(value) = &rewritten[&key].fields["value"] else {
        panic!("expected embedded value");
    };
    assert_eq!(
        value["optionIds"],
        CacheValue::List(vec![
            CacheValue::String("server-tag".into()),
            CacheValue::String("other-tag".into())
        ])
    );
}

#[test]
fn dependent_link_targets_and_assignment_selectors_follow_the_definition() {
    let binding = IdentityBinding {
        local_key: EntityKey("GraphqlPropertyDefinition:local-definition".into()),
        response_path: vec![],
        delete_record: false,
        reference_fields: vec!["GraphqlProperty.propertyDefinitionId".into()],
        revalidation_variables: vec![],
    };
    let identities = IdentityMap::from([(
        binding.local_key.clone(),
        EntityKey("GraphqlPropertyDefinition:server-definition".into()),
    )]);
    let mut patch = OptimisticLinkPatch {
        query: "fragment Definition on GraphqlPropertyDefinition { id options { id } }".into(),
        operation_name: None,
        variables_json: "{}".into(),
        record_root: Some(RecordRoot {
            fragment_name: "Definition".into(),
            entity_key: binding.local_key.clone(),
        }),
        path: vec![LinkPathSegment::Field {
            field: "options".into(),
        }],
        operation: LinkOperation::UpsertByField {
            entity_key: EntityKey("GraphqlProperty:local-assignment".into()),
            where_field: "propertyDefinitionId".into(),
            equals: json!("local-definition"),
        },
    };
    remap_patch(&mut patch, &[binding], &identities);
    assert_eq!(
        patch.record_root.unwrap().entity_key,
        EntityKey("GraphqlPropertyDefinition:server-definition".into())
    );
    let LinkOperation::UpsertByField { equals, .. } = patch.operation else {
        panic!("expected assignment patch");
    };
    assert_eq!(equals, json!("server-definition"));
}
