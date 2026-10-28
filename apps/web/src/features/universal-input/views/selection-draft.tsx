import { registerHotkey, useHotkeyDOMScope } from '@core/hotkey/hotkeys';
import X from '@icon/system/regular/x.svg';
import { Button } from '@ui';
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
  const layout = (parts: InputLayoutParts) => (
    <div
      ref={attachHotkeys}
      class="flex flex-col gap-2 [&_.universal-input-fields]:shadow-lg"
      style={{
        '--universal-input-max-height': 'min(30rem, calc(100vh - 6rem))',
        '--universal-input-body-overflow': 'auto',
      }}
    >
      {parts.editor}
      {parts.fields}
      {parts.result}
    </div>
  );
  return (
    <SelectionUniversalInput
      text={props.offer.text}
      intent={props.offer.intent}
      layout={layout}
      editor={
        <div class="flex items-start gap-2 rounded-lg border border-edge-muted bg-panel px-3 py-2 shadow-lg">
          <blockquote class="line-clamp-2 min-w-0 flex-1 border-ink-extra-muted border-l-2 pl-2 text-ink-muted text-xs">
            {props.offer.text}
          </blockquote>
          <Button
            variant="ghost"
            size="icon-sm"
            label="Dismiss"
            class="-mt-0.5 -mr-1 shrink-0"
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
