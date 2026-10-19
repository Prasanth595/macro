import { scrollToFocusedInput } from '@components/app/mobile/MobileDrawer';
import { toast } from '@core/component/Toast/Toast';
import { isMobile } from '@core/mobile/isMobile';
import { Telemetry } from '@macro-inc/observability';
import PictureIcon from '@phosphor/image.svg';
import XIcon from '@phosphor/x.svg';
import { Button } from '@ui/components/Button';
import { Dialog } from '@ui/components/Dialog';
import { Panel } from '@ui/components/Panel';
import { Stepper } from '@ui/components/Stepper';
import {
  createMemo,
  createSignal,
  lazy,
  onCleanup,
  Show,
  Suspense,
} from 'solid-js';
import {
  ChannelIdentityFields,
  ChannelImageActions,
} from '../components/channel-identity-fields';
import { ChannelImageEditorLayout } from '../components/channel-image-editor-layout';
import type { ChannelIdentityWriter } from '../core/channel-identity';
import {
  CHANNEL_PICTURE_MIME_TYPES,
  channelPictureFileError,
} from '../core/channel-picture';
import { createChannelIdentityEditor } from '../primitives/create-channel-identity-editor';

const ChannelPictureCropper = lazy(
  () => import('../components/channel-picture-cropper')
);

const MediaViewerDialog = lazy(async () => {
  const { MediaViewerDialog } = await import('../Media/MediaViewerDialog');
  return { default: MediaViewerDialog };
});

export type ChannelIdentityEditorProps = {
  channelId: string;
  name: string;
  pictureUrl?: string;
  pictureSourceUrl?: string;
  pictureFileName?: string;
  pictureLoading: boolean;
  canEdit: boolean;
  writer: ChannelIdentityWriter;
  onClose: () => void;
};

export function ChannelIdentityModal(props: ChannelIdentityEditorProps) {
  const opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  let closing = false;
  const state = createChannelIdentityEditor({
    name: props.name,
    canEdit: () => props.canEdit,
    writer: props.writer,
    onClose: () => {
      closing = true;
      props.onClose();
    },
  });
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const [cropSource, setCropSource] = createSignal<File | string>();
  const [editingImage, setEditingImage] = createSignal(false);
  const [previewSource, setPreviewSource] = createSignal<string>();
  const [previewOpen, setPreviewOpen] = createSignal(false);
  // Keep the uncropped source for repeat edits until this dialog closes.
  const [originalPicture, setOriginalPicture] = createSignal<File | string>();
  let input!: HTMLInputElement;
  let body!: HTMLDivElement;
  let previewTrigger: HTMLButtonElement | undefined;
  const localUrl = createMemo(() => {
    const file = state.picture();
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });
  const pictureUrl = () =>
    state.picture() === null ? undefined : (localUrl() ?? props.pictureUrl);

  const cropPreviewUrl = createMemo(() => {
    const source = cropSource();
    if (!(source instanceof File)) return source;
    const url = URL.createObjectURL(source);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });
  const imagePreviewUrl = () =>
    (editingImage() && cropPreviewUrl()) ||
    (state.picture() !== null && (localUrl() ?? props.pictureSourceUrl)) ||
    undefined;
  function previewPicture(trigger: HTMLButtonElement) {
    const source = imagePreviewUrl();
    if (!source) return;
    previewTrigger = trigger;
    void Telemetry.span('channel.picture.preview', async (span) => {
      span.setAttr('channel.id', props.channelId);
      span.setAttr(
        'image.is_draft',
        Boolean(state.picture()) ||
          (editingImage() && cropSource() instanceof File)
      );
      setPreviewSource(source);
      setPreviewOpen(true);
    });
  }

  function editPicture() {
    if (!props.canEdit || state.pending() || props.pictureLoading) return;
    setCropSource(
      state.picture() === null || state.picture()?.type === 'image/gif'
        ? undefined
        : (originalPicture() ?? state.picture() ?? props.pictureSourceUrl)
    );
    setEditingImage(true);
  }

  function selectPicture(file: File) {
    if (disposed || !props.canEdit || state.pending() || props.pictureLoading)
      return;
    if (channelPictureFileError(file)) {
      state.changePicture(file);
      return;
    }
    // Keep animated GIFs intact; canvas cropping produces a still image.
    if (file.type === 'image/gif') {
      setOriginalPicture(undefined);
      state.changePicture(file);
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

  const imageFileName = () => {
    const source = cropSource() ?? state.picture();
    if (source instanceof File) return source.name;
    return source === null ? undefined : props.pictureFileName;
  };
  function ImageActions() {
    return (
      <ChannelImageActions
        fileName={imageFileName()}
        disabled={!props.canEdit || state.pending() || props.pictureLoading}
        canClear={Boolean(cropSource() || pictureUrl())}
        canPreview={Boolean(imagePreviewUrl())}
        onPreview={previewPicture}
        error={state.error()}
        onPick={() => input.click()}
        onFilesDrop={dropPictures}
        onClear={() => {
          setOriginalPicture(undefined);
          setCropSource(undefined);
          state.changePicture(null);
        }}
      />
    );
  }

  function closePreview() {
    window.removeEventListener('pointerup', closePreview);
    window.removeEventListener('pointercancel', closePreview);
    queueMicrotask(() => setPreviewOpen(false));
  }
  onCleanup(() => {
    window.removeEventListener('pointerup', closePreview);
    window.removeEventListener('pointercancel', closePreview);
  });

  function returnToDetails() {
    setCropSource(undefined);
    setEditingImage(false);
    body
      .querySelector<HTMLButtonElement>('button')
      ?.focus({ preventScroll: true });
  }

  async function save() {
    if (!state.canSave() || props.pictureLoading || editingImage()) return;
    await Telemetry.span('channel.identity.save', async (span) => {
      span.setAttr('channel.id', props.channelId);
      span.setAttr(
        'channel.identity.picture_changed',
        state.picture() !== undefined
      );
      span.setAttr(
        'channel.identity.name_changed',
        state.name().trim() !== props.name
      );
      const saved = await state.save();
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
    <Dialog
      open
      position="center"
      noOutsidePointerEvents={false}
      onOpenChange={(open) => !open && !previewOpen() && state.close()}
      onCloseAutoFocus={(event) => {
        // A channel switch tears down the old editor without closing the new one.
        event.preventDefault();
        if (closing && opener?.isConnected)
          opener.focus({ preventScroll: true });
      }}
      onEscapeKeyDown={(event) => {
        if (previewOpen()) {
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
                disabled={state.pending()}
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
              <input
                ref={input}
                type="file"
                accept={CHANNEL_PICTURE_MIME_TYPES.join(',')}
                class="hidden"
                aria-label="Choose channel picture"
                disabled={!props.canEdit || state.pending()}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) selectPicture(file);
                }}
              />
              <Stepper
                step={editingImage() ? 1 : 0}
                transition={Stepper.transitions.slide}
                keepMounted
                class="overflow-clip"
              >
                <Stepper.Step>
                  <ChannelIdentityFields
                    name={state.name()}
                    pictureUrl={pictureUrl()}
                    pictureLoading={props.pictureLoading}
                    canEdit={props.canEdit}
                    pending={state.pending()}
                    canSave={state.canSave()}
                    error={state.error()}
                    onNameChange={state.changeName}
                    onEditPicture={editPicture}
                    onPickPicture={() => input.click()}
                    onFilesDrop={dropPictures}
                    onPreviewPicture={previewPicture}
                    onCancel={state.close}
                    onSave={() => void save()}
                  />
                </Stepper.Step>
                <Stepper.Step>
                  <Show when={editingImage()}>
                    <Show
                      when={cropSource()}
                      keyed
                      fallback={
                        <ChannelImageEditorLayout
                          sidebar={<ImageActions />}
                          footer={
                            <Button
                              variant="ghost"
                              size="md"
                              class="touch:min-h-11"
                              onClick={returnToDetails}
                            >
                              Back
                            </Button>
                          }
                        >
                          <div class="flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-edge-muted bg-control p-6 text-center">
                            <Show
                              when={pictureUrl()}
                              fallback={
                                <>
                                  <PictureIcon class="size-12 text-ink-placeholder" />
                                  <p class="text-sm text-ink-muted">
                                    Choose an image to get started.
                                  </p>
                                </>
                              }
                            >
                              {(src) => (
                                <>
                                  <img
                                    src={src()}
                                    alt="Channel picture draft"
                                    class="max-h-80 max-w-full object-contain"
                                  />
                                  <p class="text-xs text-ink-muted">
                                    Animated images are kept as uploaded.
                                  </p>
                                </>
                              )}
                            </Show>
                          </div>
                        </ChannelImageEditorLayout>
                      }
                    >
                      {(file) => (
                        <Suspense
                          fallback={
                            <p class="px-6 text-sm text-ink-muted mobile:px-4">
                              Loading image editor…
                            </p>
                          }
                        >
                          <ChannelPictureCropper
                            channelId={props.channelId}
                            source={file}
                            disabled={!props.canEdit || state.pending()}
                            actions={<ImageActions />}
                            onApply={(cropped) => {
                              setOriginalPicture(cropSource());
                              state.changePicture(cropped);
                              returnToDetails();
                            }}
                            onCancel={returnToDetails}
                          />
                        </Suspense>
                      )}
                    </Show>
                  </Show>
                </Stepper.Step>
              </Stepper>
            </div>
          </div>
        </Panel.Body>
      </Panel>
      <Show when={previewOpen() ? previewSource() : undefined} keyed>
        {(src) => (
          <Suspense>
            <MediaViewerDialog
              open={previewOpen()}
              items={() => [
                {
                  id: `${props.channelId}-picture`,
                  kind: 'image',
                  src,
                  fullSrc: src,
                },
              ]}
              currentIndex={() => 0}
              onCurrentIndexChange={() => {}}
              onOpenChange={(open) => {
                if (open) setPreviewOpen(true);
                // Both dialog libraries receive the same dismissal event.
                // Keep the parent guarded until that event finishes.
                else closePreview();
              }}
              onEscapeKeyDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                closePreview();
              }}
              onPointerDownOutside={(event) => {
                // Corvu dismisses on pointerup, so keep its guard through the gesture.
                event.preventDefault();
                window.addEventListener('pointerup', closePreview);
                window.addEventListener('pointercancel', closePreview);
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (!previewOpen() && previewTrigger?.isConnected)
                  previewTrigger.focus({ preventScroll: true });
              }}
            />
          </Suspense>
        )}
      </Show>
    </Dialog>
  );
}
