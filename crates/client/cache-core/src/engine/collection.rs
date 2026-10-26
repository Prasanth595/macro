//! Durable, caller-scoped exhaustive membership evidence.
//! Scope identifiers include the caller's contract and profile version.
//!
//! # Host ownership contract
//! The host must keep one engine writer for the storage lifetime.
//! Retire an engine before another engine changes or resets its storage.
//! Independent engines over shared mutable storage require atomic catalog fencing.
use super::*;
use crate::predicate::reconciliation::{PredicateMembership, predicate_membership};
use crate::value::CacheValue;
use predicate_index::{RecordKey, SortDirection};
use serde::{Deserialize, Serialize};

const CATALOG_KEY: &str = "__meta:collection-coverage:v1";
const CATALOG_FIELD: &str = "catalog";
const MAX_SCOPES: usize = 32;
const BATCH: usize = MAX_RECORD_SELECTION_KEYS;

#[derive(Default, Clone, Serialize, Deserialize)]
struct Catalog {
    epoch: u64,
    sequence: u64,
    scopes: BTreeMap<String, Scope>,
    scans: BTreeMap<String, Scan>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Scope {
    user: String,
    generation: Uuid,
    prefix: String,
    epoch: u64,
    sequence: u64,
    members: BTreeSet<String>,
    // An unattributed write revokes completed authority until another scan succeeds.
    uncertain: bool,
    #[serde(default)]
    candidates: BTreeSet<String>,
    #[serde(default)]
    predicate: Option<ValidatedIndexQuery>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Scan {
    scope: String,
    user: String,
    generation: Uuid,
    prefix: String,
    epoch: u64,
    started_after: u64,
    members: BTreeSet<String>,
    candidates: BTreeSet<String>,
    #[serde(default)]
    predicate: Option<ValidatedIndexQuery>,
    #[serde(default)]
    entire_prefix: bool,
}

/// Effective-view revisions advance when completed coverage changes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoverageOutcome {
    Started {
        scan_id: Uuid,
        revision: CacheRevision,
    },
    Committed {
        revision: CacheRevision,
    },
    Incomplete {
        revision: CacheRevision,
    },
}

impl<S: Storage> Engine<S> {
    async fn load_collection_catalog(&self) -> Result<Option<Catalog>, EngineError<S::Error>> {
        let records = self
            .storage
            .get_batch(&[EntityKey(CATALOG_KEY.into())])
            .await
            .map_err(EngineError::Storage)?;
        Ok(match records.first().and_then(Option::as_ref) {
            None => Some(Catalog::default()),
            Some(record) => match record.fields.get(CATALOG_FIELD) {
                Some(CacheValue::String(data)) => serde_json::from_str::<Catalog>(data)
                    .ok()
                    .filter(|catalog| {
                        catalog.scopes.len() <= MAX_SCOPES && catalog.scans.len() <= MAX_SCOPES
                    }),
                _ => None,
            },
        })
    }

    async fn save_collection_catalog(
        &mut self,
        catalog: &Catalog,
        notify: bool,
    ) -> Result<CacheRevision, EngineError<S::Error>> {
        if notify {
            self.ensure_revision_can_advance()?;
        }
        let data = serde_json::to_string(catalog).expect("collection catalog serializes");
        let record = Record {
            fields: BTreeMap::from([(CATALOG_FIELD.into(), CacheValue::String(data))]),
        };
        self.storage
            .put_batch(vec![(EntityKey(CATALOG_KEY.into()), record)])
            .await
            .map_err(EngineError::Storage)?;
        if !notify {
            return Ok(self.revision);
        }
        let revision = self.advance_revision()?;
        self.live_queries
            .record(revision, live_query::Changes::default());
        Ok(revision)
    }

    async fn collection_witness(
        &mut self,
        user: &str,
        generation: Uuid,
    ) -> Result<bool, EngineError<S::Error>> {
        Ok(!user.is_empty()
            && self.current_identity().await?.as_deref() == Some(user)
            && self.current_storage_generation().await? == generation)
    }

    /// Starts a replacement scan without removing the last completed membership.
    pub async fn begin_collection_coverage(
        &mut self,
        user_id: &str,
        storage_generation: Uuid,
        scope_id: &str,
        member_prefix: &str,
    ) -> Result<CoverageOutcome, EngineError<S::Error>> {
        self.begin_collection_coverage_for(
            user_id,
            storage_generation,
            scope_id,
            member_prefix,
            None,
            false,
        )
        .await
    }

    /// Starts an exact-filter scan that can exclude proven nonmatching concurrent candidates.
    pub async fn begin_filtered_collection_coverage(
        &mut self,
        user_id: &str,
        storage_generation: Uuid,
        scope_id: &str,
        member_prefix: &str,
        predicate: ValidatedIndexQuery,
    ) -> Result<CoverageOutcome, EngineError<S::Error>> {
        self.begin_collection_coverage_for(
            user_id,
            storage_generation,
            scope_id,
            member_prefix,
            Some(predicate),
            false,
        )
        .await
    }

    /// Starts a full corpus scan that supersedes older coverage for the same member prefix.
    pub async fn begin_collection_corpus_coverage(
        &mut self,
        user_id: &str,
        storage_generation: Uuid,
        scope_id: &str,
        member_prefix: &str,
    ) -> Result<CoverageOutcome, EngineError<S::Error>> {
        self.begin_collection_coverage_for(
            user_id,
            storage_generation,
            scope_id,
            member_prefix,
            None,
            true,
        )
        .await
    }

    async fn begin_collection_coverage_for(
        &mut self,
        user_id: &str,
        storage_generation: Uuid,
        scope_id: &str,
        member_prefix: &str,
        predicate: Option<ValidatedIndexQuery>,
        entire_prefix: bool,
    ) -> Result<CoverageOutcome, EngineError<S::Error>> {
        if self.collection_epoch != 0 {
            self.invalidate_collection_coverage().await?;
        }
        let identity_matches = self
            .current_identity()
            .await?
            .is_none_or(|identity| identity == user_id);
        if user_id.is_empty()
            || !identity_matches
            || self.current_storage_generation().await? != storage_generation
            || scope_id.is_empty()
            || scope_id.len() > 512
            || member_prefix.is_empty()
            || member_prefix.len() > 256
            || user_id.len() > 256
        {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        }
        let mut catalog = self.load_collection_catalog().await?.unwrap_or_default();
        if catalog.scans.len() >= MAX_SCOPES
            && let Some(oldest) = catalog
                .scans
                .iter()
                .min_by_key(|(_, scan)| scan.started_after)
                .map(|(id, _)| id.clone())
        {
            catalog.scans.remove(&oldest);
        }
        catalog.sequence = catalog
            .sequence
            .checked_add(1)
            .ok_or(EngineError::RevisionOverflow)?;
        let scan_id = Uuid::now_v7();
        catalog.scans.insert(
            scan_id.to_string(),
            Scan {
                scope: scope_id.into(),
                user: user_id.into(),
                generation: storage_generation,
                prefix: member_prefix.into(),
                epoch: catalog.epoch,
                started_after: catalog.sequence,
                members: BTreeSet::new(),
                candidates: BTreeSet::new(),
                predicate,
                entire_prefix,
            },
        );
        let revision = self.save_collection_catalog(&catalog, false).await?;
        Ok(CoverageOutcome::Started { scan_id, revision })
    }

    /// Appends only server-returned normalized keys to the staged replacement.
    pub async fn append_collection_coverage(
        &mut self,
        user_id: &str,
        storage_generation: Uuid,
        scan_id: Uuid,
        keys: &[EntityKey<'_>],
    ) -> Result<CoverageOutcome, EngineError<S::Error>> {
        if self.collection_epoch != 0
            || !self.collection_witness(user_id, storage_generation).await?
        {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        }
        let Some(mut catalog) = self.load_collection_catalog().await? else {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        };
        let epoch = catalog.epoch;
        let Some(scan) = catalog.scans.get_mut(&scan_id.to_string()) else {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        };
        if scan.user != user_id
            || scan.generation != storage_generation
            || scan.epoch != epoch
            || keys
                .iter()
                .any(|key| !key.as_ref().starts_with(&scan.prefix))
        {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        }
        for key in keys {
            scan.members.insert(key.to_string());
            scan.candidates.remove(key.as_ref());
        }
        let revision = self.save_collection_catalog(&catalog, false).await?;
        Ok(CoverageOutcome::Committed { revision })
    }

    /// Publishes a successful scan, including an empty scan, only when its witness remains current.
    pub async fn complete_collection_coverage(
        &mut self,
        user_id: &str,
        storage_generation: Uuid,
        scan_id: Uuid,
    ) -> Result<CoverageOutcome, EngineError<S::Error>> {
        if self.collection_epoch != 0
            || !self.collection_witness(user_id, storage_generation).await?
        {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        }
        let Some(mut catalog) = self.load_collection_catalog().await? else {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        };
        let Some(scan) = catalog.scans.get(&scan_id.to_string()).cloned() else {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        };
        if scan.user != user_id
            || scan.generation != storage_generation
            || scan.epoch != catalog.epoch
            || (!scan.candidates.is_empty()
                && !self
                    .collection_candidates_are_nonmatches(scan.predicate.as_ref(), &scan.candidates)
                    .await?)
            || catalog.scopes.iter().any(|(id, scope)| {
                scope.sequence > scan.started_after
                    && (id == &scan.scope
                        || (scan.entire_prefix
                            && scope.user == scan.user
                            && scope.generation == scan.generation
                            && scope.prefix == scan.prefix))
            })
        {
            return Ok(CoverageOutcome::Incomplete {
                revision: self.revision,
            });
        }
        if scan.entire_prefix {
            // A full corpus supersedes filtered access evidence and scans that started before publication.
            catalog.scopes.retain(|_, scope| {
                scope.user != scan.user
                    || scope.generation != scan.generation
                    || scope.prefix != scan.prefix
            });
            catalog.scans.retain(|_, pending| {
                pending.user != scan.user
                    || pending.generation != scan.generation
                    || pending.prefix != scan.prefix
            });
        }
        if catalog.scopes.len() >= MAX_SCOPES
            && !catalog.scopes.contains_key(&scan.scope)
            && let Some(oldest) = catalog
                .scopes
                .iter()
                .min_by_key(|(_, scope)| scope.sequence)
                .map(|(id, _)| id.clone())
        {
            catalog.scopes.remove(&oldest);
        }
        catalog.scopes.insert(
            scan.scope.clone(),
            Scope {
                user: scan.user,
                generation: scan.generation,
                prefix: scan.prefix,
                epoch: scan.epoch,
                sequence: scan.started_after,
                members: scan.members,
                uncertain: false,
                candidates: BTreeSet::new(),
                predicate: scan.predicate,
            },
        );
        catalog.scans.remove(&scan_id.to_string());
        let revision = self.save_collection_catalog(&catalog, true).await?;
        Ok(CoverageOutcome::Committed { revision })
    }

    /// Invalidates all prior scan witnesses and completed scopes durably.
    pub async fn invalidate_collection_coverage(
        &mut self,
    ) -> Result<CoverageOutcome, EngineError<S::Error>> {
        let mut catalog = self.load_collection_catalog().await?.unwrap_or_default();
        catalog.epoch = catalog
            .epoch
            .checked_add(1)
            .ok_or(EngineError::RevisionOverflow)?;
        catalog.scans.clear();
        catalog.scopes.clear();
        let revision = self.save_collection_catalog(&catalog, true).await?;
        self.collection_epoch = 0;
        Ok(CoverageOutcome::Committed { revision })
    }

    /// Only current authoritative nonmatches can resolve concurrent candidate uncertainty.
    async fn collection_candidates_are_nonmatches(
        &self,
        predicate: Option<&ValidatedIndexQuery>,
        candidates: &BTreeSet<String>,
    ) -> Result<bool, EngineError<S::Error>> {
        let Some(predicate) = predicate else {
            return Ok(false);
        };
        if candidates.is_empty() {
            return Ok(false);
        }
        let candidates: Vec<_> = candidates.iter().collect();
        for batch in candidates.chunks(BATCH) {
            let keys: Vec<_> = batch
                .iter()
                .map(|key| EntityKey(key.as_str().into()))
                .collect();
            let projection_keys: Vec<_> = batch
                .iter()
                .map(|key| RecordKey::new((*key).clone()))
                .collect::<Result<_, _>>()
                .map_err(|_| RecordSelectionError::InvalidKey)?;
            let records = self
                .storage
                .get_batch(&keys)
                .await
                .map_err(EngineError::Storage)?;
            let projections = self
                .storage
                .load_projection_states(&projection_keys)
                .await
                .map_err(EngineError::Storage)?;
            for (record, projection) in records.iter().zip(projections.iter()) {
                if record.is_none()
                    || predicate_membership(predicate, projection.as_ref(), None, true)
                        != PredicateMembership::NonMatch
                {
                    return Ok(false);
                }
            }
        }
        Ok(true)
    }

    /// Persist candidate uncertainty before any authoritative record or projection write.
    pub(super) async fn fence_collection_candidates(
        &mut self,
        keys: impl IntoIterator<Item = EntityKey<'static>>,
    ) -> Result<(), EngineError<S::Error>> {
        let keys: BTreeSet<_> = keys.into_iter().map(|key| key.to_string()).collect();
        if keys.is_empty() {
            return Ok(());
        }
        let Some(mut catalog) = self.load_collection_catalog().await? else {
            // Corrupt optional coverage never blocks ordinary record persistence.
            return Ok(());
        };
        let mut dirty = false;
        let mut affects_completed = false;
        for scope in catalog.scopes.values_mut() {
            for key in &keys {
                if key.starts_with(&scope.prefix) && !scope.members.contains(key) {
                    let inserted = scope.candidates.insert(key.clone());
                    dirty |= inserted || !scope.uncertain;
                    affects_completed |= inserted || !scope.uncertain;
                    scope.uncertain = true;
                }
            }
        }
        for scan in catalog.scans.values_mut() {
            for key in &keys {
                if key.starts_with(&scan.prefix) && !scan.members.contains(key) {
                    dirty |= scan.candidates.insert(key.clone());
                }
            }
        }
        if dirty {
            self.save_collection_catalog(&catalog, affects_completed)
                .await?;
        }
        Ok(())
    }
}

impl<S: PredicateIndexStorage> Engine<S> {
    /// Reads every member of the newest matching completed scope; no page limit applies.
    pub async fn read_collection_live_query(
        &mut self,
        id: &str,
        spec: live_query::LiveQuerySpec,
        user_id: &str,
        scope_ids: &[String],
        since: Option<CacheRevision>,
    ) -> Result<Option<live_query::LiveQueryUpdate>, EngineError<S::Error>> {
        if id.is_empty() || id.len() > 128 {
            return Err(RecordSelectionError::InvalidKey.into());
        }
        if self.collection_epoch != 0 {
            return Ok(None);
        }
        let Some(catalog) = self.load_collection_catalog().await? else {
            return Ok(None);
        };
        let generation = self.current_storage_generation().await?;
        if self.current_identity().await?.as_deref() != Some(user_id) {
            return Ok(None);
        }
        let mut scopes: Vec<_> = scope_ids
            .iter()
            .filter_map(|id| catalog.scopes.get(id))
            .filter(|scope| {
                scope.user == user_id
                    && scope.generation == generation
                    && scope.epoch == catalog.epoch
            })
            .collect();
        scopes.sort_by_key(|scope| std::cmp::Reverse(scope.sequence));
        let mut chosen = None;
        for scope in scopes {
            if !scope.uncertain
                || self
                    .collection_candidates_are_nonmatches(
                        scope.predicate.as_ref(),
                        &scope.candidates,
                    )
                    .await?
            {
                chosen = Some(scope);
                break;
            }
        }
        let Some(scope) = chosen else {
            return Ok(None);
        };
        self.hydrate_optimistic().await?;
        let mut hits = Vec::new();
        let mut optimistic = false;
        let mut effective_members = scope.members.clone();
        effective_members.extend(
            live_query::projection_keys(&self.optimistic)
                .into_iter()
                .map(|key| key.as_str().to_owned())
                .filter(|key| key.starts_with(&scope.prefix)),
        );
        let members: Vec<_> = effective_members.iter().collect();
        for batch in members.chunks(BATCH) {
            let keys: Vec<_> = batch
                .iter()
                .map(|key| EntityKey(key.as_str().into()))
                .collect();
            let projection_keys: Vec<_> = batch
                .iter()
                .map(|key| RecordKey::new((*key).clone()))
                .collect::<Result<_, _>>()
                .map_err(|_| RecordSelectionError::InvalidKey)?;
            let records = self
                .storage
                .get_batch(&keys)
                .await
                .map_err(EngineError::Storage)?;
            let authority = self
                .storage
                .load_projection_states(&projection_keys)
                .await
                .map_err(EngineError::Storage)?;
            let shadows = self
                .storage
                .load_optimistic_projections(&projection_keys)
                .await
                .map_err(EngineError::Storage)?;
            for (((key, record), authority), shadow) in projection_keys
                .into_iter()
                .zip(records)
                .zip(authority)
                .zip(shadows)
            {
                if record.is_none() && shadow.is_none() {
                    return Ok(None);
                }
                optimistic |= shadow.is_some();
                match predicate_membership(&spec.query, authority.as_ref(), shadow.as_ref(), true) {
                    PredicateMembership::Match(sort) => hits.push((key, sort)),
                    PredicateMembership::NonMatch => {}
                    PredicateMembership::Unknown => return Ok(None),
                }
            }
        }
        let query = spec.query.as_query();
        let direction = |a: std::cmp::Ordering, direction| match direction {
            SortDirection::Asc => a,
            SortDirection::Desc => a.reverse(),
        };
        hits.sort_by(|(ak, av), (bk, bv)| {
            direction(av.cmp(bv), query.sort_direction)
                .then_with(|| direction(ak.cmp(bk), query.tie_break_direction))
        });
        let membership = PredicateReconciliation {
            keys: hits.into_iter().map(|(key, _)| key).collect(),
            retained_keys: vec![],
            optimistic,
        };
        // The maintained view checks fragment completeness after reading only dirty rows.
        let view_id = id;
        let update = self
            .read_live_query_with_membership(view_id, spec, since, Some(membership))
            .await?;
        if !self.live_queries.is_complete(view_id) {
            return Ok(None);
        }
        Ok(Some(update))
    }
}

#[cfg(test)]
mod test;
