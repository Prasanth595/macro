//! Deterministic source preservation and invitation policy shared by extraction providers.
use super::{ExtractInputRequest, InputIntent, InputSuggestions};
use chrono::{Datelike, Duration, NaiveDateTime, Timelike};
use regex::Regex;
use std::sync::OnceLock;

#[cfg(test)]
mod test;

impl ExtractInputRequest {
    /// A body already specified literally, which must not be shortened by inference.
    pub fn literal_body(&self) -> Option<String> {
        if self.intent == InputIntent::Note {
            return Some(self.text.clone());
        }
        let pattern = match self.intent {
            InputIntent::Email => {
                r"(?i)^(?:email(?:\s+to)?|send\s+(?:an?\s+)?email(?:\s+to)?)(?:\s+|$)(.*)$"
            }
            InputIntent::Message => {
                r"(?i)^(?:dm|message|send\s+(?:a\s+)?message(?:\s+to)?)(?:\s+|$)(.*)$"
            }
            _ => return None,
        };
        static EMAIL: OnceLock<Regex> = OnceLock::new();
        static MESSAGE: OnceLock<Regex> = OnceLock::new();
        static INLINE: OnceLock<Regex> = OnceLock::new();
        let addressing = if self.intent == InputIntent::Email {
            &EMAIL
        } else {
            &MESSAGE
        }
        .get_or_init(|| Regex::new(pattern).expect("fixed addressing expression"));
        let text = self.text.trim_start();
        let (first, remaining) = text
            .split_once('\n')
            .map_or((text, None), |(a, b)| (a, Some(b)));
        let names = addressing.captures(first)?.get(1)?.as_str();
        let inline = INLINE.get_or_init(|| {
            Regex::new(r"(?i)^(.+?)\s+(?:that|saying)\s+(.+)$")
                .expect("fixed inline addressing expression")
        });
        if let Some(parts) = inline.captures(names) {
            let body = parts.get(2)?.as_str();
            return Some(match remaining {
                Some(rest) => format!("{body}\n{rest}"),
                None => body.to_owned(),
            });
        }
        remaining.map(str::to_owned)
    }

    /// Mentioning a person in a title does not authorize inviting them.
    pub fn requests_guests(&self) -> bool {
        static INVITATION: OnceLock<Regex> = OnceLock::new();
        static NO_INVITATION: OnceLock<Regex> = OnceLock::new();
        if NO_INVITATION.get_or_init(|| Regex::new(r"(?i)\b(?:do\s+not|don't|dont|without|no)\s+(?:invite|inviting|invitations?|guests?|attendees?|participants?)\b").expect("fixed no-invitation expression")).is_match(&self.text) {
            return false;
        }
        INVITATION
            .get_or_init(|| {
                Regex::new(
                    r"(?i)\b(?:invite|inviting|invitations?|guests?|attendees?|participants?)\b",
                )
                .expect("fixed invitation expression")
            })
            .is_match(&self.text)
    }
}

pub(super) fn preserve(input: &ExtractInputRequest, fields: &mut InputSuggestions) {
    if let Some(body) = input.literal_body() {
        fields.body = Some(body);
    }
    if input.intent == InputIntent::Email && fields.subject.is_none() {
        // A source excerpt is preferable to an invented subject or a missing field.
        fields.subject = fields
            .body
            .as_deref()
            .and_then(|body| body.lines().map(str::trim).find(|line| !line.is_empty()))
            .map(|line| line.chars().take(80).collect());
    }
    if input.intent == InputIntent::Calendar && !input.requests_guests() {
        fields.guests.clear();
    }
}

/// Apply the product's editable AM/PM default to an explicitly supplied bare hour.
pub(super) fn assume_clock(input: &ExtractInputRequest, fields: &mut InputSuggestions) {
    static CLOCK: OnceLock<Regex> = OnceLock::new();
    static EXPLICIT: OnceLock<Regex> = OnceLock::new();
    let explicit = EXPLICIT.get_or_init(|| Regex::new(r"(?i)\b(?:am|pm|morning|afternoon|evening|night|noon|midnight|utc|gmt)\b|\d\s*(?:am|pm)\b").expect("fixed explicit clock expression"));
    if explicit.is_match(&input.text) {
        return;
    }
    let clock = CLOCK.get_or_init(|| {
        Regex::new(r"(?i)\bat\s+(\d{1,2})(?::(\d{2}))?\b").expect("fixed bare clock expression")
    });
    let Some(captures) = clock.captures(&input.text) else {
        return;
    };
    let raw = captures.get(1).expect("clock has an hour").as_str();
    let Ok(hour) = raw.parse::<u32>() else {
        return;
    };
    if !(1..=12).contains(&hour) || raw.starts_with('0') {
        return;
    }
    let Some(start) = fields
        .start
        .as_deref()
        .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").ok())
    else {
        return;
    };
    if start.hour() % 12 != hour % 12 {
        return;
    }
    let assumed = if hour <= 7 { hour + 12 } else { hour };
    let Some(adjusted) = start.with_hour(assumed) else {
        return;
    };
    let shift = adjusted - start;
    fields.start = Some(adjusted.format("%Y-%m-%dT%H:%M").to_string());
    // Keep an inferred end in the same AM/PM frame before duration normalization.
    if shift != Duration::zero() {
        fields.end = fields
            .end
            .as_deref()
            .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").ok())
            .and_then(|end| {
                if end.hour() / 12 == start.hour() / 12 {
                    end.checked_add_signed(shift)
                } else {
                    Some(end)
                }
            })
            .map(|end| end.format("%Y-%m-%dT%H:%M").to_string());
    }
}

/// Anchor an explicit "next week <weekday>" to the user's local calendar.
pub(super) fn resolve_next_weekday(
    input: &ExtractInputRequest,
    fields: &mut InputSuggestions,
    zone: chrono_tz::Tz,
) {
    static NEXT_WEEK: OnceLock<Regex> = OnceLock::new();
    let pattern = NEXT_WEEK.get_or_init(|| {
        Regex::new(r"(?i)\bnext\s+week\s+(?:on\s+)?([a-z]+)\b")
            .expect("fixed next-weekday expression")
    });
    let Some(captures) = pattern.captures(&input.text) else {
        return;
    };
    let word = captures[1].to_ascii_lowercase();
    let weekdays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ];
    let day = weekdays.iter().position(|name| {
        if *name == word || name[..3] == word {
            return true;
        }
        // Accept a single adjacent transposition, e.g. "thrusday".
        if name.len() != word.len() {
            return false;
        }
        let mut spelling = word.as_bytes().to_vec();
        for index in 0..spelling.len().saturating_sub(1) {
            spelling.swap(index, index + 1);
            if spelling == name.as_bytes() {
                return true;
            }
            spelling.swap(index, index + 1);
        }
        false
    });
    let Some(day) = day else {
        return;
    };
    let local = input.reference_time.with_timezone(&zone);
    let offset = 7 - i64::from(local.weekday().num_days_from_monday()) + day as i64;
    let Some(date) = local
        .date_naive()
        .checked_add_signed(Duration::days(offset))
    else {
        return;
    };
    let Some(start) = fields
        .start
        .as_deref()
        .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").ok())
    else {
        return;
    };
    let adjusted = date.and_time(start.time());
    let shift = adjusted - start;
    fields.start = Some(adjusted.format("%Y-%m-%dT%H:%M").to_string());
    fields.end = fields
        .end
        .as_deref()
        .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").ok())
        .and_then(|end| end.checked_add_signed(shift))
        .map(|end| end.format("%Y-%m-%dT%H:%M").to_string());
}
