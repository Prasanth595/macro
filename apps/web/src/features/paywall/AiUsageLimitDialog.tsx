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
  useAiBillingPlansQuery,
  useAiBillingSummaryQuery,
  useCreateAiCreditCheckoutMutation,
  useCreateBillingPortalMutation,
  useUpdateAiAutoReloadMutation,
} from '@queries/auth';
import { queryReadyGate } from '@queries/gate';
import { createSignal, Suspense } from 'solid-js';
import {
  isUsageAvailable,
  parseDollarInput,
  validateAutoReload,
} from '../usage/core/usage';
import { toUsageSummary } from '../usage/queries/usage-summary';
import { useAiUsagePreview } from './ai-usage-preview';
import {
  AiUsageLimitDialogView,
  type PurchaseMode,
} from './components/ai-usage-limit-dialog';

/**
 * Shown when the backend refuses an AI request with a billing code. Offers
 * paid subscriptions to Free users, and to paid payers a one-time credit
 * purchase or one-click Auto-Reload when it isn't on.
 */
export function AiUsageLimitDialog() {
  const { usageLimitOpen, usageLimitCode, hideUsageLimit } =
    useAiUsageLimitState();
  const { openSettings } = useSettingsState();
  const summary = useAiBillingSummaryQuery({ enabled: usageLimitOpen });
  const plans = useAiBillingPlansQuery();
  const aiUsageBilling = useFeatureFlag(enableAiUsageBilling);
  const usagePreview = useAiUsagePreview();
  const autoReload = useUpdateAiAutoReloadMutation();
  const portal = useCreateBillingPortalMutation();
  const checkout = useCreateAiCreditCheckoutMutation();
  const [mode, setMode] = createSignal<PurchaseMode>('credits');
  /** The chosen credit pack; unset shows the smallest. */
  const [packCents, setPackCents] = createSignal<number>();
  const [paymentFailed, setPaymentFailed] = createSignal(false);
  const [offerError, setOfferError] = createSignal<string>();
  /** The payer's edit to the monthly limit; unset shows the plan default. */
  const [monthlyLimitInput, setMonthlyLimitInput] = createSignal<string>();
  const available = () =>
    !usagePreview.beforeLaunch() &&
    isUsageAvailable(PROD_MODE_ENV && !LOCAL_ONLY, aiUsageBilling().enabled);
  const usageSnapshot = () =>
    usagePreview.withPreview(
      queryReadyGate(summary) ? summary.data : undefined
    );
  const freePlan = () =>
    usageLimitCode() === 'ai_free_allowance_exhausted' ||
    usageSnapshot()?.tier === 'free';

  const close = () => {
    hideUsageLimit();
    setPaymentFailed(false);
    setOfferError(undefined);
    setMonthlyLimitInput(undefined);
    setMode('credits');
    setPackCents(undefined);
  };

  /** The paid payer's position and plan catalog, when they can buy more. */
  const payer = () => {
    // The plan catalog supplies credit packs and Auto-Reload's starting values.
    if (
      usagePreview.active() ||
      !queryReadyGate(summary) ||
      !queryReadyGate(plans)
    )
      return;
    const snapshot = summary.data;
    if (
      snapshot.tier === 'free' ||
      snapshot.unlimited ||
      !snapshot.can_manage_billing
    )
      return;
    return { snapshot, catalog: plans.data };
  };

  /** The payer's starting thresholds, when one click can turn Auto-Reload on. */
  const autoReloadSettings = () => {
    const current = payer();
    // Keep the offer while a failed charge is shown: a declined reload
    // leaves Auto-Reload active with its invoice still open.
    if (!current || (current.snapshot.auto_reload?.active && !paymentFailed()))
      return;
    return toUsageSummary(current.snapshot, current.catalog).autoReload
      .settings;
  };

  const selectedPack = () =>
    packCents() ?? payer()?.catalog.credit_packs_cents[0];

  const buyCredits = async () => {
    const amountCents = selectedPack();
    if (amountCents === undefined || checkout.isPending) return;
    setOfferError(undefined);
    // Come back to this page so the user can resend from where they were.
    const here = window.location.href;
    try {
      window.location.href = await checkout.mutateAsync({
        amountCents,
        successUrl: here,
        cancelUrl: here,
      });
    } catch {
      setOfferError("Couldn't open checkout. Please try again.");
    }
  };

  const monthlyLimit = () => {
    const input = monthlyLimitInput();
    if (input !== undefined) return input;
    const limit = autoReloadSettings()?.monthlySpendLimitCents;
    return limit === null || limit === undefined ? '' : String(limit / 100);
  };

  /** Saved thresholds with the payer's monthly limit; blank means no limit. */
  const chosenSettings = () => {
    const settings = autoReloadSettings();
    if (!settings) return;
    const text = monthlyLimit().trim();
    const monthlySpendLimitCents = text ? parseDollarInput(text) : null;
    if (monthlySpendLimitCents === undefined)
      return {
        error: 'Enter a monthly spend limit in dollars, or leave it blank.',
      };
    const chosen = { ...settings, monthlySpendLimitCents, enabled: true };
    const error = validateAutoReload(chosen);
    return error ? { error } : { settings: chosen };
  };

  const turnOnAutoReload = async () => {
    const chosen = chosenSettings();
    if (!chosen || autoReload.isPending) return;
    if ('error' in chosen) {
      setOfferError(chosen.error);
      return;
    }
    setOfferError(undefined);
    try {
      const snapshot = await autoReload.mutateAsync(chosen.settings);
      // Enabling reloads right away when the balance is low. A failed charge
      // comes back as a suspended reload, and a declined one as an open
      // invoice, so only usable credits mean the user can resend.
      if (snapshot.auto_reload?.suspended || snapshot.remaining_cents <= 0) {
        setPaymentFailed(true);
        return;
      }
      close();
      toast.success('Auto-reload is on. Resend your message.');
    } catch {
      setOfferError("Couldn't turn on auto-reload. Please try again.");
    }
  };

  const addPaymentMethod = async () => {
    if (portal.isPending) return;
    try {
      window.location.href = await portal.mutateAsync({
        returnUrl: `${window.location.origin}/app/settings/usage`,
      });
    } catch {
      setOfferError("Couldn't open payment methods. Please try again.");
    }
  };

  const offer = () => {
    const current = payer();
    const pack = selectedPack();
    if (!current || pack === undefined) return;
    const settings = autoReloadSettings();
    return {
      mode: settings ? mode() : ('credits' as const),
      packsCents: current.catalog.credit_packs_cents,
      packCents: pack,
      autoReload: settings && {
        minimumBalanceCents: settings.minimumBalanceCents,
        targetBalanceCents: settings.targetBalanceCents,
        monthlyLimit: monthlyLimit(),
        paymentFailed: paymentFailed(),
      },
      pending: autoReload.isPending || portal.isPending || checkout.isPending,
      error: offerError(),
    };
  };

  return (
    <Suspense fallback={null}>
      <AiUsageLimitDialogView
        open={usageLimitOpen() && available()}
        code={usageLimitCode() ?? undefined}
        freePlan={freePlan()}
        resetsAt={usageSnapshot()?.period_end}
        offer={offer()}
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
        onMode={(next) => {
          setOfferError(undefined);
          setMode(next);
        }}
        onPack={(cents) => {
          setOfferError(undefined);
          setPackCents(cents);
        }}
        onBuyCredits={() => fireAndForget(buyCredits(), 'usage')}
        onMonthlyLimit={(value) => {
          setOfferError(undefined);
          setMonthlyLimitInput(value);
        }}
        onTurnOnAutoReload={() => fireAndForget(turnOnAutoReload(), 'usage')}
        onAddPaymentMethod={() => fireAndForget(addPaymentMethod(), 'usage')}
      />
    </Suspense>
  );
}
