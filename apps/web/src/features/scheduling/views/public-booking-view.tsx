import { For, Show } from 'solid-js';
import { BookingPicker } from '../components/booking-picker';
import type { BookingReceipt, PublicEvent, PublicProfile } from '../core/types';
import type { BookingSource } from '../primitives/booking-flow';

export function PublicBookingView(props: {
  profile: PublicProfile;
  event?: PublicEvent;
  source: BookingSource;
  onEvent: (slug: string) => void;
  onReceipt: (r: BookingReceipt) => void;
}) {
  return (
    <main class="min-h-screen overflow-y-auto bg-panel px-4 py-6 text-ink sm:px-8 sm:py-10">
      <div class="mx-auto max-w-5xl">
        <a
          href="https://macro.com"
          class="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          Macro <span class="font-normal text-ink-muted">/ Scheduling</span>
        </a>
        <div class="mt-8 sm:mt-12">
          <Show
            when={props.event}
            fallback={
              <section class="mx-auto max-w-2xl">
                <p class="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Find a time to connect
                </p>
                <h1 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {props.profile.name}
                </h1>
                <Show when={props.profile.description}>
                  <p class="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                    {props.profile.description}
                  </p>
                </Show>
                <h2 class="mt-10 mb-3 text-sm font-medium">Choose a meeting</h2>
                <div class="flex flex-col gap-3">
                  <For
                    each={props.profile.eventTypes}
                    fallback={
                      <p class="rounded-xl border border-edge-muted bg-surface-1 p-6 text-sm text-ink-muted">
                        There are no bookable events right now.
                      </p>
                    }
                  >
                    {(event) => (
                      <button
                        type="button"
                        class="group flex items-start justify-between gap-5 rounded-xl border border-edge-muted bg-surface-1 p-5 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent sm:p-6"
                        onClick={() => props.onEvent(event.slug)}
                      >
                        <div class="min-w-0">
                          <h3 class="font-semibold">{event.title}</h3>
                          <p class="mt-2 text-xs text-ink-muted">
                            {event.durationMinutes} minutes ·{' '}
                            {event.googleMeet
                              ? 'Google Meet'
                              : event.location || 'Meeting'}
                          </p>
                          <Show when={event.description}>
                            <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                              {event.description}
                            </p>
                          </Show>
                        </div>
                        <span
                          aria-hidden="true"
                          class="shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                        >
                          →
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </section>
            }
          >
            {(event) => (
              <BookingPicker
                profile={props.profile}
                event={event()}
                source={props.source}
                onReceipt={props.onReceipt}
                onChooseEvent={
                  props.profile.eventTypes.length > 1
                    ? () => props.onEvent('')
                    : undefined
                }
              />
            )}
          </Show>
        </div>
        <p class="mt-8 text-center text-xs text-ink-muted">
          Scheduling by Macro
        </p>
      </div>
    </main>
  );
}
