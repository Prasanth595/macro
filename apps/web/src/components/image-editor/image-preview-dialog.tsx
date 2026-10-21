import { Lightbox } from '@core/component/Lightbox';
import { Dialog } from '@kobalte/core/dialog';
import { Show } from 'solid-js';
import type { ImagePreviewController } from './create-image-preview';

export default function ImagePreviewDialog(props: {
  preview: ImagePreviewController;
  imageId: string;
}) {
  return (
    <Show
      when={props.preview.open() ? props.preview.source() : undefined}
      keyed
    >
      {(source) => (
        <Dialog
          open={props.preview.open()}
          onOpenChange={props.preview.onOpenChange}
        >
          <Dialog.Portal>
            <Dialog.Overlay class="fixed inset-0 z-modal scrim-glass" />
            <Lightbox
              src={() => source}
              imageId={() => props.imageId}
              navigationHidden
              onEscapeKeyDown={props.preview.onEscapeKeyDown}
              onPointerDownOutside={props.preview.onPointerDownOutside}
              onCloseAutoFocus={props.preview.onCloseAutoFocus}
            />
          </Dialog.Portal>
        </Dialog>
      )}
    </Show>
  );
}
