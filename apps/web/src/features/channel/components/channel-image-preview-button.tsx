import ExpandIcon from '@phosphor/arrows-out-simple.svg';
import { Button } from '@ui/components/Button';

export function ChannelImagePreviewButton(props: {
  disabled: boolean;
  onPreview: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <div class="pointer-events-none absolute right-2 bottom-2 z-10 opacity-0 transition-opacity not-touch:group-hover/channel-image:pointer-events-auto not-touch:group-hover/channel-image:opacity-100 group-focus-within/channel-image:pointer-events-auto group-focus-within/channel-image:opacity-100 touch:pointer-events-auto touch:opacity-100">
      <Button
        type="button"
        variant="outline"
        size="icon-md"
        label="Preview image"
        class="touch:min-h-11 touch:min-w-11"
        disabled={props.disabled}
        onClick={(event) => props.onPreview(event.currentTarget)}
      >
        <ExpandIcon />
      </Button>
    </div>
  );
}
