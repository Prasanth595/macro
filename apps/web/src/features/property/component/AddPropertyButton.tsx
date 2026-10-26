import PlusIcon from '@phosphor/plus.svg';
import { badgeTriggerClasses, type BadgeVariant } from '@ui';
import { usePropertiesContext } from '../context/PropertiesContext';

export function AddPropertyButton(props: {
  class?: string;
  variant?: BadgeVariant;
  onClick?: () => void;
}) {
  const { openPropertySelector } = usePropertiesContext();
  return (
    <button
      type="button"
      onClick={() => (props.onClick ?? openPropertySelector)()}
      class={badgeTriggerClasses({
        variant: props.variant ?? 'outline',
        size: 'sm',
        class: props.class,
      })}
    >
      <PlusIcon class="size-3 shrink-0" />
      <span>Add property</span>
    </button>
  );
}
