use feature_flags::{FlagSnapshot, FlagValue, outbound::fake::FakeFeatureFlags};

use super::*;

fn user(email: &str) -> MacroUserIdStr<'static> {
    MacroUserIdStr::try_from_email(email).unwrap()
}

fn flagged(value: bool) -> Result<FlagSnapshot, String> {
    Ok(FlagSnapshot::new([(
        AGENT_LED_SETUP.to_owned(),
        FlagValue::Boolean(value),
    )]))
}

#[tokio::test]
async fn setup_is_on_only_for_people_the_flag_reaches() {
    let mut flags = FakeFeatureFlags::default();
    flags.set(user("on@example.com"), flagged(true));
    flags.set(user("off@example.com"), flagged(false));
    flags.set(user("unset@example.com"), Ok(FlagSnapshot::default()));
    flags.set(user("down@example.com"), Err("PostHog is down".to_owned()));
    let access = FlaggedSetup::new(flags);

    assert!(access.allowed(&user("on@example.com")).await);
    assert!(!access.allowed(&user("off@example.com")).await);
    assert!(!access.allowed(&user("unset@example.com")).await);
    assert!(!access.allowed(&user("down@example.com")).await);
}
