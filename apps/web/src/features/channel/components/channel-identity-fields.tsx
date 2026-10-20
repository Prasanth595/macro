import { fileDrop } from '@core/directive/fileDrop';
import PictureIcon from '@phosphor/image.svg';
import PencilIcon from '@phosphor/pencil-simple.svg';
import TrashIcon from '@phosphor/trash.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import { Button } from '@ui/components/Button';
import { TextField } from '@ui/components/TextField';
import { createSignal, type JSX, Show } from 'solid-js';
import { CHANNEL_PICTURE_MIME_TYPES } from '../core/channel-picture';
import { ChannelImagePreviewButton } from './channel-image-preview-button';

false && fileDrop;

export function ChannelImageActions(props: {
  fileName?: string;
  disabled: boolean;
  canClear: boolean;
  error?: string;
  onPick: () => void;
  onFilesDrop: (files: File[]) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = createSignal(false);
  return (
    <div class="flex flex-1 flex-col gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-medium break-all">
          {props.fileName || 'Channel image'}
        </h3>
      </div>
      <div
        role="group"
        aria-label="Image upload"
        class="flex min-h-48 flex-1"
        use:fileDrop={{
          disabled: props.disabled,
          acceptedMimeTypes: CHANNEL_PICTURE_MIME_TYPES,
          multiple: false,
          onDragStart: (valid, event) => {
            const items = event.dataTransfer?.items;
            setDragging(
              valid &&
                items?.length === 1 &&
                items[0].kind === 'file' &&
                CHANNEL_PICTURE_MIME_TYPES.includes(items[0].type)
            );
          },
          onDragEnd: () => setDragging(false),
          onDrop: props.onFilesDrop,
        }}
      >
        <Button
          type="button"
          variant="ghost"
          fullWidth
          aria-label="Upload channel image"
          disabled={props.disabled}
          onClick={props.onPick}
          class="h-auto flex-1 flex-col gap-3 rounded-lg border-dashed border-edge p-4 whitespace-normal"
          classList={{
            'border-accent bg-accent/5': dragging() && !props.disabled,
          }}
        >
          <UploadIcon class="size-6" />
          <span class="text-sm">
            {dragging() && !props.disabled
              ? 'Drop image here'
              : 'Click to upload or drag and drop an image'}
          </span>
          <span class="text-xs text-ink-muted">
            PNG, JPG, WebP or GIF up to 16 MB
          </span>
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="md"
        fullWidth
        disabled={props.disabled || !props.canClear}
        onClick={props.onClear}
        class="px-2 text-failure not-touch:not-disabled:hover:text-failure touch:min-h-11"
      >
        <TrashIcon class="size-4" />
        Clear image
      </Button>
      <Show when={props.error}>
        <p role="alert" class="text-sm text-failure-ink">
          {props.error}
        </p>
      </Show>
    </div>
  );
}

export function ChannelIdentityFields(props: {
  name: string;
  pictureUrl?: string;
  pictureLoading: boolean;
  canEdit: boolean;
  pending: boolean;
  canSave: boolean;
  error?: string;
  teamControls?: JSX.Element;
  onNameChange: (name: string) => void;
  onEditPicture: () => void;
  onPickPicture: () => void;
  onFilesDrop: (files: File[]) => void;
  onPreviewPicture: (trigger: HTMLButtonElement) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [dragging, setDragging] = createSignal(false);
  const imageDisabled = () =>
    !props.canEdit || props.pending || props.pictureLoading;
  return (
    <form
      class="flex w-full flex-col gap-6 text-sm text-ink"
      aria-label="Edit channel"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <div class="flex flex-col gap-4 px-6 mobile:px-4">
        <div class="flex items-start gap-8 max-sm:flex-col max-sm:items-center max-sm:gap-6">
          <div class="flex w-full min-w-0 flex-1 flex-col gap-4">
            <TextField
              value={props.name}
              onChange={props.onNameChange}
              readOnly={!props.canEdit}
              disabled={props.pending}
              validationState={props.name.trim() ? 'valid' : 'invalid'}
            >
              <TextField.Label>Channel name</TextField.Label>
              <TextField.Input placeholder="Channel name" size="lg" required />
              <TextField.ErrorMessage>
                A channel name is required.
              </TextField.ErrorMessage>
            </TextField>
            {props.teamControls}
          </div>
          <div class="order-first flex shrink-0 flex-col items-center gap-3">
            <div
              class="group/channel-image relative"
              use:fileDrop={{
                disabled: imageDisabled(),
                acceptedMimeTypes: CHANNEL_PICTURE_MIME_TYPES,
                multiple: false,
                onDragStart: (valid, event) => {
                  const items = event.dataTransfer?.items;
                  setDragging(
                    valid &&
                      items?.length === 1 &&
                      items[0].kind === 'file' &&
                      CHANNEL_PICTURE_MIME_TYPES.includes(items[0].type)
                  );
                },
                onDragEnd: () => setDragging(false),
                onDrop: props.onFilesDrop,
              }}
            >
              <Button
                type="button"
                variant="ghost"
                class="group/channel-picture size-40 rounded-full border-edge p-0"
                classList={{
                  'border-accent bg-accent/5': dragging() && !imageDisabled(),
                }}
                label={
                  props.canEdit
                    ? props.pictureUrl
                      ? 'Edit channel image'
                      : 'Upload channel image'
                    : 'Channel picture'
                }
                disabled={imageDisabled()}
                onClick={() =>
                  props.pictureUrl
                    ? props.onEditPicture()
                    : props.onPickPicture()
                }
              >
                <Show
                  when={props.pictureUrl}
                  fallback={
                    <Show
                      when={props.canEdit}
                      fallback={
                        <PictureIcon class="size-12 text-ink-placeholder" />
                      }
                    >
                      <span class="flex flex-col items-center gap-2 text-ink-muted">
                        <UploadIcon class="size-8" />
                        <span class="text-xs font-medium">Upload image</span>
                      </span>
                    </Show>
                  }
                >
                  {(url) => (
                    <img
                      src={url()}
                      alt="Channel picture"
                      class="size-full rounded-full object-cover"
                    />
                  )}
                </Show>
                <Show when={props.canEdit && (props.pictureUrl || dragging())}>
                  <span
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-surface/60 text-ink opacity-0 transition-opacity not-touch:group-hover/channel-picture:opacity-100 group-focus-visible/channel-picture:opacity-100 touch:opacity-100"
                    classList={{
                      'opacity-100': dragging() && !imageDisabled(),
                    }}
                  >
                    <Show
                      when={dragging()}
                      fallback={<PencilIcon class="size-6" />}
                    >
                      <UploadIcon class="size-6" />
                    </Show>
                    <span class="text-xs font-medium">
                      {dragging() ? 'Drop image here' : 'Edit image'}
                    </span>
                  </span>
                </Show>
              </Button>
              <Show when={props.pictureUrl}>
                <ChannelImagePreviewButton
                  disabled={props.pending || props.pictureLoading}
                  onPreview={props.onPreviewPicture}
                />
              </Show>
            </div>
            <Show when={props.canEdit}>
              <p class="text-center text-xs text-ink-muted">
                {props.pictureUrl
                  ? 'Click to edit or drop an image'
                  : 'Click to upload or drop an image'}
              </p>
            </Show>
          </div>
        </div>
        <Show when={props.error}>
          <p role="alert" class="text-sm text-failure-ink">
            {props.error}
          </p>
        </Show>
        <Show when={!props.canEdit}>
          <p class="text-xs text-ink-muted">
            Join this channel to edit its name and picture.
          </p>
        </Show>
      </div>
      <div class="flex justify-end gap-2 border-t border-edge-muted px-6 pt-4 mobile:px-4">
        <Button
          type="button"
          variant="ghost"
          size="md"
          disabled={props.pending}
          onClick={props.onCancel}
          class="touch:min-h-11"
        >
          {props.canEdit ? 'Cancel' : 'Close'}
        </Button>
        <Show when={props.canEdit}>
          <Button
            type="submit"
            variant="cta"
            size="md"
            disabled={!props.canSave || props.pictureLoading}
            class="touch:min-h-11"
          >
            {props.pending ? 'Saving…' : 'Save'}
          </Button>
        </Show>
      </div>
    </form>
  );
}
