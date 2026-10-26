//! Property-definition authorization for grouped Soup queries.

use std::sync::Arc;

use macro_user_id::{cowlike::CowLike, user_id::MacroUserIdStr};
use models_grouping::{CandidateDirection, CandidateQuery, GroupingConfig};
use properties::PropertiesService;

use super::SoupImpl;
use crate::domain::{models::SoupErr, ports::PropertyQueryAuthorizer};

pub(super) struct PropertiesAuthorizer<S>(pub Arc<S>);

impl<S: PropertiesService> PropertyQueryAuthorizer for PropertiesAuthorizer<S> {
    fn authorize<'a>(
        &'a self,
        viewer: MacroUserIdStr<'static>,
        grouping: GroupingConfig,
    ) -> std::pin::Pin<Box<dyn Future<Output = Result<(), properties::PropertiesErr>> + Send + 'a>>
    {
        Box::pin(async move {
            self.0
                .authorize_property_query(
                    viewer,
                    None,
                    CandidateQuery {
                        date_property_id: None,
                        timestamp_sort: None,
                        direction: CandidateDirection::Descending,
                        grouping: Some(grouping),
                        cursor: None,
                        limit: 1,
                    },
                )
                .await?;
            Ok(())
        })
    }
}

impl<T, U, V, C, K, Crm, F> SoupImpl<T, U, V, C, K, Crm, F> {
    /// Attach the owning properties service without changing source authorization.
    pub fn with_property_queries<S: PropertiesService>(mut self, service: Arc<S>) -> Self {
        self.property_queries = Some(Arc::new(PropertiesAuthorizer(service)));
        self
    }

    pub(super) async fn authorize_date_grouping(
        &self,
        viewer: &MacroUserIdStr<'_>,
        grouping: &GroupingConfig,
    ) -> Result<(), SoupErr> {
        if grouping.field.date_ranges().is_none() {
            return Ok(());
        }
        let authorizer = self.property_queries.as_ref().ok_or_else(|| {
            SoupErr::SoupDbErr(anyhow::anyhow!(
                "property query authorizer is not configured"
            ))
        })?;
        authorizer
            .authorize(viewer.copied().into_owned(), grouping.clone())
            .await?;
        Ok(())
    }
}
