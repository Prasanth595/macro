import ExpandIcon from '@phosphor/arrows-out-simple.svg';
import PictureIcon from '@phosphor/image.svg';
import PencilIcon from '@phosphor/pencil-simple.svg';
import TrashIcon from '@phosphor/trash.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import { Button } from '@ui/components/Button';
import { TextField } from '@ui/components/TextField';
import { Show } from 'solid-js';

export function ChannelImageActions(props: {
  fileName?: string;
  disabled: boolean;
  canClear: boolean;
  canPreview: boolean;
  error?: string;
  onPick: () => void;
  onClear: () => void;
  onPreview: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-medium break-all">
            {props.fileName || 'Channel image'}
          </h3>
          <p class="mt-1 text-xs text-ink-muted">
            PNG, JPG, WebP or GIF up to 16 MB
          </p>
        </div>
        <Show when={props.canPreview}>
          <Button
            variant="outline"
            size="icon-md"
            label="Preview image"
            disabled={props.disabled}
            class="touch:min-h-11 touch:min-w-11"
            onClick={(event) => props.onPreview(event.currentTarget)}
          >
            <ExpandIcon />
          </Button>
        </Show>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <Button
          variant="accent"
          size="md"
          fullWidth
          disabled={props.disabled}
          onClick={props.onPick}
          class="px-2 touch:min-h-11"
        >
          <UploadIcon class="size-4" />
          Change image
        </Button>
        <Button
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
      </div>
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
  onNameChange: (name: string) => void;
  onEditPicture: () => void;
  onPreviewPicture: (trigger: HTMLButtonElement) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
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
          <div class="w-full min-w-0 flex-1">
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
          </div>
          <div class="order-first flex shrink-0 flex-col items-center gap-3">
            <div class="relative">
              <Button
                type="button"
                variant="ghost"
                class="group/channel-picture size-40 rounded-full p-0"
                label={props.canEdit ? 'Edit channel image' : 'Channel picture'}
                disabled={
                  !props.canEdit || props.pending || props.pictureLoading
                }
                onClick={props.onEditPicture}
              >
                <Show
                  when={props.pictureUrl}
                  fallback={
                    <PictureIcon class="size-12 text-ink-placeholder" />
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
                <Show when={props.canEdit}>
                  <span
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-surface/60 text-ink opacity-0 transition-opacity not-touch:group-hover/channel-picture:opacity-100 group-focus-visible/channel-picture:opacity-100 touch:opacity-100"
                  >
                    <PencilIcon class="size-6" />
                    <span class="text-xs font-medium">Edit image</span>
                  </span>
                </Show>
              </Button>
              <Show when={props.pictureUrl}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-md"
                  label="Preview image"
                  class="absolute right-0 bottom-0 touch:min-h-11 touch:min-w-11"
                  disabled={props.pending || props.pictureLoading}
                  onClick={(event) =>
                    props.onPreviewPicture(event.currentTarget)
                  }
                >
                  <ExpandIcon />
                </Button>
              </Show>
            </div>
            <Show when={props.canEdit}>
              <p class="text-xs text-ink-muted">Click the image to edit</p>
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
