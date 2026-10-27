//! Who gets agent-led setup: the `agent-led-setup` PostHog flag, per person.
//!
//! Anyone the flag doesn't reach, and everyone while flags can't load, gets
//! public MCP exactly as it was before agent-led setup.

#[cfg(test)]
mod test;

use std::{future::Future, pin::Pin};

use feature_flags::FeatureFlags;
use macro_user_id::user_id::MacroUserIdStr;

use crate::public_mcp::tool_mode_cache::UserCache;

/// PostHog key that turns agent-led setup on for a person.
pub const AGENT_LED_SETUP: &str = "agent-led-setup";

/// Boxed future returned by [`SetupAccess`].
pub type AccessFuture<'a> = Pin<Box<dyn Future<Output = bool> + Send + 'a>>;

/// Whether a person gets agent-led setup. Object-safe so the server and the
/// sign-in hook share one cached source.
pub trait SetupAccess: Send + Sync + 'static {
    /// `true` when agent-led setup is on for `user`.
    fn allowed<'a>(&'a self, user: &'a MacroUserIdStr<'_>) -> AccessFuture<'a>;
}

/// The `agent-led-setup` flag, reused per person for a minute because every
/// stateless MCP request asks.
pub struct FlaggedSetup<F> {
    flags: F,
    cache: UserCache<bool>,
}

impl<F: FeatureFlags> FlaggedSetup<F> {
    /// Reads the flag through `flags`, whose load has a bounded deadline.
    pub fn new(flags: F) -> Self {
        Self {
            flags,
            cache: UserCache::default(),
        }
    }
}

impl<F: FeatureFlags + 'static> SetupAccess for FlaggedSetup<F> {
    fn allowed<'a>(&'a self, user: &'a MacroUserIdStr<'_>) -> AccessFuture<'a> {
        Box::pin(async move {
            let key = user.as_ref();
            if let Some(allowed) = self.cache.get(key) {
                return allowed;
            }
            let allowed = self
                .flags
                .load(user)
                .await
                .inspect_err(|error| {
                    tracing::warn!(
                        ?error,
                        "feature flags unavailable; agent-led setup stays off"
                    );
                })
                .is_ok_and(|flags| flags.is_enabled(AGENT_LED_SETUP));
            self.cache.store(key, allowed);
            allowed
        })
    }
}

/// The same answer for everyone, for tests.
#[cfg(test)]
pub struct Everyone(pub bool);

#[cfg(test)]
impl SetupAccess for Everyone {
    fn allowed<'a>(&'a self, _user: &'a MacroUserIdStr<'_>) -> AccessFuture<'a> {
        let allowed = self.0;
        Box::pin(async move { allowed })
    }
}
