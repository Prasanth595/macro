import { createSignal, Show } from 'solid-js';
import { ComposeFieldRow } from './compose-field-row';

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export function ComposeSubjectField(props: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  error?: string;
  inputRef?: (el: HTMLElement) => void;
}) {
  // On mobile the subject wraps and grows while edited, and folds to a single
  // truncated line on blur so the body starts near the top.
  const [editing, setEditing] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;

  const showSummary = () =>
    props.compact && !editing() && props.value.length > 0;

  const blurOnEscape = (
    e: KeyboardEvent & { currentTarget: HTMLInputElement }
  ) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.currentTarget.blur();
  };

  return (
    <ComposeFieldRow
      label={props.compact ? 'Subject:' : 'Subject'}
      compact={props.compact}
    >
      <div class="flex-1 min-w-0">
        <Show
          when={props.compact}
          fallback={
            <input
              ref={props.inputRef}
              type="text"
              aria-label="Subject"
              value={props.value}
              placeholder="Subject"
              class="w-full resize-none bg-transparent text-base text-ink placeholder:text-ink-placeholder outline-none"
              onInput={(e) => props.onChange(e.currentTarget.value)}
              onKeyDown={blurOnEscape}
              disabled={props.disabled}
            />
          }
        >
          <Show
            when={!showSummary()}
            fallback={
              <button
                type="button"
                class="ph-no-capture w-full min-h-7 flex items-center text-base text-ink text-left"
                onClick={() => {
                  setEditing(true);
                  requestAnimationFrame(() => textareaRef?.focus());
                }}
              >
                <span class="truncate">{props.value}</span>
              </button>
            }
          >
            <textarea
              ref={(el) => {
                textareaRef = el;
                props.inputRef?.(el);
                requestAnimationFrame(() => autosize(el));
              }}
              rows="1"
              aria-label="Subject"
              value={props.value}
              class="w-full resize-none overflow-hidden text-base p-1"
              onInput={(e) => {
                props.onChange(e.currentTarget.value.replace(/\n/g, ' '));
                autosize(e.currentTarget);
              }}
              onFocus={() => setEditing(true)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.currentTarget.blur();
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              disabled={props.disabled}
            />
          </Show>
        </Show>
      </div>
      <Show when={props.error}>
        {(err) => <div class="text-failure-ink text-sm mt-1">{err()}</div>}
      </Show>
    </ComposeFieldRow>
  );
}
