import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { ButtonGroup, useButtonGroupContext } from '@ui/components/ButtonGroup';
import { cn } from '@ui/utils/classname';
import { type ParentProps, Show } from 'solid-js';

/** A desktop header island. Nested actions share their parent's frame. */
export function HeaderActionGroup(
  props: ParentProps<{ label: string; class?: string }>
) {
  const group = useButtonGroupContext();
  return (
    <Show when={!isTouchDevice() && !group} fallback={props.children}>
      <ButtonGroup
        label={props.label}
        variant="outline"
        size="md"
        class={cn('h-8 shrink-0', props.class)}
      >
        {props.children}
      </ButtonGroup>
    </Show>
  );
}
