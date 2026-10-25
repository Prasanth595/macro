import { Button } from '@ui';
import { For, Show } from 'solid-js';

export type TaskSavedViewErrorDetails = {
  filters: { label: string; values: string[]; issues: string[] }[];
  issues: string[];
  source: string;
  recoverable: boolean;
};

export function TaskSavedViewError(props: {
  message: string;
  details?: TaskSavedViewErrorDetails;
  onKeep: () => void;
  onRecreate: () => void;
}) {
  return (
    <div class="h-full overflow-auto p-6 text-sm touch:pb-[max(1.5rem,var(--mobile-content-inset-bottom,0px))]">
      <div class="mx-auto flex w-full max-w-xl flex-col gap-4">
        <p role="alert" class="font-medium">
          {props.message}
        </p>
        <Show when={props.details}>
          {(details) => (
            <>
              <p class="text-ink-muted">
                The original saved view is unchanged. Recreate a separate view
                to review the usable filters before saving.
              </p>
              <For each={details().issues}>
                {(issue) => <p class="text-failure-ink">{issue}</p>}
              </For>
              <h2 class="font-medium">Stored filters</h2>
              <dl class="flex flex-col gap-3">
                <For each={details().filters}>
                  {(filter) => (
                    <div class="rounded-lg border border-edge-muted p-3">
                      <dt class="font-medium">{filter.label}</dt>
                      <dd class="mt-1 whitespace-pre-wrap break-words text-ink-muted">
                        {filter.values.join(', ') || 'No restriction'}
                      </dd>
                      <For each={filter.issues}>
                        {(issue) => (
                          <dd class="mt-1 text-failure-ink">{issue}</dd>
                        )}
                      </For>
                    </div>
                  )}
                </For>
              </dl>
              <p class="text-ink-muted">
                {details().recoverable
                  ? 'Invalid entries and unsupported fields are omitted only from the new draft. Review its filters before saving.'
                  : 'This format cannot be safely recovered. The new draft will use default task filters.'}
              </p>
              <details>
                <summary class="text-ink-muted">Stored definition</summary>
                <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {details().source}
                </pre>
              </details>
            </>
          )}
        </Show>
        <div class="flex flex-wrap gap-2">
          <Button onClick={props.onKeep}>
            {props.details ? 'Keep saved view' : 'Return to Tasks'}
          </Button>
          <Show when={props.details}>
            <Button onClick={props.onRecreate}>Recreate view</Button>
          </Show>
        </div>
      </div>
    </div>
  );
}
