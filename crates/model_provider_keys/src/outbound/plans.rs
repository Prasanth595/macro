#[cfg(test)]
mod test;

use ai_billing::domain::EntitlementSource;
use macro_user_id::user_id::MacroUserIdStr;

use crate::domain::{KeyPlans, ProviderKeyError, Result};

/// Provider keys come with a paid plan: Premium, Max, or an enterprise team.
/// A team member's plan is their own seat's, as for their AI allowance.
pub struct EntitlementKeyPlans<Entitlements> {
    entitlements: Entitlements,
}

impl<Entitlements> EntitlementKeyPlans<Entitlements> {
    /// Read plans through `entitlements`.
    pub fn new(entitlements: Entitlements) -> Self {
        Self { entitlements }
    }
}

#[async_trait::async_trait]
impl<Entitlements: EntitlementSource> KeyPlans for EntitlementKeyPlans<Entitlements> {
    async fn allows_keys(&self, user: &MacroUserIdStr<'_>) -> Result<bool> {
        let entitlement = self
            .entitlements
            .entitlement(user)
            .await
            .map_err(|error| ProviderKeyError::Plan(error.into()))?;
        Ok(entitlement.unlimited || entitlement.tier.is_paid())
    }
}
