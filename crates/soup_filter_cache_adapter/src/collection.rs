//! Soup document membership coverage over the generic collection engine.

use cache_core::engine::collection::CoverageOutcome;
use cache_core::engine::live_query::{LiveQuerySpec, LiveQueryUpdate};
use cache_core::engine::{Engine, EngineError};
use cache_core::predicate::PredicateIndexStorage;
use cache_core::record_selection::{MAX_RECORD_SELECTION_KEYS, RecordSelectionError};
use cache_core::revision::CacheRevision;
use cache_core::store::Storage;
use cache_core::value::{EntityKey, canonical_json};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const DOCUMENT_PREFIX: &str = "GraphqlSoupDocument:";
const COVERAGE_CONTRACT: &str = "soup-collection-coverage-v1";

/// The server corpus whose membership a scan establishes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum CollectionCoverageScope {
    /// Every document in the Soup corpus.
    Documents {},
    /// The exact filter expression, regardless of sort or pagination.
    Filter {
        /// GraphQL Soup filter input object.
        filters: Map<String, Value>,
    },
}

/// One step of a durable Soup document membership scan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CollectionCoverageRequest {
    /// Start a replacement scan for a corpus.
    Begin {
        /// Cache identity binding.
        user_id: String,
        /// Storage generation bound to the scan.
        storage_generation: Uuid,
        /// Corpus described by this scan.
        scope: CollectionCoverageScope,
    },
    /// Add normalized document identities explicitly returned by the server.
    Append {
        /// Cache identity binding.
        user_id: String,
        /// Storage generation bound to the scan.
        storage_generation: Uuid,
        /// Identifier issued by begin.
        scan_id: Uuid,
        /// Server-returned document keys, bounded to one selection batch.
        #[serde(deserialize_with = "deserialize_keys")]
        keys: Vec<String>,
    },
    /// Publish the completed replacement membership.
    Complete {
        /// Cache identity binding.
        user_id: String,
        /// Storage generation bound to the scan.
        storage_generation: Uuid,
        /// Identifier issued by begin.
        scan_id: Uuid,
    },
    /// Revoke every scan and completed coverage scope.
    Invalidate {},
}

fn valid_document_key(key: &str) -> bool {
    key.strip_prefix(DOCUMENT_PREFIX)
        .is_some_and(|id| !id.is_empty() && !id.contains(':'))
}

fn deserialize_keys<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<String>, D::Error> {
    let keys = Vec::<String>::deserialize(deserializer)?;
    if keys.len() > MAX_RECORD_SELECTION_KEYS || keys.iter().any(|key| !valid_document_key(key)) {
        return Err(serde::de::Error::custom(
            "invalid Soup document coverage keys",
        ));
    }
    Ok(keys)
}

/// Result of a Soup collection coverage mutation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CollectionCoverageResponse {
    /// A scan started at the given cache revision.
    Started {
        /// Scan identifier for append and complete.
        scan_id: Uuid,
        /// Opaque cache revision.
        revision: String,
    },
    /// A metadata mutation committed.
    Committed {
        /// Opaque cache revision.
        revision: String,
    },
    /// The scan witness was stale or incomplete.
    Incomplete {
        /// Opaque cache revision.
        revision: String,
    },
    /// The host cannot establish this scope.
    Unsupported,
}

/// Identity-bound exhaustive read request shared by the hosts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CollectionReadRequest {
    /// Cache identity binding.
    pub user_id: String,
}

/// Stable scope identifier for the complete document corpus.
pub fn all_document_scope_id() -> String {
    format!(
        "{COVERAGE_CONTRACT}:{}:documents",
        item_filter_index::SOUP_FLAT_V6
    )
}

/// Stable scope identifier for one exact Soup filter, independent of sort and pagination.
pub fn exact_filter_scope_id(filters: &Map<String, Value>) -> String {
    let canonical = canonical_json(&Value::Object(filters.clone()));
    let digest = Sha256::digest(canonical.as_bytes());
    format!(
        "{COVERAGE_CONTRACT}:{}:filter:{digest:x}",
        item_filter_index::SOUP_FLAT_V6
    )
}

/// Apply a Soup coverage step through the generic engine.
pub async fn apply_coverage<S: Storage>(
    engine: &mut Engine<S>,
    request: CollectionCoverageRequest,
) -> Result<CollectionCoverageResponse, EngineError<S::Error>> {
    let outcome = match request {
        CollectionCoverageRequest::Begin {
            user_id,
            storage_generation,
            scope,
        } => match scope {
            CollectionCoverageScope::Documents {} => {
                engine
                    .begin_collection_corpus_coverage(
                        &user_id,
                        storage_generation,
                        &all_document_scope_id(),
                        DOCUMENT_PREFIX,
                    )
                    .await?
            }
            CollectionCoverageScope::Filter { filters } => {
                let scope_id = exact_filter_scope_id(&filters);
                let Ok(crate::SoupFilterCompileOutcome::Supported(predicate)) =
                    crate::compile_current_filter_request(
                        Value::Object(filters),
                        "UPDATED_AT",
                        "DESC",
                        1,
                    )
                else {
                    return Ok(CollectionCoverageResponse::Unsupported);
                };
                engine
                    .begin_filtered_collection_coverage(
                        &user_id,
                        storage_generation,
                        &scope_id,
                        DOCUMENT_PREFIX,
                        predicate,
                    )
                    .await?
            }
        },
        CollectionCoverageRequest::Append {
            user_id,
            storage_generation,
            scan_id,
            keys,
        } => {
            if keys.len() > MAX_RECORD_SELECTION_KEYS {
                return Err(RecordSelectionError::TooManyKeys {
                    count: keys.len(),
                    max: MAX_RECORD_SELECTION_KEYS,
                }
                .into());
            }
            if keys.iter().any(|key| !valid_document_key(key)) {
                return Err(RecordSelectionError::InvalidKey.into());
            }
            let keys: Vec<_> = keys
                .iter()
                .map(|key| EntityKey(key.as_str().into()))
                .collect();
            engine
                .append_collection_coverage(&user_id, storage_generation, scan_id, &keys)
                .await?
        }
        CollectionCoverageRequest::Complete {
            user_id,
            storage_generation,
            scan_id,
        } => {
            engine
                .complete_collection_coverage(&user_id, storage_generation, scan_id)
                .await?
        }
        CollectionCoverageRequest::Invalidate {} => engine.invalidate_collection_coverage().await?,
    };
    Ok(match outcome {
        CoverageOutcome::Started { scan_id, revision } => CollectionCoverageResponse::Started {
            scan_id,
            revision: revision.to_string(),
        },
        CoverageOutcome::Committed { revision } => CollectionCoverageResponse::Committed {
            revision: revision.to_string(),
        },
        CoverageOutcome::Incomplete { revision } => CollectionCoverageResponse::Incomplete {
            revision: revision.to_string(),
        },
    })
}

/// Read the newest matching complete broad or exact-filter scope without a page limit.
pub async fn read_collection<S: PredicateIndexStorage>(
    engine: &mut Engine<S>,
    id: &str,
    spec: LiveQuerySpec,
    user_id: &str,
    filters: &Map<String, Value>,
    since: Option<CacheRevision>,
) -> Result<Option<LiveQueryUpdate>, EngineError<S::Error>> {
    engine
        .read_collection_live_query(
            id,
            spec,
            user_id,
            &[all_document_scope_id(), exact_filter_scope_id(filters)],
            since,
        )
        .await
}

#[cfg(test)]
mod test;
