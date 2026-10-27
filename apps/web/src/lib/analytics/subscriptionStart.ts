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
import { SUBSCRIPTION_START_VALUE } from './leadValues';

export function trackSubscriptionStart(
  analytics: Pick<AnalyticsInterface, 'trackGoogleConversion'>,
  userId: string
) {
  analytics.trackGoogleConversion('subscription_start', {
    value: SUBSCRIPTION_START_VALUE,
    currency: 'USD',
    // Onboarding and the in-app paywall can both confirm the same checkout;
    // Google dedupes on transaction_id, so the user counts once.
    transaction_id: `subscription_start:${userId}`,
  });
}
