import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Billing } from './Billing';

const mocks = vi.hoisted(() => ({
  eligibility: {
    isSuccess: true,
    isPending: false,
    isError: false,
    data: { eligible: false },
    refetch: vi.fn(),
  },
  checkout: vi.fn(() => new Promise<string>(() => {})),
}));
vi.mock('@app/lib/analytics/analytics-context', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock('@app/lib/analytics/posthog', () => ({
  useFeatureFlag: () => () => ({ enabled: false }),
}));
vi.mock('@core/auth', () => ({ useHasPaidAccess: () => () => false }));
vi.mock('@core/constant/featureFlags', () => ({
  LOCAL_ONLY: false,
  enableAiUsageBilling: {},
}));
vi.mock('@core/context/user', () => ({
  usePermissions: () => () => ['write:stripe_subscription'],
  useUserId: () => () => 'macro|returning@example.com',
}));
vi.mock('@queries/team/teams', () => ({
  useCurrentTeamQuery: () => ({ isSuccess: true, data: undefined }),
}));
vi.mock('@queries/auth', () => ({
  useAiBillingSummaryQuery: () => ({
    isSuccess: true,
    data: { tier: 'free', can_manage_billing: true },
  }),
  useSubscriptionStatusQuery: () => ({ isPending: true }),
  useTrialEligibilityQuery: () => mocks.eligibility,
  useChangePlanMutation: () => ({ isPending: false }),
  useCreateCheckoutSessionMutation: () => ({
    isPending: false,
    mutateAsync: mocks.checkout,
  }),
}));
vi.mock('@service-stripe/client', () => ({ stripeServiceClient: {} }));
vi.mock('@core/component/Toast/Toast', () => ({ toast: { failure: vi.fn() } }));

beforeEach(() => {
  mocks.checkout.mockClear();
  Object.assign(mocks.eligibility, {
    isSuccess: true,
    isPending: false,
    isError: false,
    data: { eligible: false },
  });
});
afterEach(cleanup);

it.each([true, false])(
  'Billing sends the terms it advertises (eligible=%s)',
  (eligible) => {
    mocks.eligibility.data.eligible = eligible;
    render(() => <Billing />);
    expect(screen.queryByText('Free for one month!') !== null).toBe(eligible);
    fireEvent.click(screen.getByRole('button', { name: 'Get Pro' }));
    expect(mocks.checkout).toHaveBeenCalledWith({
      plan: 'premium',
      onboardingTrial: eligible,
    });
  }
);

it.each(['loading', 'error'])(
  'does not sell Pro on unconfirmed terms while eligibility is %s',
  (status) => {
    Object.assign(mocks.eligibility, {
      isSuccess: false,
      isPending: status === 'loading',
      isError: status === 'error',
    });
    render(() => <Billing />);
    expect(screen.queryByText('Free for one month!')).toBeNull();
    const button = screen.getByRole('button', { name: 'Get Pro' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(mocks.checkout).not.toHaveBeenCalled();
    if (status === 'error') {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(mocks.eligibility.refetch).toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Get Max' }));
    expect(mocks.checkout).toHaveBeenCalledWith({
      plan: 'max',
      onboardingTrial: false,
    });
  }
);
