//! Outbound adapters for session logging and agent management.

pub mod acp_mcp;
/// Holding Macro's own tools for the owner, through the egress approvals.
pub mod approval_gate;
pub mod egress_mcp;
pub mod local_attachments;
pub mod log_frames;
pub mod manager;
pub mod tool_catalog;
/// Who prompted a turn, from the session row the harness stamps.
pub mod turn_prompter;
