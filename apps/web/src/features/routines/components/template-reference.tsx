import ClockIcon from '@icon/system/regular/clock.svg';
import FileIcon from '@icon/system/regular/file-text.svg';
import HashIcon from '@icon/system/regular/hash.svg';
import LockIcon from '@icon/system/regular/lock-simple.svg';
import UserIcon from '@icon/system/regular/user.svg';
import type { TemplateVariable } from '@service-scheduled-action/generated/schemas';
import { cn } from '@ui';
import { type JSX, Match, Switch } from 'solid-js';
import type { ReferenceState } from '../core/template';

/** The name a reference shows: its label, or the time zone it keeps. */
export function variableLabel(variable: TemplateVariable): string {
  return variable.kind === 'time_zone' ? variable.timezone : variable.label;
}

function ReferenceIcon(props: { variable: TemplateVariable; class?: string }) {
  return (
    <Switch fallback={<FileIcon class={props.class} />}>
      <Match when={props.variable.kind === 'user'}>
        <UserIcon class={props.class} />
      </Match>
      <Match when={props.variable.kind === 'time_zone'}>
        <ClockIcon class={props.class} />
      </Match>
      <Match
        when={
          props.variable.kind === 'item' &&
          props.variable.block_name === 'channel'
        }
      >
        <HashIcon class={props.class} />
      </Match>
    </Switch>
  );
}

/**
 * A template reference as a chip: dashed when it fills in as the viewer,
 * amber when they can't open it, plain when it works for them as it is.
 */
export function TemplateReferenceChip(props: {
  variable: TemplateVariable;
  state: ReferenceState;
  /** Overrides the reference's own name, e.g. "you" for the author. */
  children?: JSX.Element;
}) {
  return (
    <span
      class={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 align-baseline text-sm',
        props.state === 'fills_in' &&
          'border-dashed border-accent/50 text-accent-ink',
        props.state === 'works' && 'border-transparent bg-ink/5 text-ink',
        (props.state === 'unavailable' || props.state === 'choose') &&
          'border-warning/50 bg-warning-bg text-warning'
      )}
    >
      {props.state === 'unavailable' ? (
        <LockIcon class="size-3.5 shrink-0" />
      ) : (
        <ReferenceIcon variable={props.variable} class="size-3.5 shrink-0" />
      )}
      <span class="truncate">
        {props.children ?? variableLabel(props.variable)}
      </span>
    </span>
  );
}
