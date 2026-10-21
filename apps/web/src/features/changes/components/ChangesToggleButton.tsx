import { isTouchDevice } from '@core/mobile/isTouchDevice';
import SquareSplitHorizontalIcon from '@phosphor/square-split-horizontal.svg';
import { Button } from '@ui';

/** Toggles the changes pane; totals live beside the pane's branch range. */
export function ChangesToggleButton(props: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={props.open ? 'accent' : 'ghost'}
      size={isTouchDevice() ? 'sm' : 'md'}
      label="Changes"
      aria-pressed={props.open}
      tooltip={props.open ? 'Hide the changes pane' : 'Show the changes pane'}
      // Preserve the pressed tint without stacking a second overlay.
      class="touch:h-7 gap-1.5 aria-pressed:[--color-active:transparent] not-touch:@max-[28rem]/split-header:w-8 touch:@max-[28rem]/split-header:w-7 @max-[28rem]/split-header:gap-0 @max-[28rem]/split-header:px-0"
      onClick={() => props.onToggle()}
    >
      <SquareSplitHorizontalIcon class="size-3.5" />
      <span class="@max-[28rem]/split-header:hidden">Changes</span>
    </Button>
  );
}
