import { Button } from '@ui';
import { For, Show } from 'solid-js';
import {
  Chip,
  type ChipFor,
  TemplateLabel,
} from '../components/template-parts';
import type { Provenance, TemplateValue } from '../core/template';

export type TemplateProvenanceProps = {
  provenance: Provenance;
  ownerName: string;
  label(value: TemplateValue): string;
  onView(): void;
  onChange(): void;
  onFillAgain(): void;
};

/**
 * "From <creator>'s template" and, while the routine still reads as the
 * template rendered it, the values it was activated with.
 */
export function TemplateProvenanceView(props: TemplateProvenanceProps) {
  const chipFor: ChipFor = (key) => {
    const value = props.provenance.bindings[key];
    return value ? { label: props.label(value), tone: 'filled' } : undefined;
  };
  return (
    <div class="grid gap-3">
      <div class="flex min-h-16 items-center gap-3 rounded-xl border border-dashed border-accent/60 bg-accent/8 px-3.5 py-3">
        <span class="flex flex-1 flex-col gap-0.5 leading-snug">
          <span class="flex items-center gap-2 text-[15px] font-semibold">
            <Show when={props.provenance.template} fallback="From a template">
              From {props.ownerName}'s template
            </Show>
            <TemplateLabel />
          </span>
          <span class="text-sm text-ink-muted">
            {props.provenance.template?.name ??
              'The template was deleted or is no longer shared with you.'}
          </span>
        </span>
        <Show when={props.provenance.template}>
          <Button variant="outline" size="sm" onClick={() => props.onView()}>
            View
          </Button>
        </Show>
      </div>
      <Show when={props.provenance.rebindable}>
        <section
          aria-label="Your variables"
          class="rounded-xl border border-edge-muted px-4 pt-2.5 pb-1.5"
        >
          <div class="flex items-baseline justify-between pb-1.5">
            <h3 class="text-xs font-medium text-ink-muted">Your variables</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onFillAgain()}
            >
              Fill in again with AI
            </Button>
          </div>
          <ul>
            <For each={props.provenance.variables}>
              {(variable) => (
                <li class="grid grid-cols-[130px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-edge-muted py-2 text-sm">
                  <span class="text-ink-muted">{variable.label}</span>
                  <span class="min-w-0">
                    <Chip key={variable.key} chipFor={chipFor} />
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Change ${variable.label}`}
                    onClick={() => props.onChange()}
                  >
                    Change
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  );
}
