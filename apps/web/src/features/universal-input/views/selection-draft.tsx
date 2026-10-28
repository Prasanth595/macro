import { registerHotkey, useHotkeyDOMScope } from '@core/hotkey/hotkeys';
import X from '@icon/system/regular/x.svg';
import { Button } from '@ui';
import { onMount } from 'solid-js';
import type { InputLayoutParts } from '../context/capabilities';
import type { OfferedSelection } from '../primitives/selection-offer';
import { SelectionUniversalInput } from '../universal-input';

/**
 * The card the reader gets beside their selection: the text it came from, then
 * the ordinary Universal Input form for the shape found in it.
 */
export function SelectionDraft(props: {
  offer: OfferedSelection;
  onClose: () => void;
}) {
  const [attachHotkeys, scopeId] = useHotkeyDOMScope('selection-draft');
  registerHotkey({
    scopeId,
    hotkey: 'escape',
    description: 'Close the selection card',
    runWithInputFocused: true,
    hide: true,
    keyDownHandler: () => {
      props.onClose();
      return true;
    },
  });
  let card: HTMLDivElement | undefined;
  // The chip the reader clicked is gone, so without this the card's keys —
  // Escape above all — would go to whatever held focus before it opened.
  onMount(() => card?.focus({ preventScroll: true }));
  const layout = (parts: InputLayoutParts) => (
    <div
      ref={(element) => {
        card = element;
        attachHotkeys(element);
      }}
      tabindex={-1}
      class="flex flex-col gap-2 outline-none"
      style={{
        '--universal-input-max-height': 'min(30rem, calc(100vh - 7rem))',
        '--universal-input-body-overflow': 'auto',
      }}
    >
      {/* The quoted text and the form read as one card: the page behind them
          must not show through a seam. */}
      <div class="flex min-h-0 flex-col rounded-2xl shadow-menu [&_.universal-input-fields]:rounded-t-none [&_.universal-input-fields]:border-t-0 [&_.universal-input-fields]:shadow-none">
        {parts.editor}
        {parts.fields}
      </div>
      {parts.result}
    </div>
  );
  return (
    <SelectionUniversalInput
      text={props.offer.text}
      intent={props.offer.intent}
      layout={layout}
      editor={
        <div class="flex shrink-0 items-start gap-2 rounded-t-2xl border border-edge-muted bg-panel px-5 py-3 sm:px-6">
          <blockquote class="line-clamp-2 min-w-0 flex-1 border-ink-extra-muted border-l-2 pl-2 text-ink-muted text-xs">
            {props.offer.text}
          </blockquote>
          <Button
            variant="ghost"
            size="icon-sm"
            label="Dismiss"
            class="-mt-1 -mr-2 shrink-0"
            onClick={props.onClose}
          >
            <X />
          </Button>
        </div>
      }
      onComplete={props.onClose}
      onNavigate={props.onClose}
    />
  );
}
