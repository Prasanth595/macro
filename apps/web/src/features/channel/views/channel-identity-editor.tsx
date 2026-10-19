import { scrollToFocusedInput } from '@components/app/mobile/MobileDrawer';
import { toast } from '@core/component/Toast/Toast';
import { isMobile } from '@core/mobile/isMobile';
import { Telemetry } from '@macro-inc/observability';
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
import { ChannelIdentityFields } from '../components/channel-identity-fields';
import type { ChannelIdentityWriter } from '../core/channel-identity';
import {
  CHANNEL_PICTURE_MIME_TYPES,
  channelPictureFileError,
} from '../core/channel-picture';
import { createChannelIdentityEditor } from '../primitives/create-channel-identity-editor';

const ChannelPictureCropper = lazy(
  () => import('../components/channel-picture-cropper')
);

export type ChannelIdentityEditorProps = {
  channelId: string;
  name: string;
  pictureUrl?: string;
  pictureSourceUrl?: string;
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
  // Keep the uncropped source for repeat edits until this dialog closes.
  const [originalPicture, setOriginalPicture] = createSignal<File | string>();
  let input!: HTMLInputElement;
  let body!: HTMLDivElement;
  const localUrl = createMemo(() => {
    const file = state.picture();
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });
  const pictureUrl = () =>
    state.picture() === null ? undefined : (localUrl() ?? props.pictureUrl);

  function returnToDetails() {
    setCropSource(undefined);
    body
      .querySelector<HTMLButtonElement>('button')
      ?.focus({ preventScroll: true });
  }

  async function save() {
    if (!state.canSave() || props.pictureLoading || cropSource()) return;
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
      onOpenChange={(open) => !open && state.close()}
      onCloseAutoFocus={(event) => {
        // A channel switch tears down the old editor without closing the new one.
        event.preventDefault();
        if (closing && opener?.isConnected)
          opener.focus({ preventScroll: true });
      }}
      onEscapeKeyDown={(event) => {
        if (!cropSource()) return;
        event.preventDefault();
        returnToDetails();
      }}
      class="w-152"
    >
      <Panel depth={2} class="rounded-xl">
        <Panel.Body>
          <div class="flex max-h-[calc(100dvh-64px)] flex-col gap-6 overflow-y-auto py-6 mobile:max-h-none mobile:overflow-visible mobile:py-4">
            <div class="flex items-center justify-between gap-4 px-6 mobile:px-4">
              <Dialog.Title class="text-xl font-semibold">
                {cropSource() ? 'Crop channel image' : 'Edit channel'}
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
                  if (!file) return;
                  // Keep animated GIFs intact; canvas cropping produces a still image.
                  if (channelPictureFileError(file)) {
                    state.changePicture(file);
                    return;
                  }
                  if (file.type === 'image/gif') {
                    setOriginalPicture(undefined);
                    state.changePicture(file);
                    return;
                  }
                  setCropSource(file);
                }}
              />
              <Stepper
                step={cropSource() ? 1 : 0}
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
                    onPickPicture={() => input.click()}
                    canCrop={
                      state.picture() !== null &&
                      Boolean(state.picture() ?? props.pictureSourceUrl) &&
                      state.picture()?.type !== 'image/gif'
                    }
                    onCropPicture={() =>
                      setCropSource(
                        originalPicture() ??
                          state.picture() ??
                          props.pictureSourceUrl
                      )
                    }
                    onClearPicture={() => {
                      setOriginalPicture(undefined);
                      state.changePicture(null);
                    }}
                    onCancel={state.close}
                    onSave={() => void save()}
                  />
                </Stepper.Step>
                <Stepper.Step>
                  <Show when={cropSource()} keyed>
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
                </Stepper.Step>
              </Stepper>
            </div>
          </div>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}
