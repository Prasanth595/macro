//! Workspace-scoped OpenAI-compatible model configuration and resolution.
#![deny(missing_docs)]
/// Provider configuration, authorization and execution ports.
pub mod domain;
/// Authenticated HTTP adapters.
pub mod inbound;
/// Encrypted storage and endpoint adapters.
pub mod outbound;
