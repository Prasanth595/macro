import { WorkspaceTexture } from '@app/components/WorkspaceTexture';
import { animateOnboardingStep } from '@app/features/onboarding/components/motion/step-transition';
import ArrowLeftIcon from '@icon/system/regular/arrow-left.svg';
import { Button, cn } from '@ui';
import {
  createEffect,
  createUniqueId,
  For,
  type JSX,
  on,
  Show,
  useContext,
} from 'solid-js';
import { SettingsSheetContext } from '../primitives';
import './agent-wizard.css';

/**
 * A one-question-per-screen shell in the onboarding style: a slab headline
 * under the hero, an accent glow with grain behind it, progress along the top,
 * and the step's actions right under its fields. Steps own their fields; this
 * owns the frame.
 */
export function AgentWizard(props: {
  /** Accessible name for the wizard region. */
  label: string;
  /** CSS color the backdrop glows in. */
  accent: string;
  hero: JSX.Element;
  /** Zero-based; equal to `stepCount` once every step is done. */
  step: number;
  stepCount: number;
  title: JSX.Element;
  description?: JSX.Element;
  children: JSX.Element;
  /** The step's buttons; a submit button continues through the form. */
  actions: JSX.Element;
  onBack?: () => void;
  onCancel?: () => void;
  busy?: boolean;
  onSubmit: () => void;
}) {
  const inSheet = useContext(SettingsSheetContext);
  const noiseId = createUniqueId();
  let body!: HTMLDivElement;
  createEffect(
    on(
      () => props.step,
      () => {
        animateOnboardingStep(body, 'in');
        body.querySelector('h1')?.focus({ preventScroll: true });
        const scroller = body.closest('[data-agent-wizard-scroll]');
        if (scroller) scroller.scrollTop = 0;
      },
      { defer: true }
    )
  );
  return (
    <section
      data-agent-wizard
      aria-label={props.label}
      class="relative isolate h-full min-h-0 overflow-hidden bg-panel text-ink [&_[data-variant=cta]]:bg-ink [&_[data-variant=cta]]:text-panel [&_[data-variant=cta]]:focus-visible:ring-panel/70"
      style={{ '--agent-wizard-accent': props.accent }}
    >
      <header
        class={cn(
          'absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-gradient-to-b from-panel from-60% to-transparent px-4 pb-4',
          inSheet
            ? 'pt-2'
            : 'pt-4 touch:pt-[calc(var(--mobile-content-inset-top,0px)+0.75rem)]'
        )}
      >
        <div>
          <Show when={props.onBack}>
            {(onBack) => (
              <Button
                type="button"
                variant="ghost"
                size="icon-md"
                aria-label="Back"
                disabled={props.busy}
                onClick={onBack()}
              >
                <ArrowLeftIcon />
              </Button>
            )}
          </Show>
        </div>
        <div aria-hidden="true" class="flex items-center gap-1.5">
          <For each={Array.from({ length: props.stepCount }, (_, i) => i)}>
            {(index) => (
              <span
                class={cn(
                  'h-1 w-7 rounded-full transition-colors duration-300',
                  index <= props.step ? 'bg-ink' : 'bg-ink/12'
                )}
              />
            )}
          </For>
        </div>
        <div class="flex justify-end">
          <Show when={props.onCancel}>
            {(onCancel) => (
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={props.busy}
                onClick={onCancel()}
              >
                Cancel
              </Button>
            )}
          </Show>
        </div>
      </header>

      <div
        data-agent-wizard-scroll
        data-drawer-scroll-body={inSheet ? true : undefined}
        class="h-full overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <form
          class={cn(
            'flex min-h-full flex-col items-center justify-center px-6',
            inSheet
              ? 'pt-14 pb-[max(24px,var(--mobile-sheet-safe-padding))]'
              : 'pt-20 pb-12 touch:pt-[calc(var(--mobile-content-inset-top,0px)+4.5rem)] touch:pb-[calc(var(--mobile-content-inset-bottom,0px)+2rem)]'
          )}
          onSubmit={(event) => {
            event.preventDefault();
            props.onSubmit();
          }}
        >
          <div
            ref={body}
            class="flex w-full max-w-lg flex-col items-center text-center"
          >
            <p class="sr-only">
              {props.step < props.stepCount
                ? `Step ${props.step + 1} of ${props.stepCount}`
                : 'Done'}
            </p>
            <div class="relative flex items-center justify-center">
              <div
                aria-hidden="true"
                class="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  class="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 50% 50% at center, color-mix(in srgb, var(--agent-wizard-accent) 24%, transparent) 0%, color-mix(in srgb, var(--agent-wizard-accent) 9%, transparent) 20%, color-mix(in srgb, var(--agent-wizard-accent) 2%, transparent) 40%, transparent 72%)',
                    filter: 'blur(12px)',
                  }}
                />
                <WorkspaceTexture
                  accent="var(--agent-wizard-accent)"
                  filterId={noiseId}
                />
              </div>
              {props.hero}
            </div>
            <h1
              tabindex="-1"
              class="mt-7 font-[Roboto_Slab_Variable] text-[28px] font-[315] leading-[1.2] tracking-[-.025em] outline-none [text-wrap:balance] sm:text-[34px]"
            >
              {props.title}
            </h1>
            <Show when={props.description}>
              <p class="mt-3 max-w-[420px] text-sm leading-6 text-ink-muted [text-wrap:balance] sm:text-[15px]">
                {props.description}
              </p>
            </Show>
            <div class="mt-8 w-full text-left empty:hidden">
              {props.children}
            </div>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-2">
              {props.actions}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
