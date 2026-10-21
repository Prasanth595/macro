import { Telemetry } from '@macro-inc/observability';
import XIcon from '@phosphor/x.svg';
import { Button } from '@ui/components/Button';
import { Dialog } from '@ui/components/Dialog';
import { Panel } from '@ui/components/Panel';
import {
  createMemo,
  createSignal,
  lazy,
  onCleanup,
  Show,
  Suspense,
} from 'solid-js';
import { createImagePreview } from '../../image-editor/primitives/create-image-preview';
import { ImageEditor } from '../../image-editor/views/image-editor';
import type { ProfilePictureWriter } from '../core/profile-picture';

const ImagePreviewDialog = lazy(
  () => import('../../image-editor/components/image-preview-dialog')
);

export default function ProfilePictureEditor(props: {
  userId: string;
  pictureUrl?: string;
  writer: ProfilePictureWriter;
  onClose: () => void;
}) {
  const opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  const [selection, setSelection] = createSignal<File | null>();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const preview = createImagePreview({ 'user.id': props.userId });
  let disposed = false;
  let closing = false;
  onCleanup(() => {
    disposed = true;
  });

  const pictureUrl = createMemo(() => {
    const file = selection();
    if (file === null) return undefined;
    if (!file) return props.pictureUrl;
    const url = URL.createObjectURL(file);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });
  const source = () => {
    const selected = selection();
    if (selected === null || selected?.type === 'image/gif') return undefined;
    return selected ?? props.pictureUrl;
  };

  function close() {
    if (pending() || preview.open()) return;
    closing = true;
    props.onClose();
  }

  async function save(cropped?: File) {
    if (pending()) return;
    const file = cropped ?? selection();
    if (file === undefined) return;
    setPending(true);
    setError(undefined);
    await Telemetry.span('profile.picture.save', async (span) => {
      span.setAttr('user.id', props.userId);
      span.setAttr('image.cleared', file === null);
      const result = await props.writer(file);
      if (result.isErr()) span.error('Profile picture save failed');
      if (disposed) return;
      setPending(false);
      if (result.isErr()) {
        setError(result.error);
        return;
      }
      close();
    });
  }

  return (
    <Dialog
      open
      position="center"
      noOutsidePointerEvents={false}
      class="w-180"
      onOpenChange={(open) => !open && close()}
      onEscapeKeyDown={(event) => {
        if (preview.open() || pending()) event.preventDefault();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (closing && opener?.isConnected)
          opener.focus({ preventScroll: true });
      }}
    >
      <Panel depth={2} class="rounded-xl">
        <Panel.Body>
          <div class="flex max-h-[calc(100dvh-64px)] flex-col gap-6 overflow-y-auto pt-6 pb-4 mobile:max-h-none mobile:overflow-visible mobile:pt-4">
            <div class="flex items-center justify-between gap-4 px-6 mobile:px-4">
              <Dialog.Title class="text-xl font-semibold">
                Edit profile picture
              </Dialog.Title>
              <Dialog.CloseButton
                as={Button}
                variant="ghost"
                size="icon-sm"
                label="Close"
                tabIndex={-1}
                disabled={pending()}
              >
                <XIcon />
              </Dialog.CloseButton>
            </div>
            <ImageEditor
              source={source()}
              pictureUrl={pictureUrl()}
              fileName={selection()?.name}
              disabled={pending()}
              canSave={selection() !== undefined}
              hasImageDraft={selection() instanceof File}
              error={error()}
              cancelLabel="Cancel"
              outputFileName="profile-picture.png"
              telemetryAttributes={{ 'user.id': props.userId }}
              preview={preview}
              onSelect={(file) => {
                setSelection(file);
                setError(undefined);
              }}
              onClear={() => {
                setSelection(null);
                setError(undefined);
              }}
              onSave={(file) => void save(file)}
              onCancel={close}
            />
          </div>
        </Panel.Body>
      </Panel>
      <Show when={preview.open()}>
        <Suspense>
          <ImagePreviewDialog preview={preview} imageId="profile-picture" />
        </Suspense>
      </Show>
    </Dialog>
  );
}
