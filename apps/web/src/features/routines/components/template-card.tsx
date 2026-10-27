import ClockCounterIcon from '@icon/system/regular/clock-counter-clockwise.svg';
import LightningIcon from '@icon/system/regular/lightning.svg';
import { Badge, Button } from '@ui';
import { For, Show } from 'solid-js';

/** A shared routine template as a card under the message that links it. */
export function TemplateCard(props: {
  name: string;
  description: string;
  authorName: string;
  triggers: readonly string[];
  activeCount: number;
  /** False for the author, whose own routine this is. */
  canActivate: boolean;
  onView(): void;
  onActivate(): void;
}) {
  return (
    <article
      aria-label={`Routine template: ${props.name}`}
      class="mt-2 max-w-xl overflow-hidden rounded-xl border border-edge-muted"
    >
      <div class="flex flex-col gap-2 p-4">
        <div class="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Badge variant="outline" size="xs">
            <ClockCounterIcon />
            Routine template
          </Badge>
          by {props.authorName}
        </div>
        <h3 class="font-semibold">{props.name}</h3>
        <Show when={props.description}>
          <p class="text-sm text-ink-muted">{props.description}</p>
        </Show>
        <For each={props.triggers}>
          {(trigger) => (
            <div class="flex items-center gap-2 text-sm">
              <LightningIcon class="size-4 shrink-0 text-ink-muted" />
              {trigger}
            </div>
          )}
        </For>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-edge-muted px-4 py-3">
        <span class="text-sm text-ink-muted">
          {props.activeCount === 1
            ? 'Active for 1 person'
            : `Active for ${props.activeCount} people`}
        </span>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => props.onView()}>
            View template
          </Button>
          <Show when={props.canActivate}>
            <Button variant="cta" size="sm" onClick={() => props.onActivate()}>
              Activate for me
            </Button>
          </Show>
        </div>
      </div>
    </article>
  );
}
