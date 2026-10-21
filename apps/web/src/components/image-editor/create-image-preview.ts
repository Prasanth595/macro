import { Telemetry } from '@macro-inc/observability';
import { createSignal, onCleanup } from 'solid-js';

export function createImagePreview(
  telemetryAttributes: Record<string, string> = {}
) {
  const [source, setSource] = createSignal<string>();
  const [open, setOpen] = createSignal(false);
  let trigger: HTMLButtonElement | undefined;

  function close() {
    window.removeEventListener('pointerup', close);
    window.removeEventListener('pointercancel', close);
    // Keep the parent guarded until both dialog libraries finish dismissal.
    queueMicrotask(() => setOpen(false));
  }

  onCleanup(() => {
    window.removeEventListener('pointerup', close);
    window.removeEventListener('pointercancel', close);
  });

  return {
    source,
    open,
    show(url: string, button: HTMLButtonElement) {
      trigger = button;
      void Telemetry.span('image.preview', async (span) => {
        for (const [key, value] of Object.entries(telemetryAttributes))
          span.setAttr(key, value);
        setSource(url);
        setOpen(true);
      });
    },
    onOpenChange(value: boolean) {
      if (value) setOpen(true);
      else close();
    },
    onEscapeKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();
      close();
    },
    onPointerDownOutside(event: Event) {
      // Corvu dismisses on pointerup; retain the parent guard through the gesture.
      event.preventDefault();
      window.addEventListener('pointerup', close);
      window.addEventListener('pointercancel', close);
    },
    onCloseAutoFocus(event: Event) {
      event.preventDefault();
      if (!open() && trigger?.isConnected)
        trigger.focus({ preventScroll: true });
    },
  };
}

export type ImagePreviewController = ReturnType<typeof createImagePreview>;
