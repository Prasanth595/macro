use ai_billing::domain::{BillingError, Entitlement, PlanTier};
use macro_uuid::Uuid;

use super::*;

/// Resolves every user to one entitlement.
struct OneEntitlement(Entitlement);

impl EntitlementSource for OneEntitlement {
    async fn entitlement(
        &self,
        _user: &MacroUserIdStr<'_>,
    ) -> std::result::Result<Entitlement, BillingError> {
        Ok(self.0.clone())
    }

    async fn stripe_customer_id(
        &self,
        _user: &MacroUserIdStr<'_>,
    ) -> std::result::Result<Option<String>, BillingError> {
        Ok(None)
    }

    async fn team_payer(
        &self,
        _team_id: Uuid,
    ) -> std::result::Result<Option<MacroUserIdStr<'static>>, BillingError> {
        Ok(None)
    }
}

fn user() -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from("macro|member@example.com".to_owned()).expect("valid user id")
}

#[tokio::test]
async fn only_paid_and_enterprise_plans_include_keys() {
    for (tier, unlimited, allowed) in [
        (PlanTier::Free, false, false),
        (PlanTier::Premium, false, true),
        (PlanTier::Max, false, true),
        (PlanTier::Free, true, true),
    ] {
        let entitlement = Entitlement {
            unlimited,
            ..Entitlement::personal(user(), tier)
        };
        let plans = EntitlementKeyPlans::new(OneEntitlement(entitlement));
        assert_eq!(
            plans.allows_keys(&user()).await.expect("plan read"),
            allowed,
            "{tier:?}, unlimited {unlimited}"
        );
    }
}
