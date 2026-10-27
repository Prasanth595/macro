//! Tool-free extraction adapters for Clairic and the shared model router.
pub mod clairic;
pub mod temporal;
#[cfg(test)]
mod test;
use crate::domain::{
    ExtractInputRequest, FIELD_EXTRACTION_GUIDANCE, FieldExtractor, InputError, InputIntent,
    InputSuggestions,
};
use agent::{Message, complete_with_history_and_params};
use ai_usage::{UsageContext, UsageRecorder};
use serde_json::{Value, json};
use std::sync::Arc;

const EXTRACTION_MODEL: &str = "fireworks/nemotron-lightning-3p5-30b-a3b";

/// Tool-free Nemotron extraction through the shared model router and usage recorder.
pub struct AgentFieldExtractor {
    recorder: Arc<dyn UsageRecorder>,
}

impl AgentFieldExtractor {
    /// Create an extractor that attributes completed requests to the supplied recorder.
    pub fn new(recorder: Arc<dyn UsageRecorder>) -> Self {
        Self { recorder }
    }
}

fn extraction_schema(input: &ExtractInputRequest) -> Value {
    let fields = input.intent.extraction_fields();
    let properties = fields
        .iter()
        .map(|field| {
            let schema = match *field {
                "recipients" | "cc" | "bcc" | "guests" | "search_from" | "search_in" => {
                    json!({"type": "array", "items": {"type": "string"}})
                }
                "properties" => json!({"type": "array", "items": {
                    "type": "object", "additionalProperties": false,
                    "required": ["name", "values"],
                    "properties": {
                        "name": {"type": "string"},
                        "values": {"type": "array", "items": {"type": "string"}}
                    }
                }}),
                _ => json!({"type": ["string", "null"]}),
            };
            ((*field).to_owned(), schema)
        })
        .collect::<serde_json::Map<_, _>>();
    json!({"type": "object", "additionalProperties": false, "required": fields, "properties": properties})
}

fn decode_suggestions(intent: InputIntent, fields: Value) -> Result<InputSuggestions, InputError> {
    serde_json::from_value(json!({"intent": intent, "suggestions": fields}))
        .map_err(|_| InputError::Extraction)
}

impl FieldExtractor for AgentFieldExtractor {
    async fn extract(
        &self,
        input: &ExtractInputRequest,
        usage: UsageContext,
    ) -> Result<InputSuggestions, InputError> {
        let schema = extraction_schema(input);
        let system = format!(
            "{}\n{}\nJSON schema: {}",
            FIELD_EXTRACTION_GUIDANCE,
            input.intent.extraction_guidance(),
            schema
        );
        let prompt = json!({"draft": input.text, "intent": input.intent, "property_definitions": input.property_definitions}).to_string();
        let result = complete_with_history_and_params(
            EXTRACTION_MODEL,
            &system,
            vec![Message::user(prompt)],
            Some(json!({
                "reasoning_effort": "none",
                "temperature": 0,
                "response_format": {"type": "json_schema", "json_schema": {
                    "name": "UniversalInputFields", "strict": true, "schema": schema
                }}
            })),
            self.recorder.as_ref(),
            usage,
        )
        .await
        .map_err(|_| InputError::Extraction)?;
        decode_suggestions(
            input.intent,
            serde_json::from_str(&result).map_err(|_| InputError::Extraction)?,
        )
    }
}
