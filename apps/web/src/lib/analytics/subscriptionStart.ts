/**
 * Subscription-start tracking for Google Ads.
 *
 * The Stripe webhook already reports purchases to GA4, Meta, and PostHog, but
 * a server-side GA4 event carries no ad click, so Google Ads never attributed
 * one. The browser returning from checkout holds the `_gcl_aw` click cookie,
 * so the Ads conversion fires here once the server confirms an active or
 * trialing license — a success URL alone is not proof of a subscription.
 */
import type { AnalyticsInterface } from './analytics';
import {
  SUBSCRIPTION_START_VALUE_BY_TIER,
  SUBSCRIPTION_START_VALUE_DEFAULT,
} from './leadValues';

/** `tier` is the checkout's `type` return param; unknown tiers use the default value. */
export function trackSubscriptionStart(
  analytics: Pick<AnalyticsInterface, 'trackGoogleConversion'>,
  userId: string,
  tier: string | undefined
) {
  analytics.trackGoogleConversion('subscription_start', {
    value:
      (tier ? SUBSCRIPTION_START_VALUE_BY_TIER[tier] : undefined) ??
      SUBSCRIPTION_START_VALUE_DEFAULT,
    currency: 'USD',
    // Onboarding and the in-app paywall can both confirm the same checkout;
    // Google dedupes on transaction_id, so the user counts once.
    transaction_id: `subscription_start:${userId}`,
  });
}
