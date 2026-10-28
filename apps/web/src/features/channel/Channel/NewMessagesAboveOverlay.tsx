import ArrowUp from '@icon/system/regular/arrow-up.svg?component-solid';
import { Layer } from '@ui';

export function NewMessagesAboveOverlay(props: {
  count: number;
  onClick: () => void;
}) {
  const label = () =>
    `${props.count} new ${props.count === 1 ? 'message' : 'messages'}`;
  return (
    <Layer depth={3}>
      <button
        type="button"
        aria-label={`${label()} above`}
        class="absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs bg-surface border border-edge-muted shadow-lg not-touch:hover:overlay-hover not-touch:active:overlay-active top-4 touch:top-[calc(var(--mobile-content-inset-top,0)+1rem)]"
        onClick={() => props.onClick()}
      >
        <ArrowUp class="size-3.5" aria-hidden="true" />
        {label()}
      </button>
    </Layer>
  );
}
