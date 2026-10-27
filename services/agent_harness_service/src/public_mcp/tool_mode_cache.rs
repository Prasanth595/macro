//! Per-user flag results, cached because every stateless MCP request asks for
//! them: the tool mode and whether agent-led setup is on.
use agent_inmem::domain::tool_mode::{ToolMode, ToolModeSelector};
use macro_user_id::user_id::MacroUserIdStr;
use std::{
    collections::HashMap,
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::time::Instant;

#[cfg(test)]
mod test;

/// How long a flag evaluation is reused; flag changes apply within this window.
const TTL: Duration = Duration::from_secs(60);
/// Expired entries are swept once the map grows past this size.
const SWEEP_AT: usize = 10_000;

/// Each user's last result, reused for [`TTL`].
pub struct UserCache<V> {
    entries: Mutex<HashMap<String, (Instant, V)>>,
}

impl<V> Default for UserCache<V> {
    fn default() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }
}

impl<V: Copy> UserCache<V> {
    /// The user's result, if it was stored within [`TTL`].
    pub fn get(&self, user: &str) -> Option<V> {
        let entries = self.entries.lock().expect("user cache is not poisoned");
        entries
            .get(user)
            .filter(|(at, _)| at.elapsed() < TTL)
            .map(|(_, value)| *value)
    }

    /// Remembers the user's result.
    pub fn store(&self, user: &str, value: V) {
        let mut entries = self.entries.lock().expect("user cache is not poisoned");
        if entries.len() >= SWEEP_AT {
            entries.retain(|_, (at, _)| at.elapsed() < TTL);
        }
        entries.insert(user.to_owned(), (Instant::now(), value));
    }
}

/// Reuses each user's tool mode for [`TTL`] instead of loading flags per request.
pub struct CachedToolMode {
    inner: Arc<dyn ToolModeSelector>,
    cache: UserCache<ToolMode>,
}

impl CachedToolMode {
    pub fn new(inner: Arc<dyn ToolModeSelector>) -> Self {
        Self {
            inner,
            cache: UserCache::default(),
        }
    }
}

impl ToolModeSelector for CachedToolMode {
    fn select<'a>(
        &'a self,
        owner: &'a MacroUserIdStr<'_>,
    ) -> Pin<Box<dyn Future<Output = ToolMode> + Send + 'a>> {
        Box::pin(async move {
            let key = owner.as_ref();
            if let Some(mode) = self.cache.get(key) {
                return mode;
            }
            let mode = self.inner.select(owner).await;
            self.cache.store(key, mode);
            mode
        })
    }
}
