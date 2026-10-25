//! When a rate-limited Gmail operation goes back to Gmail.

use email_api_client::domain::models::RateLimitOrigin;
use rand::Rng;
use std::ops::RangeInclusive;
use std::time::Duration;

#[cfg(test)]
mod test;

/// Longest delay before the first retry after Gmail rate-limited an operation
/// for a quota, which can take a minute or more to recover; each later retry
/// doubles it.
pub(crate) const PROVIDER_BACKOFF: Duration = Duration::from_secs(30);
const PROVIDER_GROWTH: f64 = 2.0;
/// Longest wait past the request gate's `retry_after` before the first retry
/// of an operation that found no free slot, whether the gate refused it or
/// Gmail answered "Too many concurrent requests"; each later retry grows it by
/// half. A slot frees up as soon as a request finishes, and after that 429 the
/// gate lowers the mailbox's cap so the retry doesn't overload Gmail again, so
/// the work keeps coming back within seconds while a burst drains. It still
/// grows, so a mailbox that stays saturated takes hours, not minutes, to use
/// up the retry queue's deliveries.
const GATE_BACKOFF: Duration = Duration::from_secs(2);
const GATE_GROWTH: f64 = 1.5;
/// Longest any retry waits, including for a longer Retry-After. The gate
/// likewise pauses a mailbox for at most a minute. At most 101 waits (the
/// hand-off to the retry queue plus its 100 deliveries) of this length add up
/// to about 8.4 hours, inside the 12-hour expiry of pending label write markers.
const MAX_DELAY: Duration = Duration::from_secs(300);

/// How long to hold a rate-limited operation before its next attempt, in
/// whole seconds and at least one.
///
/// The primary queue hands an operation to the retry queue on its first rate
/// limit, so a retry queue delivery received `n` times precedes retry `n + 1`.
pub(crate) fn next_retry_delay(
    retry_worker: bool,
    receive_count: u32,
    origin: RateLimitOrigin,
    retry_after: Option<Duration>,
) -> Duration {
    let retry = if retry_worker {
        receive_count.saturating_add(1)
    } else {
        1
    };
    retry_delay(retry, origin, retry_after, |range| {
        rand::rng().random_range(range)
    })
}

/// Exponential backoff with jitter below `retry`'s ceiling (1 for the first
/// retry), so operations rate-limited together come back spread out. A Gmail
/// quota limit waits at least half the ceiling and its Retry-After. A gate
/// refusal or Gmail concurrency limit waits out any `retry_after` first and
/// adds at least a quarter of a smaller, slower-growing ceiling, spreading the
/// work across the time slots take to free up.
fn retry_delay(
    retry: u32,
    origin: RateLimitOrigin,
    retry_after: Option<Duration>,
    jitter: impl FnOnce(RangeInclusive<Duration>) -> Duration,
) -> Duration {
    let retry_after = retry_after.unwrap_or_default();
    let delay = match origin {
        RateLimitOrigin::Provider { concurrency: false } => {
            let ceiling = ceiling(PROVIDER_BACKOFF, PROVIDER_GROWTH, retry);
            jitter(ceiling / 2..=ceiling).max(retry_after)
        }
        RateLimitOrigin::Provider { concurrency: true } | RateLimitOrigin::Local => {
            let ceiling = ceiling(GATE_BACKOFF, GATE_GROWTH, retry);
            retry_after.saturating_add(jitter(ceiling / 4..=ceiling))
        }
    };
    let delay = delay.min(MAX_DELAY);
    // SQS counts whole seconds; rounding down would retry before Retry-After.
    let seconds = delay
        .as_secs()
        .saturating_add(u64::from(delay.subsec_nanos() > 0));
    Duration::from_secs(seconds.max(1))
}

fn ceiling(base: Duration, growth: f64, retry: u32) -> Duration {
    let exponent = i32::try_from(retry.saturating_sub(1)).unwrap_or(i32::MAX);
    Duration::try_from_secs_f64(base.as_secs_f64() * growth.powi(exponent))
        .map_or(MAX_DELAY, |ceiling| ceiling.min(MAX_DELAY))
}
