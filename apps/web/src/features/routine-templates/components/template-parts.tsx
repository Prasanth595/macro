import { eventTriggerLabel } from '@app/features/routines/core/routine-triggers';
import { StaticMarkdown } from '@core/component/LexicalMarkdown/component/core/StaticMarkdown';
import { TemplateVariableChipView } from '@core/component/LexicalMarkdown/component/decorator/TemplateVariable';
import {
  type TemplateVariableChip,
  TemplateVariableContext,
} from '@core/component/LexicalMarkdown/context/TemplateVariableContext';
import ClockIcon from '@phosphor/clock.svg';
import LightningIcon from '@phosphor/lightning.svg';
import RobotIcon from '@phosphor/robot.svg';
import { For, Index, type JSX, Match, Show, Switch } from 'solid-js';
import {
  kindLabel,
  type TemplateTriggerLine,
  type TemplateVariable,
} from '../core/template';

/** How each variable reads where it is shown, by key. */
export type ChipFor = (key: string) => TemplateVariableChip | undefined;

export function Chip(props: { key: string; chipFor: ChipFor }) {
  return (
    <TemplateVariableChipView
      {...(props.chipFor(props.key) ?? { label: props.key, tone: 'variable' })}
    />
  );
}

function TriggerRow(props: { icon: JSX.Element; children: JSX.Element }) {
  return (
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-ink-muted" aria-hidden="true">
        {props.icon}
      </span>
      {props.children}
    </div>
  );
}

/** The agent and triggers of a template, with chips where variables are. */
export function TemplateTriggers(props: {
  agentKey: string;
  lines: TemplateTriggerLine[];
  chipFor: ChipFor;
}) {
  return (
    <div class="grid gap-2">
      <TriggerRow icon={<RobotIcon class="size-4" />}>
        Runs on <Chip key={props.agentKey} chipFor={props.chipFor} />
      </TriggerRow>
      <For each={props.lines}>
        {(line) => (
          <Switch>
            <Match when={line.kind === 'schedule' && line}>
              {(line) => (
                <TriggerRow icon={<ClockIcon class="size-4" />}>
                  <Chip key={line().key} chipFor={props.chipFor} />
                </TriggerRow>
              )}
            </Match>
            <Match when={line.kind === 'events' && line}>
              {(line) => (
                <TriggerRow icon={<LightningIcon class="size-4" />}>
                  <span>
                    {eventTriggerLabel({
                      id: '',
                      kind: 'event',
                      events: line().events,
                    })}
                  </span>
                  <Show when={line().keys.length}>
                    <span>in</span>
                    <Index each={line().keys}>
                      {(key) => <Chip key={key()} chipFor={props.chipFor} />}
                    </Index>
                  </Show>
                  <Show when={line().condition}>
                    {(condition) => (
                      <span class="text-ink-muted">if {condition()}</span>
                    )}
                  </Show>
                </TriggerRow>
              )}
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}

/** Template instructions, each variable slot shown by `chipFor`. */
export function TemplateInstructions(props: {
  instructions: string;
  chipFor: ChipFor;
}) {
  return (
    <TemplateVariableContext.Provider value={(key) => props.chipFor(key)}>
      <div class="text-sm leading-7 text-ink">
        <StaticMarkdown markdown={props.instructions} />
      </div>
    </TemplateVariableContext.Provider>
  );
}

export function KindPill(props: { kind: TemplateVariable['kind'] }) {
  return (
    <span class="rounded-full border border-edge-muted px-1.5 text-xxs font-medium text-ink-muted">
      {kindLabel(props.kind)}
    </span>
  );
}

/** The template's variables, for someone deciding whether to activate it. */
export function TemplateVariableList(props: {
  variables: TemplateVariable[];
  chipFor: ChipFor;
}) {
  return (
    <ul class="grid gap-2" aria-label="Variables">
      <For each={props.variables}>
        {(variable) => (
          <li class="grid gap-1 rounded-lg border border-edge-muted bg-panel px-3 py-2.5">
            <span class="flex flex-wrap items-center gap-1.5 text-sm font-medium">
              {variable.label}
              <KindPill kind={variable.kind} />
              <Show when={variable.fixed}>
                <span class="text-xs text-ink-muted">Same for everyone:</span>
                <Chip key={variable.key} chipFor={props.chipFor} />
              </Show>
            </span>
            <Show when={variable.description}>
              <span class="text-xs leading-snug text-ink-muted">
                {variable.description}
              </span>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

/** The violet "Template" label that marks template surfaces. */
export function TemplateLabel(props: { children?: JSX.Element }) {
  return (
    <span class="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xxs font-semibold tracking-wide text-accent">
      {props.children ?? 'Template'}
    </span>
  );
}
