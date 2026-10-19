import PictureIcon from '@phosphor/image.svg';
import TrashIcon from '@phosphor/trash.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import { Button } from '@ui/components/Button';
import { TextField } from '@ui/components/TextField';
import { Tooltip } from '@ui/components/Tooltip';
import { Show } from 'solid-js';

export function ChannelIdentityFields(props: {
  name: string;
  pictureUrl?: string;
  fileName?: string;
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
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-4 mobile:gap-5">
          <Button
            type="button"
            variant="ghost"
            class="size-20 shrink-0 rounded-full p-0 mobile:size-24"
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
                class="absolute -right-1 bottom-0 flex size-8 items-center justify-center rounded-full border border-edge bg-surface text-ink shadow-sm"
              >
                <UploadIcon class="size-4" />
              </span>
            </Show>
          </Button>
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <Show
              when={props.fileName}
              fallback={
                <p class="text-xs text-ink-muted">
                  {props.pictureLoading
                    ? 'Loading picture…'
                    : props.pictureUrl
                      ? 'Channel picture'
                      : 'No channel picture'}
                </p>
              }
            >
              {(fileName) => (
                <Tooltip label={fileName()}>
                  <p class="max-w-48 truncate text-sm font-medium mobile:max-w-44">
                    {fileName()}
                  </p>
                </Tooltip>
              )}
            </Show>
            <Show when={props.canEdit}>
              <p class="text-xs text-ink-muted">
                PNG, JPG, WebP or GIF · up to 16 MB
              </p>
            </Show>
          </div>
        </div>
        <Show when={props.canEdit}>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              class="grow touch:min-h-11"
              disabled={props.pending || props.pictureLoading}
              onClick={props.onPickPicture}
            >
              <UploadIcon />
              Change image
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              class="grow touch:min-h-11"
              disabled={
                props.pending || props.pictureLoading || !props.pictureUrl
              }
              onClick={props.onClearPicture}
            >
              <TrashIcon />
              Clear image
            </Button>
          </div>
        </Show>
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
      <div class="flex justify-end gap-2 border-t border-edge-muted pt-4 mobile:pt-5">
        <Button
          type="button"
          variant="ghost"
          disabled={props.pending}
          onClick={props.onCancel}
          class="mobile:flex-1"
        >
          {props.canEdit ? 'Cancel' : 'Close'}
        </Button>
        <Show when={props.canEdit}>
          <Button
            type="submit"
            variant="accent"
            disabled={!props.canSave || props.pictureLoading}
            class="mobile:flex-1"
          >
            {props.pending ? 'Saving…' : 'Save'}
          </Button>
        </Show>
      </div>
    </form>
  );
}
