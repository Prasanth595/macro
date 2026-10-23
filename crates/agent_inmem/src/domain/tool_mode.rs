//! Which tools a conversational turn is offered.

/// Tool presentation for one conversational turn.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ToolMode {
    /// The normal direct Macro tools and lazy catalog.
    #[default]
    Standard,
    /// SDK operations are hidden from direct calls and discovery.
    Code,
}
