//! Shared search-term parsing.
//!
//! [`split_search_terms`] tokenizes user input by whitespace while preserving
//! double-quoted phrases so callers can build AND-of-terms queries where each
//! quoted span counts as a single phrase term. Used by both the unified
//! dispatch and the channel-only endpoint. [`drop_wordless_terms`] then removes
//! the terms no indexed text can match.

use models_search::MatchType;

/// Splits search terms by whitespace, preserving double-quoted phrases.
/// e.g. `["hello world"]` → `["hello", "world"]`
/// e.g. `[r#""hello world" test"#]` → `["hello world", "test"]`
pub(in crate::api::search) fn split_search_terms(terms: &[String]) -> Vec<String> {
    let joined = terms.join(" ");
    let mut result = Vec::new();
    // Regex-free parser: iterate chars, track quoted state
    let mut current = String::new();
    let mut in_quotes = false;
    for c in joined.chars() {
        match c {
            '"' => in_quotes = !in_quotes,
            c if c.is_whitespace() && !in_quotes => {
                let trimmed = current.trim().to_string();
                if !trimmed.is_empty() {
                    result.push(trimmed);
                }
                current.clear();
            }
            _ => current.push(c),
        }
    }
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        result.push(trimmed);
    }
    result
}

/// Drops the terms the index can never match. The indexed text fields use the
/// standard tokenizer, which turns a term with no letter or digit (`-`, `@`,
/// `&`) into no tokens at all, and one such clause among the ANDed terms makes
/// the whole query match nothing: `OOO - therapy` missed `OOO - therapy`.
/// Regexp and query-string input keep every term, because punctuation is
/// syntax there, and a query made only of such terms is left unchanged.
pub(in crate::api::search) fn drop_wordless_terms(
    terms: Vec<String>,
    match_type: MatchType,
) -> Vec<String> {
    if matches!(match_type, MatchType::Regexp | MatchType::Query) {
        return terms;
    }
    let has_word = |term: &String| term.chars().any(char::is_alphanumeric);
    if !terms.iter().any(has_word) {
        return terms;
    }
    terms.into_iter().filter(has_word).collect()
}

#[cfg(test)]
mod test;
