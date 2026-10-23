import CheckIcon from '@phosphor/check-circle.svg';
import { Button } from '@ui';
import { For, Show } from 'solid-js';
import {
  type RoutineTemplate,
  type TemplateValue,
  triggerLineText,
} from '../core/template';
import { TemplateLabel } from './template-parts';

/** A routine template posted in a channel. */
export function TemplateCard(props: {
  template: RoutineTemplate;
  ownerName: string;
  label(value: TemplateValue): string;
  onView(): void;
  onActivate(): void;
  onOpenRoutine(id: string): void;
}) {
  const label = (key: string) => {
    const variable = props.template.variables.find((v) => v.key === key);
    if (!variable) return key;
    return variable.fixed ? props.label(variable.fixed) : `{${variable.label}}`;
  };
  const yours = () => props.template.yourActivations;
  return (
    <div class="w-full max-w-120 overflow-hidden rounded-xl border border-accent/40 bg-panel text-ink">
      <div class="grid gap-2.5 px-3.5 py-3">
        <div class="flex items-center gap-2">
          <TemplateLabel>Routine template</TemplateLabel>
          <span class="text-xs text-ink-muted">by {props.ownerName}</span>
        </div>
        <div>
          <div class="text-[15px] font-semibold">{props.template.name}</div>
          <Show when={props.template.description}>
            <p class="mt-0.5 text-sm leading-snug text-ink-muted">
              {props.template.description}
            </p>
          </Show>
        </div>
        <ul class="grid gap-1.5 text-sm text-ink-muted">
          <For each={props.template.triggers}>
            {(line) => <li>{triggerLineText(line, label)}</li>}
          </For>
        </ul>
      </div>
      <div class="flex flex-wrap items-center gap-2 border-t border-edge-muted px-3.5 py-2.5">
        <span class="min-w-40 flex-1 text-xs text-ink-muted">
          <Show
            when={yours().length}
            fallback={
              props.template.activationCount
                ? `Active for ${props.template.activationCount}`
                : ''
            }
          >
            <span class="inline-flex items-center gap-1.5 text-success">
              <CheckIcon class="size-4" aria-hidden="true" />
              Active for you
            </span>
          </Show>
        </span>
        <Show
          when={yours().length}
          fallback={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => props.onView()}
              >
                View template
              </Button>
              <Button
                variant="strong"
                size="sm"
                onClick={() => props.onActivate()}
              >
                Activate for me
              </Button>
            </>
          }
        >
          <Button variant="outline" size="sm" onClick={() => props.onView()}>
            View template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onOpenRoutine(yours()[0])}
          >
            Open
          </Button>
        </Show>
      </div>
    </div>
  );
}
