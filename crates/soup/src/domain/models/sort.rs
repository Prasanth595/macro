//! Sort descriptors and position values for Soup's dynamic query.

use chrono::{DateTime, Utc};
use models_pagination::{Cursor, CursorVal, Query, SimpleSortMethod, Sortable};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use uuid::Uuid;

use super::SoupSortDirection;

/// The existing timestamp sort or a selected property and its direction.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DynamicSort {
    /// Preserve the deployed timestamp sort encoding.
    Timestamp(SimpleSortMethod),
    /// Sort by a definition visible to the requesting viewer.
    Property {
        /// Selected property definition, not an assignment ID.
        property_definition_id: Uuid,
        /// Ascending or descending property values, with missing values last.
        direction: SoupSortDirection,
    },
}

impl From<SimpleSortMethod> for DynamicSort {
    fn from(value: SimpleSortMethod) -> Self {
        Self::Timestamp(value)
    }
}

impl DynamicSort {
    /// Timestamp column used by the existing top clauses and by property ties.
    pub fn timestamp_method(self) -> SimpleSortMethod {
        match self {
            Self::Timestamp(method) => method,
            Self::Property { .. } => SimpleSortMethod::UpdatedAt,
        }
    }

    /// Convert an existing timestamp request without changing its wire cursor.
    pub fn from_timestamp_query<F>(
        query: Query<Uuid, SimpleSortMethod, F>,
    ) -> Query<Uuid, Self, F> {
        match query {
            Query::Sort(sort, filter) => Query::Sort(sort.into(), filter),
            Query::Cursor(cursor) => Query::Cursor(Cursor {
                id: cursor.id,
                limit: cursor.limit,
                val: CursorVal {
                    sort_type: cursor.val.sort_type.into(),
                    last_val: DynamicSortValue::Timestamp(cursor.val.last_val),
                },
                filter: cursor.filter,
            }),
        }
    }

    /// Construct the position returned by the dynamic SQL row.
    pub fn position(self, key: Option<f64>, timestamp: DateTime<Utc>) -> DynamicSortValue {
        match self {
            Self::Timestamp(_) => DynamicSortValue::Timestamp(timestamp),
            Self::Property { .. } => DynamicSortValue::Property { key, timestamp },
        }
    }
}

impl Sortable for DynamicSort {
    type Value = DynamicSortValue;
}

/// A timestamp cursor retains its old string encoding; property cursors add a key.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DynamicSortValue {
    /// Position in an ordinary timestamp query.
    Timestamp(DateTime<Utc>),
    /// Signed numeric property key and its update-time tie breaker.
    Property {
        /// Null represents SQL negative infinity, so missing values sort last.
        key: Option<f64>,
        /// Update timestamp for deterministic ties.
        timestamp: DateTime<Utc>,
    },
}

impl DynamicSortValue {
    /// Timestamp for the SQL keyset.
    pub fn timestamp(&self) -> DateTime<Utc> {
        match self {
            Self::Timestamp(value) => *value,
            Self::Property { timestamp, .. } => *timestamp,
        }
    }

    /// Signed numeric key; ordinary timestamp queries use zero.
    pub fn key(&self) -> Option<f64> {
        match self {
            Self::Timestamp(_) => Some(0.0),
            Self::Property { key, .. } => *key,
        }
    }
}

impl PartialEq for DynamicSortValue {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}
impl Eq for DynamicSortValue {}
impl PartialOrd for DynamicSortValue {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for DynamicSortValue {
    fn cmp(&self, other: &Self) -> Ordering {
        self.key()
            .unwrap_or(f64::NEG_INFINITY)
            .total_cmp(&other.key().unwrap_or(f64::NEG_INFINITY))
            .then_with(|| self.timestamp().cmp(&other.timestamp()))
    }
}
