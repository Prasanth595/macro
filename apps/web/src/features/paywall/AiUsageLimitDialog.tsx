import { useFeatureFlag } from '@app/lib/analytics/posthog';
import { toast } from '@core/component/Toast/Toast';
import { useAiUsageLimitState } from '@core/constant/AiUsageLimitState';
import {
  enableAiUsageBilling,
  LOCAL_ONLY,
  PROD_MODE_ENV,
} from '@core/constant/featureFlags';
import { useSettingsState } from '@core/constant/SettingsState';
import { fireAndForget } from '@core/util/fireAndForget';
import {
  useAiBillingSummaryQuery,
  useCreateBillingPortalMutation,
  useUpdateAiAutoReloadMutation,
} from '@queries/auth';
import { createSignal, Suspense } from 'solid-js';
import { isUsageAvailable, monthlyUsagePercent } from '../usage/core/usage';
import { toUsageSummary } from '../usage/queries/usage-summary';
import { useAiUsagePreview } from './ai-usage-preview';
import { AiUsageLimitDialogView } from './components/ai-usage-limit-dialog';

/**
 * Shown when the backend refuses an AI request with a billing code. Shows the
 * monthly limit and offers paid subscriptions to Free users, one-click
 * Auto-Reload to paid payers who haven't turned it on, or usage credits.
 */
export function AiUsageLimitDialog() {
  const { usageLimitOpen, usageLimitCode, hideUsageLimit } =
    useAiUsageLimitState();
  const { openSettings } = useSettingsState();
  const summary = useAiBillingSummaryQuery({ enabled: usageLimitOpen });
  const aiUsageBilling = useFeatureFlag(enableAiUsageBilling);
  const usagePreview = useAiUsagePreview();
  const autoReload = useUpdateAiAutoReloadMutation();
  const portal = useCreateBillingPortalMutation();
  const [paymentFailed, setPaymentFailed] = createSignal(false);
  const [autoReloadError, setAutoReloadError] = createSignal<string>();
  const available = () =>
    !usagePreview.beforeLaunch() &&
    isUsageAvailable(PROD_MODE_ENV && !LOCAL_ONLY, aiUsageBilling().enabled);
  const usageSnapshot = () =>
    usagePreview.withPreview(summary.isSuccess ? summary.data : undefined);
  const freePlan = () =>
    usageLimitCode() === 'ai_free_allowance_exhausted' ||
    usageSnapshot()?.tier === 'free';

  const close = () => {
    hideUsageLimit();
    setPaymentFailed(false);
    setAutoReloadError(undefined);
  };

  const usage = () => {
    const snapshot = usageSnapshot();
    return snapshot
      ? {
          percentage: monthlyUsagePercent(
            snapshot.used_cents,
            snapshot.included_cents
          ),
          periodEnd: snapshot.period_end,
          unlimited: snapshot.unlimited,
        }
      : undefined;
  };

  /** The payer's saved thresholds, when one click can turn Auto-Reload on. */
  const autoReloadSettings = () => {
    if (usagePreview.active() || !summary.isSuccess) return;
    const snapshot = summary.data;
    if (
      snapshot.tier === 'free' ||
      snapshot.unlimited ||
      !snapshot.can_manage_billing ||
      snapshot.auto_reload?.active
    )
      return;
    return toUsageSummary(snapshot).autoReload.settings;
  };

  const turnOnAutoReload = async () => {
    const settings = autoReloadSettings();
    if (!settings || autoReload.isPending) return;
    setAutoReloadError(undefined);
    try {
      const snapshot = await autoReload.mutateAsync({
        ...settings,
        enabled: true,
      });
      // Enabling reloads right away when the balance is low; a failed charge
      // comes back as a suspended reload rather than an error.
      if (snapshot.auto_reload?.suspended) {
        setPaymentFailed(true);
        return;
      }
      close();
      toast.success('Auto-reload is on. Resend your message.');
    } catch {
      setAutoReloadError("Couldn't turn on auto-reload. Please try again.");
    }
  };

  const addPaymentMethod = async () => {
    if (portal.isPending) return;
    try {
      window.location.href = await portal.mutateAsync({
        returnUrl: `${window.location.origin}/app/settings/usage`,
      });
    } catch {
      setAutoReloadError("Couldn't open payment methods. Please try again.");
    }
  };

  const autoReloadOffer = () => {
    const settings = autoReloadSettings();
    return settings
      ? {
          minimumBalanceCents: settings.minimumBalanceCents,
          targetBalanceCents: settings.targetBalanceCents,
          monthlySpendLimitCents: settings.monthlySpendLimitCents,
          pending: autoReload.isPending || portal.isPending,
          paymentFailed: paymentFailed(),
          error: autoReloadError(),
        }
      : undefined;
  };

  return (
    <Suspense fallback={null}>
      <AiUsageLimitDialogView
        open={usageLimitOpen() && available()}
        code={usageLimitCode() ?? undefined}
        freePlan={freePlan()}
        usage={usage()}
        autoReload={autoReloadOffer()}
        previewNotice={
          usagePreview.active()
            ? `Developer preview: ${usagePreview.plan() === 'free' ? 'Free' : 'paid'} plan. No account billing has changed.`
            : undefined
        }
        onClose={close}
        onOpenSettings={() => {
          const target = freePlan() ? 'Billing' : 'Usage';
          close();
          openSettings(target);
        }}
        onTurnOnAutoReload={() => fireAndForget(turnOnAutoReload(), 'usage')}
        onAddPaymentMethod={() => fireAndForget(addPaymentMethod(), 'usage')}
      />
    </Suspense>
  );
}
