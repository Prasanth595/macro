import { createUniqueId, Show } from 'solid-js';

export function FieldInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  list?: string;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
  prominent?: boolean;
}) {
  const hintId = createUniqueId();
  return (
    <label class="flex min-w-0 flex-col gap-1.5 text-xs text-ink-muted">
      <span class="font-medium" classList={{ 'sr-only': props.prominent }}>
        {props.label}
      </span>
      {props.multiline ? (
        <textarea
          aria-label={props.label}
          aria-describedby={props.hint ? hintId : undefined}
          class="min-h-24 w-full resize-y rounded-lg border border-transparent bg-hover/40 px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition-colors focus:border-edge focus:bg-panel"
          value={props.value}
          disabled={props.disabled}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      ) : (
        <input
          aria-label={props.label}
          aria-describedby={props.hint ? hintId : undefined}
          class="h-10 min-w-0 w-full rounded-lg border border-transparent bg-hover/40 px-3 text-sm text-ink outline-none transition-colors focus:border-edge focus:bg-panel"
          classList={{
            'bg-transparent! px-0! text-xl! font-medium': props.prominent,
          }}
          type={props.type ?? 'text'}
          list={props.list}
          value={props.value}
          disabled={props.disabled}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      )}
      <Show when={props.hint}>
        <span
          id={hintId}
          class="rounded-md bg-accent/8 px-2.5 py-2 text-xs leading-relaxed text-ink"
        >
          {props.hint}
        </span>
      </Show>
    </label>
  );
}
