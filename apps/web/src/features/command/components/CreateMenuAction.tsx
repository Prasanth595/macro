import { Button, Hotkey } from '@ui';
import type { CreatableBlock } from '../types';

/** The shared primary action for the create menu's bottom lip. */
export function CreateMenuAction(props: {
  item: CreatableBlock;
  shiftHeld?: boolean;
  onChoose: (item: CreatableBlock) => void;
}) {
  return (
    <Button
      size="md"
      variant="strong"
      class="border-ink/12 bg-ink/[0.05] px-4 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]"
      aria-label={`Create ${props.item.label}${props.shiftHeld ? ' in new split' : ''}`}
      onClick={() => props.onChoose(props.item)}
    >
      {props.shiftHeld ? 'Create in new split' : `Create ${props.item.label}`}
      <Hotkey
        shortcut={props.shiftHeld ? 'shift+enter' : 'enter'}
        theme="current"
        aria-hidden="true"
      />
    </Button>
  );
}
