//! Property-definition authorization for grouped Soup queries.

use std::sync::Arc;

use macro_user_id::user_id::MacroUserIdStr;
use models_grouping::CandidateQuery;
use properties::PropertiesService;

use super::SoupImpl;
use crate::domain::ports::PropertyQueryAuthorizer;

pub(super) struct PropertiesAuthorizer<S>(pub Arc<S>);

impl<S: PropertiesService> PropertyQueryAuthorizer for PropertiesAuthorizer<S> {
    fn authorize_selection<'a>(
        &'a self,
        viewer: MacroUserIdStr<'static>,
        team: Option<
            entity_access::domain::models::EntityAccessReceipt<
                entity_access::domain::models::MemberTeamRole,
            >,
        >,
        selection: CandidateQuery,
    ) -> std::pin::Pin<
        Box<
            dyn Future<
                    Output = Result<properties::AuthorizedPropertyQuery, properties::PropertiesErr>,
                > + Send
                + 'a,
        >,
    > {
        Box::pin(async move {
            self.0
                .authorize_property_query(viewer, team.as_ref(), selection)
                .await
        })
    }
}

impl<T, U, V, C, K, Crm, F> SoupImpl<T, U, V, C, K, Crm, F> {
    /// Attach the owning properties service without changing source authorization.
    pub fn with_property_queries<S: PropertiesService>(mut self, service: Arc<S>) -> Self {
        self.property_queries = Some(Arc::new(PropertiesAuthorizer(service)));
        self
    }
}
