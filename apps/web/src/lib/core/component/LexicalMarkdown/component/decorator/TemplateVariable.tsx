import type { TemplateVariableDecoratorProps } from '@macro-inc/lexical-core';
import { cn } from '@ui';
import { match } from 'ts-pattern';
import {
  type TemplateVariableChip,
  useTemplateVariableChip,
} from '../../context/TemplateVariableContext';

/** A template variable as a chip: its label until filled, then its value. */
export function TemplateVariableChipView(props: TemplateVariableChip) {
  return (
    <span
      class={cn(
        'inline-flex max-w-full items-center truncate rounded-sm border px-1.5 leading-normal',
        match(props.tone)
          .with('variable', () => 'border-accent/45 bg-accent/15 text-accent')
          .with('fixed', () => 'border-transparent bg-hover text-ink')
          .with('filled', () => 'border-transparent bg-link/15 text-link')
          .with('check', () => 'border-warning/55 bg-warning/12 text-warning')
          .exhaustive()
      )}
    >
      {props.tone === 'variable' ? `{${props.label}}` : props.label}
    </span>
  );
}

export function TemplateVariable(props: TemplateVariableDecoratorProps) {
  const describe = useTemplateVariableChip();
  const chip = () =>
    describe?.(props.key) ?? { label: props.key, tone: 'variable' as const };
  return (
    <span data-template-variable={props.key}>
      <TemplateVariableChipView label={chip().label} tone={chip().tone} />
    </span>
  );
}
