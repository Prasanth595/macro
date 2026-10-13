import { Button } from '@ui';
import { createSignal, createUniqueId, type JSX, Show } from 'solid-js';
import { BookingFieldInfo } from './booking-field-info';

/** Disclosure state never changes the draft or remounts its controls. */
export function BookingEditorSection(props: {
  label: string;
  description?: string;
  summary: JSX.Element;
  disabled: boolean;
  invalid?: boolean;
  children: JSX.Element;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const contentId = createUniqueId();
  const isExpanded = () => expanded() || !!props.invalid;
  return (
    <section class="min-w-0 border-b border-edge-frame py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div class="flex items-start justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex items-center gap-1">
            <span class="text-sm font-normal text-ink-muted">
              {props.label}
            </span>
            <Show when={props.description}>
              {(description) => (
                <BookingFieldInfo
                  label={props.label}
                  description={description()}
                />
              )}
            </Show>
          </div>
          <Show when={!isExpanded()}>
            <div data-booking-summary class="text-xs text-ink-muted">
              {props.summary}
            </div>
          </Show>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          class="rounded-md px-2 text-xs text-ink-muted"
          disabled={props.disabled}
          aria-label={`${isExpanded() ? 'Done editing' : 'Edit'} ${props.label.toLowerCase()}`}
          aria-expanded={isExpanded()}
          aria-controls={contentId}
          onClick={() => setExpanded(!isExpanded())}
        >
          {isExpanded() ? 'Done' : 'Edit'}
        </Button>
      </div>
      <div
        id={contentId}
        hidden={!isExpanded()}
        class="pt-3"
        onFocusIn={() => {
          if (props.invalid) setExpanded(true);
        }}
      >
        {props.children}
      </div>
    </section>
  );
}
