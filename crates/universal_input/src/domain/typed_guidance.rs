//! Concise field definitions for typed extraction models, without chat/JSON instructions.
use super::InputIntent;
use std::sync::OnceLock;

impl InputIntent {
    /// The meaning of a single field; provider adapters choose its wire representation.
    pub fn typed_field_guidance(self, field: &str) -> Option<&'static str> {
        static GUIDANCE: OnceLock<serde_json::Value> = OnceLock::new();
        let guidance = GUIDANCE.get_or_init(|| {
            serde_json::from_str(include_str!("typed_field_guidance.json"))
                .expect("fixed field guidance is valid JSON")
        });
        let intent = match self {
            Self::Ai => return None,
            Self::Search => "search",
            Self::Email => "email",
            Self::Note => "note",
            Self::Task => "task",
            Self::Calendar => "calendar",
            Self::Message => "message",
        };
        guidance.get(intent)?.get(field)?.as_str()
    }
}
