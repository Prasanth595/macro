import { RESET_UNIVERSAL_INPUT_EVENT } from '@app/features/universal-input/core/editor-events';
import { triggerFocusInput } from '@core/directive/focusInput';

/** Focus the selected split’s Home composer; Universal Input starts a fresh draft. */
export function resetHomeComposer(splitId: string | undefined) {
  if (!splitId) return;
  let reset = false;
  triggerFocusInput(() => {
    const input = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-universal-input][contenteditable="true"], [data-home-composer-align="agents"] [contenteditable="true"], [data-home-composer-align="legacy"] [contenteditable="true"]'
      )
    ).find(
      (input) =>
        input.closest<HTMLElement>('[data-split-id]')?.dataset.splitId ===
        splitId
    );
    if (input?.hasAttribute('data-universal-input') && !reset) {
      reset = true;
      input.dispatchEvent(new Event(RESET_UNIVERSAL_INPUT_EVENT));
    }
    return input;
  });
}
