import PictureIcon from '@phosphor/image.svg';
import TrashIcon from '@phosphor/trash.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import { Button } from '@ui/components/Button';
import { TextField } from '@ui/components/TextField';
import { Show } from 'solid-js';

export function ChannelIdentityFields(props: {
  name: string;
  pictureUrl?: string;
  pictureLoading: boolean;
  canEdit: boolean;
  pending: boolean;
  canSave: boolean;
  error?: string;
  onNameChange: (name: string) => void;
  onPickPicture: () => void;
  onClearPicture: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <form
      class="flex w-full flex-col gap-5 text-sm text-ink mobile:gap-6"
      aria-label="Edit channel"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        props.onCancel();
      }}
    >
      <div class="flex items-center gap-5 max-sm:flex-col max-sm:gap-4">
        <Button
          type="button"
          variant="ghost"
          class="group/channel-picture size-24 shrink-0 rounded-full p-0"
          label={props.canEdit ? 'Change channel picture' : 'Channel picture'}
          disabled={!props.canEdit || props.pending || props.pictureLoading}
          onClick={props.onPickPicture}
        >
          <Show
            when={props.pictureUrl}
            fallback={<PictureIcon class="size-9 text-ink-placeholder" />}
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
              class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-surface/60 text-ink opacity-0 transition-opacity not-touch:group-hover/channel-picture:opacity-100 group-focus-visible/channel-picture:opacity-100 touch:opacity-100"
            >
              <UploadIcon class="size-6" />
            </span>
          </Show>
        </Button>
        <div class="flex min-w-0 flex-1 flex-col items-start gap-3 max-sm:w-full max-sm:items-center">
          <Show when={props.canEdit}>
            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                class="touch:min-h-11 max-sm:gap-1 max-sm:px-1.5 max-sm:text-sm"
                disabled={props.pending || props.pictureLoading}
                onClick={props.onPickPicture}
              >
                <UploadIcon />
                Change image
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                class="text-failure not-touch:not-disabled:hover:text-failure touch:min-h-11 max-sm:gap-1 max-sm:px-1.5 max-sm:text-sm"
                disabled={
                  props.pending || props.pictureLoading || !props.pictureUrl
                }
                onClick={props.onClearPicture}
              >
                <TrashIcon />
                Clear image
              </Button>
            </div>
            <p class="text-xs text-ink-muted max-sm:text-center">
              PNG, JPG, WebP or GIF up to 16 MB
            </p>
          </Show>
          <Show when={!props.canEdit}>
            <p class="text-xs text-ink-muted">
              {props.pictureLoading
                ? 'Loading picture…'
                : props.pictureUrl
                  ? 'Channel picture'
                  : 'No channel picture'}
            </p>
          </Show>
        </div>
      </div>
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
      <div class="flex justify-end gap-3 border-t border-edge-muted pt-5">
        <Button
          type="button"
          variant="ghost"
          size="xl"
          disabled={props.pending}
          onClick={props.onCancel}
          class="min-w-28 mobile:min-w-0 mobile:flex-1"
        >
          {props.canEdit ? 'Cancel' : 'Close'}
        </Button>
        <Show when={props.canEdit}>
          <Button
            type="submit"
            variant="cta"
            size="xl"
            disabled={!props.canSave || props.pictureLoading}
            class="min-w-28 mobile:min-w-0 mobile:flex-1"
          >
            {props.pending ? 'Saving…' : 'Save'}
          </Button>
        </Show>
      </div>
    </form>
  );
}
