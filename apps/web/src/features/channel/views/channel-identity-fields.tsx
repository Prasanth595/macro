import { IMAGE_MIME_TYPES } from '@app/components/image-editor/image-file';
import { ImagePreviewButton } from '@app/components/image-editor/image-preview-button';
import { fileDrop } from '@core/directive/fileDrop';
import PictureIcon from '@phosphor/image.svg';
import PencilIcon from '@phosphor/pencil-simple.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import { Button } from '@ui/components/Button';
import { TextField } from '@ui/components/TextField';
import { createSignal, Show } from 'solid-js';
import { useChannelIdentityContext } from '../context/channel-identity-context';
import { ChannelIdentityTeamFields } from './channel-identity-team-fields';

false && fileDrop;

export function ChannelIdentityFields() {
  const context = useChannelIdentityContext();
  const { form, canEdit } = context;
  let input!: HTMLInputElement;
  const [dragging, setDragging] = createSignal(false);
  const imageDisabled = () =>
    !canEdit() || form.pending() || context.pictureLoading();
  return (
    <form
      class="flex w-full flex-col gap-6 text-sm text-ink"
      aria-label="Edit channel"
      onSubmit={(event) => {
        event.preventDefault();
        void context.save();
      }}
    >
      <input
        ref={input}
        type="file"
        name="picture"
        accept={IMAGE_MIME_TYPES.join(',')}
        class="hidden"
        aria-label="Choose channel picture"
        disabled={imageDisabled()}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) context.selectPicture(file);
        }}
      />
      <div class="flex flex-col gap-4 px-6 mobile:px-4">
        <div class="flex items-start gap-8 max-sm:flex-col max-sm:items-center max-sm:gap-6">
          <div class="flex w-full min-w-0 flex-1 flex-col gap-4">
            <TextField
              name="name"
              value={form.values.name}
              onChange={form.changeName}
              readOnly={!canEdit()}
              disabled={form.pending()}
              validationState={form.values.name.trim() ? 'valid' : 'invalid'}
            >
              <TextField.Label>Channel name</TextField.Label>
              <TextField.Input placeholder="Channel name" size="lg" required />
              <TextField.ErrorMessage>
                A channel name is required.
              </TextField.ErrorMessage>
            </TextField>
            <ChannelIdentityTeamFields />
          </div>
          <div class="order-first flex shrink-0 flex-col items-center gap-3">
            <div
              class="group/image-editor relative"
              use:fileDrop={{
                disabled: imageDisabled(),
                acceptedMimeTypes: IMAGE_MIME_TYPES,
                multiple: false,
                onDragStart: (valid, event) => {
                  const items = event.dataTransfer?.items;
                  setDragging(
                    valid &&
                      items?.length === 1 &&
                      items[0].kind === 'file' &&
                      IMAGE_MIME_TYPES.includes(items[0].type)
                  );
                },
                onDragEnd: () => setDragging(false),
                onDrop: context.dropPictures,
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
                  canEdit()
                    ? context.pictureUrl()
                      ? 'Edit channel image'
                      : 'Upload channel image'
                    : 'Channel picture'
                }
                disabled={imageDisabled()}
                onClick={() =>
                  context.pictureUrl()
                    ? context.editPicture()
                    : (() => input.click())()
                }
              >
                <Show
                  when={context.pictureUrl()}
                  fallback={
                    <Show
                      when={canEdit()}
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
                <Show when={canEdit() && (context.pictureUrl() || dragging())}>
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
              <Show when={context.pictureUrl()}>
                <ImagePreviewButton
                  disabled={form.pending() || context.pictureLoading()}
                  onPreview={context.previewPicture}
                />
              </Show>
            </div>
            <Show when={canEdit()}>
              <p class="text-center text-xs text-ink-muted">
                {context.pictureUrl()
                  ? 'Click to edit or drop an image'
                  : 'Click to upload or drop an image'}
              </p>
            </Show>
          </div>
        </div>
        <Show when={form.error()}>
          <p role="alert" class="text-sm text-failure-ink">
            {form.error()}
          </p>
        </Show>
        <Show when={!canEdit()}>
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
          disabled={form.pending()}
          onClick={form.close}
          class="touch:min-h-11"
        >
          {canEdit() ? 'Cancel' : 'Close'}
        </Button>
        <Show when={canEdit()}>
          <Button
            type="submit"
            variant="cta"
            size="md"
            disabled={!form.canSave() || context.pictureLoading()}
            class="touch:min-h-11"
          >
            {form.pending() ? 'Saving…' : 'Save'}
          </Button>
        </Show>
      </div>
    </form>
  );
}
