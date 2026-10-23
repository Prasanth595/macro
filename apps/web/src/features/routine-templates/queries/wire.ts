import type { RoutineTarget } from '@app/features/routines/core/routine-target';
import type {
  BoundValue,
  RoutineProvenance,
  TaskTarget,
  TemplateDraft,
  TemplateEventFilter,
  TemplateTrigger,
  TemplateView,
  VariableKind,
  TemplateVariable as WireVariable,
} from '@service-scheduled-action/generated/schemas';
import { match } from 'ts-pattern';
import type {
  Bindings,
  Provenance,
  RoutineTemplate,
  ShareEdits,
  TemplateTriggerLine,
  TemplateValue,
  TemplateVariable,
  TemplateVariableKind,
} from '../core/template';

export function targetFromWire(target: TaskTarget): RoutineTarget {
  return target.kind === 'model'
    ? { kind: 'model', model: target.model }
    : {
        kind: 'agent',
        agentId: target.bot_id,
        ...(target.model ? { modelOverride: target.model } : {}),
      };
}

function targetToWire(target: RoutineTarget): TaskTarget {
  return target.kind === 'model'
    ? { kind: 'model', model: target.model }
    : {
        kind: 'agent',
        bot_id: target.agentId,
        ...(target.modelOverride ? { model: target.modelOverride } : {}),
      };
}

export function valueFromWire(value: BoundValue): TemplateValue {
  return (
    match(value)
      .with({ type: 'agent' }, (value) => ({
        kind: 'agent' as const,
        target: targetFromWire(value.target),
      }))
      .with({ type: 'schedule' }, (value) => ({
        kind: 'schedule' as const,
        cron: value.cron,
        timezone: value.timezone,
      }))
      .with({ type: 'text' }, (value) => ({
        kind: 'text' as const,
        text: value.text,
      }))
      .with({ type: 'user' }, (value) => ({
        kind: 'user' as const,
        userId: value.user_id,
      }))
      .with({ type: 'entity' }, (value) => ({
        kind: 'entity' as const,
        id: value.id,
        name: value.name ?? '',
      }))
      // A value shape this build doesn't know; it fails validation later.
      .exhaustive(() => ({ kind: 'text' as const, text: '' }))
  );
}

export function valueToWire(value: TemplateValue): BoundValue {
  return match(value)
    .with({ kind: 'agent' }, (value) => ({
      type: 'agent' as const,
      target: targetToWire(value.target),
    }))
    .with({ kind: 'schedule' }, (value) => ({
      type: 'schedule' as const,
      cron: value.cron,
      timezone: value.timezone,
    }))
    .with({ kind: 'text' }, (value) => ({
      type: 'text' as const,
      text: value.text,
    }))
    .with({ kind: 'user' }, (value) => ({
      type: 'user' as const,
      user_id: value.userId,
    }))
    .with({ kind: 'entity' }, (value) => ({
      type: 'entity' as const,
      id: value.id,
      name: value.name,
    }))
    .exhaustive((unknown) => {
      throw new Error(`Unsupported template value: ${JSON.stringify(unknown)}`);
    });
}

export function bindingsFromWire(
  bindings: Record<string, BoundValue>
): Bindings {
  return Object.fromEntries(
    Object.entries(bindings).map(([key, value]) => [key, valueFromWire(value)])
  );
}

export function bindingsToWire(bindings: Bindings): Record<string, BoundValue> {
  return Object.fromEntries(
    Object.entries(bindings).map(([key, value]) => [key, valueToWire(value)])
  );
}

function kindFromWire(kind: VariableKind): TemplateVariableKind {
  return match(kind)
    .with({ type: 'event_entity' }, (kind) =>
      match(kind.entity_type)
        .with('email_thread', () => 'email_thread' as const)
        .with('call', () => 'call' as const)
        .with('channel', () => 'channel' as const)
        .with('document', () => 'document' as const)
        .exhaustive(() => 'text' as const)
    )
    .with({ type: 'agent' }, () => 'agent' as const)
    .with({ type: 'schedule' }, () => 'schedule' as const)
    .with({ type: 'text' }, () => 'text' as const)
    .with({ type: 'user' }, () => 'user' as const)
    .with({ type: 'channel' }, () => 'channel' as const)
    .with({ type: 'document' }, () => 'document' as const)
    .exhaustive(() => 'text' as const);
}

function variableFromWire(variable: WireVariable): TemplateVariable {
  return {
    key: variable.key,
    label: variable.label,
    description: variable.description,
    kind: kindFromWire(variable.kind),
    ...(variable.mode.type === 'fixed'
      ? { fixed: valueFromWire(variable.mode.value) }
      : {}),
  };
}

function filterLine(filter: TemplateEventFilter): TemplateTriggerLine {
  return {
    kind: 'events',
    events: filter.events,
    keys: filter.ids?.map((id) => id.$var) ?? [],
    ...(filter.condition ? { condition: filter.condition } : {}),
  };
}

function triggerLines(trigger: TemplateTrigger): TemplateTriggerLine[] {
  return match(trigger)
    .with({ type: 'cron' }, (trigger) => [
      { kind: 'schedule' as const, key: trigger.schedule.$var },
    ])
    .with({ type: 'events' }, (trigger) => trigger.filters.map(filterLine))
    .with({ type: 'multiple' }, (trigger) =>
      trigger.triggers.flatMap((entry) =>
        entry.type === 'cron'
          ? [{ kind: 'schedule' as const, key: entry.schedule.$var }]
          : entry.filters.map(filterLine)
      )
    )
    .exhaustive((): TemplateTriggerLine[] => []);
}

export function draftToModel(
  draft: TemplateDraft,
  identity: {
    id: string;
    owner: string;
    sourceActionId?: string | null;
    yourActivations?: string[];
    activationCount?: number;
  }
): RoutineTemplate {
  return {
    id: identity.id,
    ownerId: identity.owner,
    ...(identity.sourceActionId
      ? { sourceActionId: identity.sourceActionId }
      : {}),
    name: draft.name,
    description: draft.description ?? '',
    instructions: draft.task.user_prompt,
    triggers: triggerLines(draft.trigger),
    variables: draft.variables.map(variableFromWire),
    yourActivations: identity.yourActivations ?? [],
    activationCount: identity.activationCount ?? 0,
  };
}

export function templateFromWire(view: TemplateView): RoutineTemplate {
  return draftToModel(view, {
    id: view.id,
    owner: view.owner,
    sourceActionId: view.source_action_id,
    yourActivations: view.your_activations,
    activationCount: view.activation_count,
  });
}

export function provenanceFromWire(provenance: RoutineProvenance): Provenance {
  return {
    templateId: provenance.template_id,
    ...(provenance.template
      ? {
          template: {
            name: provenance.template.name,
            ownerId: provenance.template.owner,
          },
        }
      : {}),
    variables: provenance.variables.map(variableFromWire),
    bindings: bindingsFromWire(provenance.bindings),
    rebindable: provenance.rebindable,
  };
}

/** Apply the creator's edits to the extracted draft, keeping the rest. */
export function applyShareEdits(
  draft: TemplateDraft,
  edits: ShareEdits
): TemplateDraft {
  return {
    ...draft,
    name: edits.name.trim(),
    description: edits.description.trim(),
    variables: draft.variables.map((variable) => {
      const edited = edits.variables.find((v) => v.key === variable.key);
      if (!edited) return variable;
      return {
        ...variable,
        label: edited.label.trim() || variable.label,
        description: edited.description.trim(),
        mode: edited.fixed
          ? { type: 'fixed' as const, value: valueToWire(edited.fixed) }
          : { type: 'variable' as const },
      };
    }),
  };
}
