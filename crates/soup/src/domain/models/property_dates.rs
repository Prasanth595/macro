//! Generic property-date requests and frozen continuation context.

use entity_access::domain::models::{EntityAccessReceipt, MemberTeamRole};
use item_filters::ast::{EntityFilterAst, ExpandErr};
use macro_user_id::user_id::MacroUserIdStr;
use models_grouping::{CandidateCursor, CandidateIdentity, CandidateQuery};
use models_pagination::Base64Str;
use serde::{Deserialize, Serialize};

use super::SoupErr;

/// Complete immutable query configuration carried by each continuation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyDateContext {
    /// Selected property, direction, grouping, limit, and last canonical identity.
    pub selection: CandidateQuery,
    /// Original filters, before resolving viewer-dependent memberships.
    pub filters: EntityFilterAst,
    /// Frozen email view; refreshed inbox access does not change this filter.
    pub email_preview_view: email::domain::models::PreviewView,
}

/// A property-dependent query authenticated independently of its cursor.
#[derive(Debug)]
pub struct PropertyDateRequest {
    /// Viewer for this request; never taken from cursor data.
    pub viewer: MacroUserIdStr<'static>,
    /// Optional verified team scope for the owning source services.
    pub team: Option<EntityAccessReceipt<MemberTeamRole>>,
    /// Frozen query and original filters.
    pub context: PropertyDateContext,
    /// Whether document hydration includes authoritative server facts.
    pub include_projection: bool,
    /// Load frecency only when the caller selects it.
    pub load_frecency: bool,
    /// Requested source representation.
    pub soup_type: super::SoupType,
    /// Authorized mailbox candidates, resolved afresh on each request.
    pub link_ids: Vec<uuid::Uuid>,
}

impl PropertyDateRequest {
    /// Construct a read with explicit hydration and source options.
    pub fn new(
        viewer: MacroUserIdStr<'static>,
        team: Option<EntityAccessReceipt<MemberTeamRole>>,
        context: PropertyDateContext,
        include_projection: bool,
        load_frecency: bool,
        soup_type: super::SoupType,
        link_ids: Vec<uuid::Uuid>,
    ) -> Self {
        Self {
            viewer,
            team,
            context,
            include_projection,
            load_frecency,
            soup_type,
            link_ids,
        }
    }
}

impl PropertyDateContext {
    /// Validate the initial query configuration before source selection.
    pub fn initial(
        selection: CandidateQuery,
        filters: EntityFilterAst,
        email_preview_view: email::domain::models::PreviewView,
    ) -> Result<Self, SoupErr> {
        selection.validate().map_err(invalid)?;
        if selection.cursor.is_some() {
            return Err(invalid("initial property-date query cannot carry a cursor"));
        }
        Ok(Self {
            selection,
            filters,
            email_preview_view,
        })
    }

    /// Decode a property-date cursor, or identify an ordinary timestamp cursor.
    /// Malformed property-date context never falls back to another cursor type.
    pub fn try_decode(encoded: &str) -> Result<Option<Self>, SoupErr> {
        let value = Base64Str::<serde_json::Value>::new_from_string(encoded.to_owned())
            .decode_json()
            .map_err(invalid)?;
        if value.get("selection").is_none() {
            return Ok(None);
        }
        let context: Self = serde_json::from_value(value).map_err(invalid)?;
        context.selection.validate().map_err(invalid)?;
        if context.selection.cursor.is_none() {
            return Err(invalid("property-date continuation requires a position"));
        }
        Ok(Some(context))
    }

    /// Decode a continuation that must use the property-date format.
    pub fn decode(encoded: &str) -> Result<Self, SoupErr> {
        Self::try_decode(encoded)?.ok_or_else(|| invalid("expected property-date cursor"))
    }
    /// Encode the next page for this exact selection and optional group.
    pub fn next_cursor(&self, position: CandidateCursor, group_key: Option<String>) -> String {
        let mut context = self.clone();
        context.selection.cursor = Some(position);
        if let Some(grouping) = &mut context.selection.grouping {
            grouping.group_key = group_key;
        }
        Base64Str::encode_json(context).type_erase()
    }
}

fn invalid(error: impl std::fmt::Display) -> SoupErr {
    SoupErr::AstErr(ExpandErr::ApiAst(error.to_string()))
}

/// Hydrated bounded candidates; counts and cursors stay tied to selection.
#[derive(Debug)]
pub struct PropertyDatePage {
    /// Full-source counts and selected memberships in canonical order.
    pub candidates: models_grouping::CandidatePage,
    /// Hydrated items keyed by source type and ID; REST converts keys at its boundary.
    pub items: std::collections::HashMap<
        CandidateIdentity,
        super::SoupProjectionHydration<super::EnrichedSoupItem>,
    >,
    /// Frozen inputs used to construct continuation cursors.
    pub context: PropertyDateContext,
}

impl PropertyDatePage {
    /// Return a flat page without deriving cursors from hydrated property values.
    pub fn into_flat(
        mut self,
    ) -> models_pagination::PaginatedOpaqueCursor<
        super::SoupProjectionHydration<super::EnrichedSoupItem>,
    > {
        let next_cursor = self
            .candidates
            .groups
            .first()
            .filter(|group| group.has_more)
            .and_then(|_| self.candidates.candidates.last())
            .map(|candidate| {
                self.context.next_cursor(
                    CandidateCursor {
                        identity: candidate.identity.clone(),
                        sort_value: candidate.sort_value,
                    },
                    None,
                )
            });
        let items = self
            .candidates
            .candidates
            .into_iter()
            .filter_map(|candidate| self.items.remove(&candidate.identity))
            .collect();
        models_pagination::Paginated::from_parts(items, next_cursor)
    }

    /// Build exact group metadata, including exhausted groups and removed hydration rows.
    pub fn into_grouped(
        mut self,
    ) -> Result<super::grouping::GroupedResponse<CandidateIdentity>, SoupErr> {
        let grouping = self
            .context
            .selection
            .grouping
            .as_ref()
            .ok_or_else(|| invalid("grouped property-date response requires grouping"))?;
        let mut groups = Vec::with_capacity(self.candidates.groups.len());
        for stats in &self.candidates.groups {
            let members: Vec<_> = self
                .candidates
                .candidates
                .iter()
                .filter(|candidate| candidate.group_key == stats.group_key)
                .collect();
            let item_ids = members
                .iter()
                .map(|candidate| candidate.identity.clone())
                .filter(|identity| self.items.contains_key(identity))
                .collect();
            let next_cursor = if stats.has_more {
                members.last().map(|candidate| {
                    self.context.next_cursor(
                        CandidateCursor {
                            identity: candidate.identity.clone(),
                            sort_value: candidate.sort_value,
                        },
                        Some(stats.group_key.clone()),
                    )
                })
            } else {
                None
            };
            let (label, display_order) =
                super::grouping::resolve_group_label_and_order(&stats.group_key, &grouping.field);
            groups.push(super::grouping::GroupMeta {
                key: stats.group_key.clone(),
                label,
                display_order,
                total_count: stats.total_count.min(i64::from(u32::MAX)) as u32,
                item_ids,
                next_cursor,
            });
        }
        if groups.is_empty()
            && let Some(key) = &grouping.group_key
        {
            let (label, display_order) =
                super::grouping::resolve_group_label_and_order(key, &grouping.field);
            groups.push(super::grouping::GroupMeta {
                key: key.clone(),
                label,
                display_order,
                total_count: 0,
                item_ids: Vec::new(),
                next_cursor: None,
            });
        }
        let page_cursor = grouping
            .group_key
            .as_ref()
            .and_then(|_| groups.first())
            .and_then(|group| group.next_cursor.clone());
        Ok(super::grouping::GroupedResponse {
            items: self
                .items
                .drain()
                .map(|(key, value)| (key, value.item))
                .collect(),
            groups,
            page_cursor,
        })
    }
}
