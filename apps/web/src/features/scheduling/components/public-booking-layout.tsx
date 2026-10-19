import { isNativeMobilePlatform } from '@core/mobile/isNativeMobilePlatform';
import ArrowLeftIcon from '@phosphor/arrow-left.svg';
import { Button, cn } from '@ui';
import { type JSX, type ParentProps, Show } from 'solid-js';

export function PublicBookingLayout(
  props: ParentProps<{
    brandTarget?: '_blank';
    branding?: JSX.Element;
    embedded?: boolean;
  }>
) {
  const showMobileBack = () => isNativeMobilePlatform() && !props.embedded;
  return (
    <div class="@container/public-booking flex min-h-full flex-1 flex-col bg-panel text-ink">
      <Show when={showMobileBack()}>
        <header class="sticky top-0 z-10 flex items-center gap-2 bg-panel/95 px-2 py-2 backdrop-blur-sm safe-top">
          <Button
            variant="ghost"
            size="icon-md"
            label="Back to Macro"
            onClick={() => {
              window.location.replace('/app');
            }}
          >
            <ArrowLeftIcon />
          </Button>
        </header>
      </Show>
      <div
        class={cn(
          'flex flex-1 flex-col px-4 @min-[640px]/public-booking:px-8',
          props.embedded ? 'py-4' : 'py-6 @min-[640px]/public-booking:py-10',
          showMobileBack() && 'pt-2'
        )}
      >
        <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <Show when={!props.embedded}>
            {props.branding ?? (
              <PublicBookingBrand target={props.brandTarget} />
            )}
          </Show>
          <div
            class={cn(
              !props.embedded && 'mt-8 @min-[640px]/public-booking:mt-12'
            )}
          >
            {props.children}
          </div>
          <Show when={!props.embedded}>
            <p class="mt-auto pt-8 text-center text-xs text-ink-muted">
              Scheduling by Macro
            </p>
          </Show>
        </div>
      </div>
    </div>
  );
}

export function PublicBookingBrand(props: { target?: '_blank' }) {
  return (
    <a
      href="https://macro.com"
      aria-label="Macro Scheduling"
      target={props.target}
      rel={props.target ? 'noopener noreferrer' : undefined}
      class="inline-flex items-center gap-2 self-start text-sm font-semibold tracking-tight"
    >
      Macro <span class="font-normal text-ink-muted">/ Scheduling</span>
    </a>
  );
}
