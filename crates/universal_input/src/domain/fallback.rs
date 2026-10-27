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

impl<P: super::search::SearchExtractor, F: super::search::SearchExtractor>
    super::search::SearchExtractor for FallbackFieldExtractor<P, F>
{
    async fn select_search_type(
        &self,
        input: &ExtractInputRequest,
        usage: UsageContext,
    ) -> Result<super::search::SearchType, InputError> {
        if let Some(primary) = &self.primary {
            match primary.select_search_type(input, usage.clone()).await {
                Ok(value) => return Ok(value),
                Err(InputError::Extraction | InputError::Unavailable) => {
                    tracing::warn!("Search type extraction unavailable; using fallback")
                }
                Err(error) => return Err(error),
            }
        }
        self.fallback.select_search_type(input, usage).await
    }
    async fn extract_search(
        &self,
        input: &ExtractInputRequest,
        search_type: super::search::SearchType,
        usage: UsageContext,
    ) -> Result<super::search::SearchSuggestions, InputError> {
        if let Some(primary) = &self.primary {
            match primary
                .extract_search(input, search_type, usage.clone())
                .await
            {
                Ok(value) => return Ok(value),
                Err(InputError::Extraction | InputError::Unavailable) => tracing::warn!(
                    ?search_type,
                    "Search field extraction unavailable; using fallback"
                ),
                Err(error) => return Err(error),
            }
        }
        self.fallback
            .extract_search(input, search_type, usage)
            .await
    }
}
