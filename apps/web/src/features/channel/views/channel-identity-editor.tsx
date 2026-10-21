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
  type Accessor,
  createMemo,
  createSignal,
  lazy,
  onCleanup,
  Show,
  Suspense,
} from 'solid-js';
import {
  IMAGE_MIME_TYPES,
  imageFileError,
} from '../../image-editor/core/image-file';
import { createImagePreview } from '../../image-editor/primitives/create-image-preview';
import { ImageEditor } from '../../image-editor/views/image-editor';
import { ChannelIdentityFields } from '../components/channel-identity-fields';
import { ChannelTeamSettingsFields } from '../components/channel-team-settings-fields';
import type {
  ChannelIdentityTeamControls,
  ChannelIdentityWriter,
} from '../core/channel-identity';
import { createChannelIdentityEditor } from '../primitives/create-channel-identity-editor';

const ImagePreviewDialog = lazy(
  () => import('../../image-editor/components/image-preview-dialog')
);

export type ChannelIdentityEditorProps = {
  channelId: string;
  name: string;
  pictureUrl?: string;
  pictureSourceUrl?: string;
  pictureFileName?: string;
  pictureLoading: boolean;
  canEdit: boolean;
  writer: ChannelIdentityWriter;
  teamControls?: Accessor<ChannelIdentityTeamControls | undefined>;
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
    teamControls: props.teamControls,
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
  const preview = createImagePreview({ 'channel.id': props.channelId });
  // Retain the uncropped source if saving fails and the user edits again.
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

  function previewPicture(trigger: HTMLButtonElement) {
    const source =
      state.picture() !== null && (localUrl() ?? props.pictureSourceUrl);
    if (source) preview.show(source, trigger);
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
    if (imageFileError(file)) {
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
  function TeamControls() {
    return (
      <Show
        when={
          props.teamControls?.()?.canManage || state.teamChanges()
            ? state.teamSettings()
            : undefined
        }
      >
        {(settings) => (
          <div class="flex flex-col gap-3">
            <ChannelTeamSettingsFields
              isTeamChannel={settings().isTeamChannel}
              autoJoinTeam={settings().autoJoinTeam}
              canChangeChannelType={
                !props.teamControls?.()?.settings.isTeamChannel &&
                !!props.teamControls?.()?.canConvert
              }
              conversionUnavailableReason={
                props.teamControls?.()?.conversionUnavailableReason
              }
              disabled={
                !props.canEdit ||
                state.pending() ||
                !props.teamControls?.()?.canManage
              }
              onTeamChannelChange={state.changeTeamChannel}
              onAutoJoinTeamChange={state.changeAutoJoinTeam}
            />
            <Show when={state.teamChanges() && !state.canSaveTeam()}>
              <p class="text-xs text-ink-muted">
                Team settings can no longer be saved. Discard them to save your
                other changes.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={state.pending()}
                onClick={state.discardTeamChanges}
              >
                Discard team changes
              </Button>
            </Show>
          </div>
        )}
      </Show>
    );
  }

  function returnToDetails() {
    if (state.pending()) return;
    setCropSource(undefined);
    setEditingImage(false);
    body
      .querySelector<HTMLButtonElement>('button')
      ?.focus({ preventScroll: true });
  }

  async function save() {
    if (!state.canSave() || props.pictureLoading) return;
    await Telemetry.span('channel.identity.save', async (span) => {
      span.setAttr('channel.id', props.channelId);
      span.setAttr('channel.identity.team_changed', !!state.teamChanges());
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
      onOpenChange={(open) => !open && !preview.open() && state.close()}
      onCloseAutoFocus={(event) => {
        // A channel switch tears down the old editor without closing the new one.
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
                accept={IMAGE_MIME_TYPES.join(',')}
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
                    teamControls={<TeamControls />}
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
                    <ImageEditor
                      source={cropSource()}
                      pictureUrl={pictureUrl()}
                      fileName={imageFileName()}
                      disabled={
                        !props.canEdit ||
                        state.pending() ||
                        props.pictureLoading
                      }
                      saveDisabled={
                        !state.name().trim() || !state.canSaveTeam()
                      }
                      canSave={state.canSave()}
                      hasImageDraft={state.picture() instanceof File}
                      error={state.error()}
                      preview={preview}
                      telemetryAttributes={{ 'channel.id': props.channelId }}
                      outputFileName="channel-picture.png"
                      onSelect={selectPicture}
                      onClear={() => {
                        setOriginalPicture(undefined);
                        setCropSource(undefined);
                        state.changePicture(null);
                      }}
                      onSave={(cropped) => {
                        if (cropped) {
                          setOriginalPicture(cropSource());
                          state.changePicture(cropped);
                        }
                        returnToDetails();
                        void save();
                      }}
                      onCancel={returnToDetails}
                    />
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
  );
}
