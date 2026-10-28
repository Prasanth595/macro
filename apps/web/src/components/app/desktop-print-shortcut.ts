import { isDesktopPlatform } from '@core/util/platform';
import { onCleanup } from 'solid-js';

export function useDesktopPrintShortcut(): void {
  if (!isDesktopPlatform()) return;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      !event.defaultPrevented &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'p'
    ) {
      event.preventDefault();
    }
  };

  // Bubble after focused blocks; cancel only native printing, not their actions.
  window.addEventListener('keydown', handleKeyDown);
  onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
}
