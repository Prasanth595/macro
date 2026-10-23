import type { RoutineTarget } from '@app/features/routines/core/routine-target';
import {
  eventTriggerLabel,
  newScheduleTrigger,
  type RoutineEventName,
} from '@app/features/routines/core/routine-triggers';
import { scheduleTriggerLabel } from '@app/features/routines/core/schedule-language';
import { match } from 'ts-pattern';

/** What a variable stands for, and so which picker fills it. */
export type TemplateVariableKind =
  | 'agent'
  | 'schedule'
  | 'text'
  | 'user'
  | 'channel'
  | 'document'
  | 'email_thread'
  | 'call';

/** A value for one variable, fixed by the creator or chosen at activation. */
export type TemplateValue =
  | { kind: 'agent'; target: RoutineTarget }
  | { kind: 'schedule'; cron: string; timezone: string }
  | { kind: 'text'; text: string }
  | { kind: 'user'; userId: string }
  | { kind: 'entity'; id: string; name: string };

export type TemplateVariable = {
  key: string;
  label: string;
  description: string;
  kind: TemplateVariableKind;
  /** The creator's value for everyone; absent when each person fills it. */
  fixed?: TemplateValue;
};

/** One trigger of a template, with variables where values would be. */
export type TemplateTriggerLine =
  | { kind: 'schedule'; key: string }
  | {
      kind: 'events';
      events: RoutineEventName[];
      keys: string[];
      condition?: string;
    };

export type RoutineTemplate = {
  id: string;
  ownerId: string;
  sourceActionId?: string;
  name: string;
  description: string;
  /** Markdown with `<m-template-variable>` slots. */
  instructions: string;
  triggers: TemplateTriggerLine[];
  variables: TemplateVariable[];
  /** Routines the viewer activated from this template. */
  yourActivations: string[];
  activationCount: number;
};

/** Variable values keyed by variable key. */
export type Bindings = Record<string, TemplateValue>;

export function kindLabel(kind: TemplateVariableKind): string {
  return match(kind)
    .with('agent', () => 'Agent')
    .with('schedule', () => 'Schedule')
    .with('text', () => 'Text')
    .with('user', () => 'Person')
    .with('channel', () => 'Channel')
    .with('document', () => 'Document')
    .with('email_thread', () => 'Email thread')
    .with('call', () => 'Call')
    .exhaustive();
}

/** A cron schedule in words, falling back to the expression itself. */
export function scheduleLabel(cron: string, timezone: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 6) return cron;
  const [, minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const time =
    /^\d+$/.test(minute) && /^\d+$/.test(hour)
      ? ` at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
      : '';
  const days = dayOfWeek.split(',');
  const frequency = match({ hour, dayOfMonth, dayOfWeek })
    .with({ hour: '*' }, () => 'hour' as const)
    .with({ dayOfMonth: '*', dayOfWeek: '*' }, () => 'day' as const)
    .with({ dayOfMonth: '*' }, () =>
      days.every((day) => /^\d$/.test(day)) ? ('week' as const) : undefined
    )
    .with({ dayOfWeek: '*' }, () => 'month' as const)
    .otherwise(() => undefined);
  if (!frequency) return `${cron} (${timezone})`;
  const label = scheduleTriggerLabel({
    ...newScheduleTrigger(frequency),
    daysOfWeek: frequency === 'week' ? days : [],
    dayOfMonth,
  });
  return `${label}${frequency === 'hour' ? '' : time} (${timezone})`;
}

/** A value as a short label for chips and rows. */
export function valueLabel(
  value: TemplateValue,
  agentName: (target: RoutineTarget) => string
): string {
  return match(value)
    .with({ kind: 'agent' }, (value) => agentName(value.target))
    .with({ kind: 'schedule' }, (value) =>
      scheduleLabel(value.cron, value.timezone)
    )
    .with({ kind: 'text' }, (value) => value.text)
    .with({ kind: 'user' }, (value) => value.userId.replace(/^macro\|/, ''))
    .with({ kind: 'entity' }, (value) => value.name || 'Untitled')
    .exhaustive();
}

/** Whether a value has the shape a variable of `kind` needs. */
export function valueFits(
  kind: TemplateVariableKind,
  value: TemplateValue
): boolean {
  return match(kind)
    .with('agent', () => value.kind === 'agent')
    .with('schedule', () => value.kind === 'schedule')
    .with('text', () => value.kind === 'text')
    .with('user', () => value.kind === 'user')
    .with(
      'channel',
      'document',
      'email_thread',
      'call',
      () => value.kind === 'entity'
    )
    .exhaustive();
}

/**
 * The value each variable would take: the viewer's choice, else the fixed
 * value. Keys with neither are missing.
 */
export function resolveBindings(
  variables: TemplateVariable[],
  chosen: Bindings
): { bindings: Bindings; missing: string[] } {
  const bindings: Bindings = {};
  const missing: string[] = [];
  for (const variable of variables) {
    const value = chosen[variable.key] ?? variable.fixed;
    if (value && valueFits(variable.kind, value))
      bindings[variable.key] = value;
    else missing.push(variable.key);
  }
  return { bindings, missing };
}

/** A trigger line in words, with `{label}` where a variable is. */
export function triggerLineText(
  line: TemplateTriggerLine,
  label: (key: string) => string
): string {
  return match(line)
    .with({ kind: 'schedule' }, (line) => label(line.key))
    .with({ kind: 'events' }, (line) => {
      const events = eventTriggerLabel({
        id: '',
        kind: 'event',
        events: line.events,
      });
      const where = line.keys.length
        ? ` in ${line.keys.map(label).join(', ')}`
        : '';
      const condition = line.condition ? `, if ${line.condition}` : '';
      return `When: ${events}${where}${condition}`;
    })
    .exhaustive();
}

/** Where a routine came from, for the routine's owner. */
export type Provenance = {
  templateId: string;
  /** Absent when the template is gone or no longer shared with the owner. */
  template?: { name: string; ownerId: string };
  variables: TemplateVariable[];
  bindings: Bindings;
  /** The routine still reads as the template rendered it. */
  rebindable: boolean;
};

/** A routine's proposed template, with the creator's own values. */
export type ShareDraft = {
  template: RoutineTemplate;
  creatorValues: Bindings;
  existingTemplateId?: string;
};

/** The parts of a draft the creator edits before sharing. */
export type ShareEdits = {
  name: string;
  description: string;
  variables: TemplateVariable[];
};

/** One variable after an AI fill: its value if found, why, or why not. */
export type FilledRow = {
  key: string;
  value?: TemplateValue;
  reason?: string;
  check?: boolean;
  problem?: string;
};

export type FillResult = { rows: FilledRow[]; name?: string };
