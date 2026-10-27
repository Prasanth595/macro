//! Visible property definitions and type validation for Soup sorts and grouping.

use super::*;
use crate::domain::models::DynamicSort;
use models_grouping::GroupingConfig;
use models_properties::DataType;

impl<T, U, V, C, K, Crm, F> SoupImpl<T, U, V, C, K, Crm, F> {
    /// Attach the owning properties service for definition reads.
    pub fn with_property_queries<S: properties::PropertiesService>(
        mut self,
        service: Arc<S>,
    ) -> Self {
        self.property_queries = Some(service);
        self
    }

    #[tracing::instrument(skip_all, fields(sort = ?sort), err)]
    pub(super) async fn validate_properties(
        &self,
        viewer: MacroUserIdStr<'static>,
        team: Option<properties::TeamReceipt>,
        sort: DynamicSort,
        grouping: Option<&GroupingConfig>,
    ) -> Result<(), SoupErr> {
        let mut selected = Vec::new();
        if let DynamicSort::Property {
            property_definition_id,
            ..
        } = sort
        {
            selected.push((property_definition_id, false));
        }
        if let Some(grouping) = grouping
            && let Some((id, ranges)) = grouping.field.date_ranges()
        {
            ranges
                .validate()
                .map_err(|error| properties::PropertiesErr::Validation(format!("{error:?}")))?;
            if let Some((_, date)) = selected.iter_mut().find(|(key, _)| *key == id) {
                *date = true;
            } else {
                selected.push((id, true));
            }
        }
        for (id, date) in selected {
            let reader = self.property_queries.as_ref().ok_or_else(|| {
                SoupErr::SoupDbErr(anyhow::anyhow!(
                    "property definition reader is not configured"
                ))
            })?;
            let definition = reader
                .read_definition(id, viewer.clone(), team.clone())
                .await?;
            let supported = if date {
                definition.data_type == DataType::Date && !definition.is_multi_select
            } else {
                matches!(
                    definition.data_type,
                    DataType::Date
                        | DataType::Number
                        | DataType::Boolean
                        | DataType::SelectString
                        | DataType::SelectNumber
                        | DataType::Tag
                )
            };
            if !supported {
                return Err(properties::PropertiesErr::Validation(
                    "Property type does not support this sort or date grouping".into(),
                )
                .into());
            }
        }
        Ok(())
    }
}
