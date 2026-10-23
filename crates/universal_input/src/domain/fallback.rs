//! Extraction failover policy, independent of provider implementations.
use super::{ExtractInputRequest, FieldExtractor, InputError, InputSuggestions};
use ai_usage::UsageContext;

#[cfg(test)]
mod test;

/// Try an optional primary extractor, retaining an existing provider as fallback.
pub struct FallbackFieldExtractor<P, F> {
    primary: Option<P>,
    fallback: F,
}

impl<P, F> FallbackFieldExtractor<P, F> {
    /// An unconfigured primary uses only the fallback; failed inference falls back once.
    pub fn new(primary: Option<P>, fallback: F) -> Self {
        Self { primary, fallback }
    }
}

impl<P: FieldExtractor, F: FieldExtractor> FieldExtractor for FallbackFieldExtractor<P, F> {
    async fn extract(
        &self,
        input: &ExtractInputRequest,
        usage: UsageContext,
    ) -> Result<InputSuggestions, InputError> {
        if let Some(primary) = &self.primary {
            match primary.extract(input, usage.clone()).await {
                Ok(suggestions) => return Ok(suggestions),
                Err(InputError::Extraction | InputError::Unavailable) => {
                    tracing::warn!("Primary field extraction unavailable; using fallback");
                }
                Err(error) => return Err(error),
            }
        }
        self.fallback.extract(input, usage).await
    }
}
