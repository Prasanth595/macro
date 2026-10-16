import PictureIcon from '@phosphor/image.svg';
import PencilIcon from '@phosphor/pencil-line.svg';
import TrashIcon from '@phosphor/trash.svg';
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
      <div class="flex items-center gap-4 mobile:gap-5">
        <Button
          type="button"
          variant="ghost"
          class="size-20 shrink-0 overflow-hidden rounded-full p-0 mobile:size-24"
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
        </Button>
        <div class="flex min-w-0 flex-1 flex-col items-start gap-2.5">
          <div class="min-w-0 max-w-full">
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
          </div>
          <Show when={props.canEdit}>
            <div class="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={props.pending || props.pictureLoading}
                onClick={props.onPickPicture}
              >
                <PencilIcon />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={
                  props.pending || props.pictureLoading || !props.pictureUrl
                }
                onClick={props.onClearPicture}
              >
                <TrashIcon />
                Clear
              </Button>
            </div>
            <p class="text-xs text-ink-muted">
              PNG, JPG, WebP or GIF · up to 16 MB
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
            variant="strong"
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
