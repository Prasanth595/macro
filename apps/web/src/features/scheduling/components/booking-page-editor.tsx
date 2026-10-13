import { createResizeObserver } from '@solid-primitives/resize-observer';
import { Button, Tabs } from '@ui';
import { createSignal, Show } from 'solid-js';
import type { PublicProfile } from '../core/types';
import { Field, TextArea, TextInput } from './fields';
import { PublicBookingLayout } from './public-booking-layout';
import { PublicBookingProfile } from './public-booking-profile';

export function BookingPageEditor(props: {
  profile: PublicProfile;
  canEdit: boolean;
  saving: boolean;
  hasChanges: boolean;
  onName: (name: string) => void;
  onDescription: (description: string) => void;
  onSave: () => void;
}) {
  const [mode, setMode] = createSignal<'edit' | 'preview'>('edit');
  return (
    <form
      aria-label="Booking page details"
      aria-busy={props.saving}
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-edge-muted bg-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          mode() !== 'edit' ||
          !props.canEdit ||
          props.saving ||
          !props.hasChanges
        )
          return;
        props.onSave();
      }}
    >
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-edge-muted px-4 py-3">
        <Tabs
          aria-label="Booking page mode"
          list={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Preview' },
          ]}
          value={mode()}
          onChange={(value) => {
            if (value === 'edit' || value === 'preview') setMode(value);
          }}
        />
        <Show when={mode() === 'edit'}>
          <Button
            type="submit"
            variant="cta"
            aria-label={
              props.saving ? 'Saving booking page' : 'Save booking page'
            }
            disabled={!props.canEdit || !props.hasChanges || props.saving}
          >
            {props.saving ? 'Saving…' : 'Save'}
          </Button>
        </Show>
      </div>
      <Show when={props.hasChanges}>
        <span role="status" class="sr-only">
          Unsaved changes
        </span>
      </Show>
      <section
        aria-label="Booking page preview"
        class="flex min-h-0 flex-1 flex-col"
      >
        <div class="min-h-0 flex-1 overflow-y-auto">
          <PublicBookingLayout brandTarget="_blank">
            <Show
              when={mode() === 'edit'}
              fallback={<PublicBookingProfile profile={props.profile} />}
            >
              <PublicBookingProfile
                profile={props.profile}
                heading={
                  <Field label="Display name" labelClass="sr-only" class="mt-3">
                    <TextInput
                      class="h-[1lh] min-h-0 border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight ring-1 ring-edge-frame @min-[640px]/public-booking:text-4xl"
                      placeholder="Your name or team name"
                      disabled={!props.canEdit || props.saving}
                      value={props.profile.name}
                      onInput={(event) =>
                        props.onName(event.currentTarget.value)
                      }
                    />
                  </Field>
                }
                introduction={
                  <Field label="Introduction" labelClass="sr-only" class="mt-4">
                    <TextArea
                      ref={(element) => {
                        let previousWidth = 0;
                        // Kobalte handles value changes; reflow when width changes too.
                        createResizeObserver(element, ({ width }) => {
                          if (
                            !element.isConnected ||
                            width <= 0 ||
                            width === previousWidth
                          )
                            return;
                          previousWidth = width;
                          element.style.height = 'auto';
                          element.style.height = `${element.scrollHeight}px`;
                        });
                      }}
                      autoResize
                      rows={1}
                      class="min-h-[1lh] overflow-hidden border-0 bg-transparent p-0 text-sm leading-relaxed text-ink-muted ring-1 ring-edge-frame"
                      placeholder="Add an introduction for your guests"
                      disabled={!props.canEdit || props.saving}
                      value={props.profile.description}
                      onInput={(event) =>
                        props.onDescription(event.currentTarget.value)
                      }
                    />
                  </Field>
                }
              />
            </Show>
          </PublicBookingLayout>
        </div>
      </section>
    </form>
  );
}
