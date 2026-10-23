import { RoutineScheduleSettings } from '@app/features/routines/components/routine-schedule-settings';
import {
  newScheduleTrigger,
  type ScheduleTriggerDraft,
} from '@app/features/routines/core/routine-triggers';
import {
  parseRoutineTriggers,
  serializeTrigger,
} from '@app/features/routines/queries/routine-trigger-mapping';
import { RoutineExecutionPicker } from '@app/features/routines/routine-execution-picker';
import { useHasPaidAccess } from '@core/auth/license';
import { defaultModelForPlan } from '@core/component/AI/constant';
import { useQuickAccessEntities } from '@property/editors/selectors/entityUtils';
import { PropertyEntitySelector } from '@property/editors/selectors/PropertyEntitySelector';
import type { EntityType } from '@service-properties/generated/schemas/entityType';
import { Button, Input } from '@ui';
import { createSignal, Match, Suspense, Switch } from 'solid-js';
import { match } from 'ts-pattern';
import type { TemplateVariableKind } from './core/template';
import type { ValuePickerProps } from './views/activate-template-dialog';

function selectorType(kind: TemplateVariableKind): EntityType | undefined {
  return match(kind)
    .with('user', () => 'USER' as const)
    .with('channel', () => 'CHANNEL' as const)
    .with('document', () => 'DOCUMENT' as const)
    .with('email_thread', () => 'THREAD' as const)
    .with('call', () => 'CALL_RECORD' as const)
    .with('agent', 'schedule', 'text', () => undefined)
    .exhaustive();
}

function schedule(cron: string, timezone: string): ScheduleTriggerDraft {
  const [draft] =
    parseRoutineTriggers({ type: 'cron', schedule: cron, timezone }) ?? [];
  return draft?.kind === 'schedule' ? draft : newScheduleTrigger('week');
}

/** The editor a routine uses for each kind of value. */
export function TemplateValuePicker(props: ValuePickerProps) {
  const hasPaidAccess = useHasPaidAccess();
  return (
    <Switch fallback={<EntityPicker {...props} />}>
      <Match when={props.variable.kind === 'agent'}>
        <RoutineExecutionPicker
          target={
            props.value?.kind === 'agent'
              ? props.value.target
              : { kind: 'model', model: defaultModelForPlan(hasPaidAccess()) }
          }
          onChange={(target) => props.onPick({ kind: 'agent', target })}
        />
      </Match>
      <Match when={props.variable.kind === 'schedule'}>
        <SchedulePicker {...props} />
      </Match>
      <Match when={props.variable.kind === 'text'}>
        <TextPicker {...props} />
      </Match>
    </Switch>
  );
}

function SchedulePicker(props: ValuePickerProps) {
  const [draft, setDraft] = createSignal(
    props.value?.kind === 'schedule'
      ? schedule(props.value.cron, props.value.timezone)
      : newScheduleTrigger('week')
  );
  const [error, setError] = createSignal<string>();
  const apply = () => {
    try {
      const trigger = serializeTrigger(draft());
      if (trigger.type === 'cron')
        props.onPick({
          kind: 'schedule',
          cron: trigger.schedule,
          timezone: trigger.timezone,
        });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Choose a schedule.');
    }
  };
  return (
    <div class="grid gap-2">
      <RoutineScheduleSettings
        trigger={draft()}
        onChange={(patch) => setDraft({ ...draft(), ...patch })}
      />
      <span class="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={apply}>
          Use this schedule
        </Button>
        <span role="alert" class="text-xs text-failure">
          {error()}
        </span>
      </span>
    </div>
  );
}

function TextPicker(props: ValuePickerProps) {
  const [text, setText] = createSignal(
    props.value?.kind === 'text' ? props.value.text : ''
  );
  const valid = () =>
    text().trim().length > 0 && !/[<>]/.test(text()) && text().length <= 500;
  return (
    <form
      class="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid()) props.onPick({ kind: 'text', text: text().trim() });
      }}
    >
      <Input
        aria-label={props.variable.label}
        class="flex-1"
        value={text()}
        maxLength={500}
        onInput={(event) => setText(event.currentTarget.value)}
      />
      <Button size="sm" variant="outline" type="submit" disabled={!valid()}>
        Use
      </Button>
    </form>
  );
}

function EntityPicker(props: ValuePickerProps) {
  const type = () => selectorType(props.variable.kind);
  const entities = useQuickAccessEntities(type);
  const selected = () =>
    new Set(
      props.value?.kind === 'entity'
        ? [props.value.id]
        : props.value?.kind === 'user'
          ? [props.value.userId]
          : []
    );
  return (
    <Suspense fallback={<p class="p-3 text-sm text-ink-muted">Loading…</p>}>
      <PropertyEntitySelector
        config={{
          isMultiSelect: false,
          placeholder: `Search for a ${props.variable.label.toLowerCase()}…`,
          specificEntityType: type(),
        }}
        selectedOptions={selected}
        setSelectedOptions={(ids) => {
          const [id] = [...ids];
          if (!id) return;
          if (props.variable.kind === 'user') {
            props.onPick({ kind: 'user', userId: id });
            return;
          }
          const name =
            entities.items().find((item) => item.id === id)?.data.name ?? '';
          props.onPick({ kind: 'entity', id, name });
        }}
      />
    </Suspense>
  );
}
