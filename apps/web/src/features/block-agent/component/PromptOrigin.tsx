import { formatDate } from '@core/util/date';
import { Show } from 'solid-js';
import type { PromptOrigin as Origin } from '../state/prompt-origin';

/**
 * A quiet line under a prompt saying what started it: `via @mention in #eng ·
 * 2:02 PM`. Clicking it goes to that place.
 */
export function PromptOrigin(props: { origin: Origin; onOpen?: () => void }) {
  const label = () =>
    [props.origin.lead, props.origin.place, props.origin.tail]
      .filter(Boolean)
      .join(' ');
  const text = () => (
    <>
      {props.origin.lead}
      <Show when={props.origin.place}>
        {(place) => (
          <>
            {' '}
            <span class="text-ink-muted">{place()}</span>
          </>
        )}
      </Show>
      <Show when={props.origin.tail}>{(tail) => <> {tail()}</>}</Show>
    </>
  );

  return (
    <div
      class="mr-2 flex max-w-[85%] min-w-0 items-center gap-1.5 text-xs text-ink-extra-muted"
      data-testid="prompt-origin"
    >
      <Show
        when={props.onOpen}
        fallback={
          <span class="min-w-0 truncate px-1" title={label()}>
            {text()}
          </span>
        }
      >
        {(open) => (
          <button
            type="button"
            title={label()}
            onClick={() => open()()}
            class="min-w-0 truncate rounded px-1 text-left underline decoration-dotted underline-offset-2 not-touch:hover:bg-hover not-touch:hover:text-ink"
          >
            {text()}
          </button>
        )}
      </Show>
      <Show when={props.origin.at}>
        {(at) => (
          <>
            <span class="shrink-0" aria-hidden="true">
              ·
            </span>
            <span class="shrink-0">{formatDate(at(), { showTime: true })}</span>
          </>
        )}
      </Show>
    </div>
  );
}
