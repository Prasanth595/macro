import type { ParentProps } from 'solid-js';

export function PublicBookingLayout(
  props: ParentProps<{ brandTarget?: '_blank' }>
) {
  return (
    <div class="@container/public-booking flex min-h-full flex-1 flex-col bg-panel text-ink">
      <div class="flex flex-1 flex-col px-4 py-6 @min-[640px]/public-booking:px-8 @min-[640px]/public-booking:py-10">
        <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <a
            href="https://macro.com"
            target={props.brandTarget}
            rel={props.brandTarget ? 'noopener noreferrer' : undefined}
            class="inline-flex items-center gap-2 self-start text-sm font-semibold tracking-tight"
          >
            Macro <span class="font-normal text-ink-muted">/ Scheduling</span>
          </a>
          <div class="mt-8 @min-[640px]/public-booking:mt-12">
            {props.children}
          </div>
          <p class="mt-auto pt-8 text-center text-xs text-ink-muted">
            Scheduling by Macro
          </p>
        </div>
      </div>
    </div>
  );
}
