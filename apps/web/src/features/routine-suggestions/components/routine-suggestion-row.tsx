import ArrowRightIcon from '@phosphor/arrow-right.svg';
import CaretDownIcon from '@phosphor/caret-down.svg';
import CheckIcon from '@phosphor/check.svg';
import LightningIcon from '@phosphor/lightning.svg';
import SlidersIcon from '@phosphor/sliders-horizontal.svg';
import { Button, cn, TextField, ToggleSwitch } from '@ui';
import { CollapseTransition } from '@ui/components/CollapseTransition';
import { createUniqueId, Match, Show, Switch } from 'solid-js';
import type {
  RoutineSuggestion,
  SuggestionEdits,
  SuggestionStatus,
} from '../core/suggestions';
import { SuggestionIcon } from './suggestion-icon';

/**
 * One suggested routine: collapsed it reads as a title, a summary, and when
 * it runs, with one-click Enable; expanded it lets the user edit the name,
 * instructions, and notifications first, or open the full routine editor.
 */
export function RoutineSuggestionRow(props: {
  suggestion: RoutineSuggestion;
  edits: SuggestionEdits;
  status: SuggestionStatus;
  expanded: boolean;
  /** Shown on pages that mix surfaces, such as Routines. */
  surfaceLabel?: string;
  onExpandedChange(expanded: boolean): void;
  onEdit(edits: SuggestionEdits): void;
  onEnable(): void;
  onCustomize(): void;
  onOpenRoutine(routineId: string): void;
}) {
  const detailsId = createUniqueId();
  const busy = () => props.status.kind === 'enabling';
  const enabled = () =>
    props.status.kind === 'enabled' ? props.status : undefined;
  const edit = (patch: Partial<SuggestionEdits>) =>
    props.onEdit({ ...props.edits, ...patch });
  return (
    <li
      class={cn(
        'list-none rounded-xl border transition-colors',
        props.expanded
          ? 'border-edge-muted bg-control'
          : 'border-transparent not-touch:hover:bg-hover',
        enabled() && 'border-success/30 bg-success-bg/40'
      )}
    >
      <div class="flex min-w-0 items-start gap-3 p-3">
        <SuggestionIcon name={props.suggestion.icon} class="mt-0.5" />
        <button
          type="button"
          class="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:outline-2 focus-visible:outline-accent"
          aria-expanded={props.expanded}
          aria-controls={detailsId}
          onClick={() => props.onExpandedChange(!props.expanded)}
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate text-sm font-medium text-ink">
              {props.edits.title || props.suggestion.title}
            </span>
            <Show when={props.surfaceLabel}>
              {(label) => (
                <span class="shrink-0 rounded-full bg-violet-bg px-1.5 text-[10px] leading-4 font-medium text-violet-ink">
                  {label()}
                </span>
              )}
            </Show>
            <CaretDownIcon
              aria-hidden="true"
              class={cn(
                'size-3 shrink-0 text-ink-extra-muted transition-transform',
                props.expanded && 'rotate-180'
              )}
            />
          </span>
          <span class="mt-0.5 block text-xs leading-5 text-ink-muted">
            {props.suggestion.summary}
          </span>
          <span class="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-ink-extra-muted">
            <span class="flex items-center gap-1 text-violet-ink">
              <LightningIcon class="size-3" aria-hidden="true" />
              {props.suggestion.when}
            </span>
            <Show when={props.suggestion.reason}>
              <span class="min-w-0 truncate">{props.suggestion.reason}</span>
            </Show>
          </span>
        </button>
        <div class="shrink-0">
          <Switch
            fallback={
              <Button
                variant="cta"
                size="sm"
                disabled={busy()}
                aria-label={`Enable ${props.edits.title || props.suggestion.title}`}
                onClick={() => props.onEnable()}
              >
                {busy() ? 'Enabling…' : 'Enable'}
              </Button>
            }
          >
            <Match when={enabled()}>
              {(state) => (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => props.onOpenRoutine(state().routineId)}
                >
                  <CheckIcon aria-hidden="true" />
                  Enabled
                </Button>
              )}
            </Match>
          </Switch>
        </div>
      </div>
      <Show when={props.status.kind === 'failed' && props.status}>
        {(failed) => (
          <p role="alert" class="px-3 pb-3 pl-14 text-xs text-failure">
            {failed().message}
          </p>
        )}
      </Show>
      <CollapseTransition open={props.expanded}>
        <div id={detailsId} class="flex flex-col gap-3 px-3 pb-3 pl-14">
          <TextField
            value={props.edits.title}
            onChange={(title) => edit({ title })}
            disabled={busy() || Boolean(enabled())}
          >
            <TextField.Label class="text-xs font-medium text-ink-muted">
              Name
            </TextField.Label>
            <TextField.Input size="sm" />
          </TextField>
          <TextField
            value={props.edits.instructions}
            onChange={(instructions) => edit({ instructions })}
            disabled={busy() || Boolean(enabled())}
          >
            <TextField.Label class="text-xs font-medium text-ink-muted">
              Instructions
            </TextField.Label>
            <TextField.TextArea autoResize />
          </TextField>
          <div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <ToggleSwitch
              size="sm"
              label="Show each run in Home"
              labelClass="text-xs text-ink-muted"
              checked={props.edits.notify}
              disabled={busy() || Boolean(enabled())}
              onChange={(notify) => edit({ notify })}
            />
            <Show
              when={!enabled()}
              fallback={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const state = enabled();
                    if (state) props.onOpenRoutine(state.routineId);
                  }}
                >
                  Open routine
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              }
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={busy()}
                onClick={() => props.onCustomize()}
              >
                <SlidersIcon aria-hidden="true" />
                More options
              </Button>
            </Show>
          </div>
        </div>
      </CollapseTransition>
    </li>
  );
}
