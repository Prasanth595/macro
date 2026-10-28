//! Items a tool call created, reported to whoever runs the call.

use macro_user_id::user_id::MacroUserIdStr;

/// Kind of a [`CreatedItem`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreatedItemType {
    /// A document, including a task.
    Document,
    /// A database.
    Database,
}

/// An item a tool call has just created.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreatedItem {
    /// The new item's id.
    pub id: String,
    /// What kind of item it is.
    pub item_type: CreatedItemType,
}

/// Told about each item a request's tool calls create, after the item exists.
///
/// The caller that runs the tools decides what follows - an agent session
/// opened from a channel shares the item with that channel. It never fails the
/// tool call: the item already exists, and failing would make the model create
/// it again.
///
/// `async_trait` because requests hold it as `Arc<dyn CreatedItemObserver>`.
#[async_trait::async_trait]
pub trait CreatedItemObserver: Send + Sync + std::fmt::Debug {
    /// `user` created `item`.
    async fn created(&self, user: &MacroUserIdStr<'static>, item: CreatedItem);
}
