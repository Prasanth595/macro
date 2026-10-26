import type { AiDenyCode } from '@service-auth/ai-billing-types';
import { Button, Dialog, InputGroup, Surface, TextField } from '@ui';
import { Show, Suspense } from 'solid-js';
import { MonthlyLimit } from '../../usage/components/monthly-limit';
import { formatCreditBalance } from '../../usage/core/usage';

const TITLES: Record<AiDenyCode, string> = {
  ai_allowance_exhausted: "You've used this month's included AI",
  ai_free_allowance_exhausted: "You've used this month's free AI",
  ai_overage_limit_reached: "You've hit your AI spending limit",
  ai_overage_payment_failed: 'Your last AI usage charge failed',
};

/** One-click Auto-Reload offered to a paid payer who hasn't turned it on. */
export type AutoReloadOffer = {
  minimumBalanceCents: number;
  targetBalanceCents: number;
  /** Dollars, as typed; blank means no limit. */
  monthlyLimit: string;
  pending: boolean;
  /** The card on file could not be charged; offer to add a payment method. */
  paymentFailed: boolean;
  error?: string;
};

export type AiUsageLimitDialogProps = {
  open: boolean;
  code?: AiDenyCode;
  freePlan: boolean;
  usage?: { percentage: number; periodEnd: string; unlimited: boolean };
  autoReload?: AutoReloadOffer;
  previewNotice?: string;
  onClose: () => void;
  onOpenSettings: () => void;
  onMonthlyLimit?: (value: string) => void;
  onTurnOnAutoReload?: () => void;
  onAddPaymentMethod?: () => void;
};

export function AiUsageLimitDialogView(props: AiUsageLimitDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      position="center"
      class="w-160"
    >
      <Surface depth={2} class="rounded-xl">
        <section class="flex flex-col gap-5 p-6 font-sans">
          <div class="flex flex-col gap-1">
            <Dialog.Title class="text-xl font-semibold text-ink">
              {TITLES[props.code ?? 'ai_allowance_exhausted']}
            </Dialog.Title>
            <Dialog.Description class="text-sm text-ink-extra-muted">
              {props.freePlan
                ? 'Subscribe to a paid plan to keep going.'
                : props.autoReload
                  ? 'Turn on auto-reload to keep going.'
                  : props.usage
                    ? 'Add additional credits to keep going.'
                    : 'Check your plan and usage options to keep going.'}
            </Dialog.Description>
          </div>

          <Show when={props.previewNotice}>
            <p class="text-xs text-ink-muted" role="status">
              {props.previewNotice}
            </p>
          </Show>

          {/* The summary is a suspending query resource; keep its
              suspension inside the dialog rather than the route boundary. */}
          <Suspense fallback={null}>
            <Show when={props.usage}>
              {(snapshot) => (
                <div class="flex flex-col gap-4 rounded-lg bg-active p-4">
                  <MonthlyLimit
                    percentage={snapshot().percentage}
                    periodEnd={snapshot().periodEnd}
                    unlimited={snapshot().unlimited}
                  />
                </div>
              )}
            </Show>
          </Suspense>

          <Show when={props.autoReload}>
            {(offer) => (
              <div class="flex flex-col gap-1 text-sm">
                <p class="text-ink">
                  When your credit balance drops below{' '}
                  {formatCreditBalance(offer().minimumBalanceCents)}, Macro
                  charges your card on file to bring it back to{' '}
                  {formatCreditBalance(offer().targetBalanceCents)}.
                </p>
                <TextField
                  value={offer().monthlyLimit}
                  onChange={(value) => props.onMonthlyLimit?.(value)}
                  class="mt-2 flex flex-col gap-1"
                >
                  <TextField.Label class="text-ink">
                    Monthly spend limit
                  </TextField.Label>
                  <TextField.Description class="text-ink-extra-muted">
                    The most auto-reload charges in a month. Leave blank for no
                    limit. Change it or turn auto-reload off in usage settings.
                  </TextField.Description>
                  <InputGroup size="xl" class="sm:max-w-48">
                    <TextField.Input
                      as={InputGroup.Input}
                      inputMode="decimal"
                      class="text-sm"
                      placeholder="No limit"
                    />
                    <InputGroup.Addon aria-hidden="true">$</InputGroup.Addon>
                  </InputGroup>
                </TextField>
                <Show
                  when={
                    offer().error ??
                    (offer().paymentFailed
                      ? "We couldn't charge your card. Add a payment method, then turn on auto-reload again."
                      : undefined)
                  }
                >
                  {(message) => (
                    <p class="text-failure-ink" role="alert">
                      {message()}
                    </p>
                  )}
                </Show>
              </div>
            )}
          </Show>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant={props.freePlan ? 'accent' : 'ghost'}
              depth={3}
              class="px-3 py-1.5"
              onClick={props.onOpenSettings}
            >
              {props.freePlan ? 'View plans' : 'Open usage settings'}
            </Button>
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                depth={3}
                class="px-3 py-1.5"
                onClick={props.onClose}
              >
                Dismiss
              </Button>
              <Show when={props.autoReload}>
                {(offer) => (
                  <Button
                    variant="accent"
                    depth={3}
                    class="px-3 py-1.5"
                    disabled={offer().pending}
                    onClick={
                      offer().paymentFailed
                        ? props.onAddPaymentMethod
                        : props.onTurnOnAutoReload
                    }
                  >
                    {offer().paymentFailed
                      ? offer().pending
                        ? 'Opening…'
                        : 'Add payment method'
                      : offer().pending
                        ? 'Turning on…'
                        : 'Turn on auto-reload'}
                  </Button>
                )}
              </Show>
            </div>
          </div>
        </section>
      </Surface>
    </Dialog>
  );
}
