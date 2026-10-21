import { createImagePreview } from '@app/components/image-editor/create-image-preview';
import { imageFileError } from '@app/components/image-editor/image-file';
import { scrollToFocusedInput } from '@components/app/mobile/MobileDrawer';
import { toast } from '@core/component/Toast/Toast';
import { isMobile } from '@core/mobile/isMobile';
import { Telemetry } from '@macro-inc/observability';
import XIcon from '@phosphor/x.svg';
import { Button } from '@ui/components/Button';
import { Dialog } from '@ui/components/Dialog';
import type { ManagedDialogProps } from '@ui/components/ImperativeDialog';
import { Panel } from '@ui/components/Panel';
import { Stepper } from '@ui/components/Stepper';
import {
  type Accessor,
  createMemo,
  createSignal,
  lazy,
  onCleanup,
  Show,
  Suspense,
} from 'solid-js';
import { ChannelIdentityProvider } from '../context/channel-identity-context';
import type {
  ChannelIdentityTeamControls,
  ChannelIdentityWriter,
} from '../core/channel-identity';
import { createChannelIdentityEditor } from '../primitives/create-channel-identity-editor';
import { ChannelIdentityFields } from './channel-identity-fields';
import { ChannelIdentityImageEditor } from './channel-identity-image-editor';

const ImagePreviewDialog = lazy(
  () => import('@app/components/image-editor/image-preview-dialog')
);

export type ChannelIdentityEditorProps = ManagedDialogProps & {
  channelId: string;
  name: string;
  pictureUrl?: string;
  pictureSourceUrl?: string;
  pictureFileName?: string;
  pictureLoading: boolean;
  canEdit: boolean;
  writer: ChannelIdentityWriter;
  teamControls?: Accessor<ChannelIdentityTeamControls | undefined>;
};

export function ChannelIdentityModal(props: ChannelIdentityEditorProps) {
  const opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  let closing = false;
  const form = createChannelIdentityEditor({
    name: props.name,
    canEdit: () => props.canEdit,
    writer: props.writer,
    teamControls: props.teamControls,
    onClose: () => {
      closing = true;
      props.onOpenChange(false);
    },
  });
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const [cropSource, setCropSource] = createSignal<File | string>();
  const [editingImage, setEditingImage] = createSignal(false);
  const preview = createImagePreview({ 'channel.id': props.channelId });
  // Retain the uncropped source if saving fails and the user edits again.
  const [originalPicture, setOriginalPicture] = createSignal<File | string>();
  let body!: HTMLDivElement;
  const localUrl = createMemo(() => {
    const file = form.values.picture;
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });
  const pictureUrl = () =>
    form.values.picture === null ? undefined : (localUrl() ?? props.pictureUrl);

  function previewPicture(trigger: HTMLButtonElement) {
    const source =
      form.values.picture !== null && (localUrl() ?? props.pictureSourceUrl);
    if (source) preview.show(source, trigger);
  }

  function editPicture() {
    if (!props.canEdit || form.pending() || props.pictureLoading) return;
    const picture = form.values.picture;
    setCropSource(
      picture === null || picture?.type === 'image/gif'
        ? undefined
        : (originalPicture() ?? picture ?? props.pictureSourceUrl)
    );
    setEditingImage(true);
  }

  function selectPicture(file: File) {
    if (disposed || !props.canEdit || form.pending() || props.pictureLoading)
      return;
    if (imageFileError(file)) {
      form.changePicture(file);
      return;
    }
    // Keep animated GIFs intact; canvas cropping produces a still image.
    if (file.type === 'image/gif') {
      setOriginalPicture(undefined);
      form.changePicture(file);
      setCropSource(undefined);
      setEditingImage(true);
      return;
    }
    setCropSource(file);
    setEditingImage(true);
  }

  function dropPictures(files: File[]) {
    if (files.length !== 1) {
      toast.failure('Drop one image at a time.');
      return;
    }
    selectPicture(files[0]);
  }

  function clearPicture() {
    setOriginalPicture(undefined);
    setCropSource(undefined);
    form.changePicture(null);
  }

  const imageFileName = () => {
    const source = cropSource() ?? form.values.picture;
    if (source instanceof File) return source.name;
    return source === null ? undefined : props.pictureFileName;
  };

  function returnToDetails() {
    if (form.pending()) return;
    setCropSource(undefined);
    setEditingImage(false);
    body
      .querySelector<HTMLButtonElement>('button')
      ?.focus({ preventScroll: true });
  }

  function saveImage(cropped?: File) {
    if (cropped) {
      setOriginalPicture(cropSource());
      form.changePicture(cropped);
    }
    returnToDetails();
    void save();
  }

  async function save() {
    if (!form.canSave() || props.pictureLoading) return;
    await Telemetry.span('channel.identity.save', async (span) => {
      span.setAttr('channel.id', props.channelId);
      span.setAttr('channel.identity.team_changed', !!form.teamChanges());
      span.setAttr(
        'channel.identity.picture_changed',
        form.values.picture !== undefined
      );
      span.setAttr(
        'channel.identity.name_changed',
        form.values.name.trim() !== props.name
      );
      const saved = await form.save();
      if (saved === false) {
        span.error('Channel identity save failed');
        if (disposed) {
          toast.failure(
            'Some channel changes could not be saved. Reopen the channel to retry.'
          );
        }
      }
    });
  }

  return (
    <ChannelIdentityProvider
      value={{
        channelId: props.channelId,
        form,
        canEdit: () => props.canEdit,
        pictureLoading: () => props.pictureLoading,
        pictureUrl,
        imageFileName,
        teamControls: props.teamControls,
        cropSource,
        preview,
        editPicture,
        selectPicture,
        dropPictures,
        clearPicture,
        previewPicture,
        returnToDetails,
        saveImage,
        save,
      }}
    >
      <Dialog
        open={props.open}
        position="center"
        noOutsidePointerEvents={false}
        onOpenChange={(open) => !open && !preview.open() && form.close()}
        onCloseAutoFocus={(event) => {
          // Owner disposal must not steal focus from a replacement editor.
          event.preventDefault();
          if (closing && opener?.isConnected)
            opener.focus({ preventScroll: true });
        }}
        onEscapeKeyDown={(event) => {
          if (preview.open()) {
            event.preventDefault();
            return;
          }
          if (!editingImage()) return;
          event.preventDefault();
          returnToDetails();
        }}
        class="w-180"
      >
        <Panel depth={2} class="rounded-xl">
          <Panel.Body>
            <div class="flex max-h-[calc(100dvh-64px)] flex-col gap-6 overflow-y-auto pt-6 pb-4 mobile:max-h-none mobile:overflow-visible mobile:pt-4">
              <div class="flex items-center justify-between gap-4 px-6 mobile:px-4">
                <Dialog.Title class="text-xl font-semibold">
                  {editingImage() ? 'Edit channel image' : 'Edit channel'}
                </Dialog.Title>
                <Dialog.CloseButton
                  as={Button}
                  variant="ghost"
                  size="icon-sm"
                  label="Close"
                  tabIndex={-1}
                  disabled={form.pending()}
                >
                  <XIcon />
                </Dialog.CloseButton>
              </div>
              <div
                ref={body}
                onFocusIn={(event) => {
                  if (isMobile()) scrollToFocusedInput(event);
                }}
              >
                <Stepper
                  step={editingImage() ? 1 : 0}
                  transition={Stepper.transitions.slide}
                  keepMounted
                  class="overflow-clip"
                >
                  <Stepper.Step>
                    <ChannelIdentityFields />
                  </Stepper.Step>
                  <Stepper.Step>
                    <Show when={editingImage()}>
                      <ChannelIdentityImageEditor />
                    </Show>
                  </Stepper.Step>
                </Stepper>
              </div>
            </div>
          </Panel.Body>
        </Panel>
        <Show when={preview.open()}>
          <Suspense>
            <ImagePreviewDialog
              preview={preview}
              imageId={`${props.channelId}-picture`}
            />
          </Suspense>
        </Show>
      </Dialog>
    </ChannelIdentityProvider>
  );
}
