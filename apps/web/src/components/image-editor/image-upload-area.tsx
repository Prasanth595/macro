import { fileDrop } from '@core/directive/fileDrop';
import TrashIcon from '@phosphor/trash.svg';
import UploadIcon from '@phosphor/upload-simple.svg';
import { Button } from '@ui/components/Button';
import { createSignal, Show } from 'solid-js';
import { IMAGE_MIME_TYPES } from './image-file';

false && fileDrop;

export function ImageUploadArea(props: {
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
          {props.fileName || 'Image'}
        </h3>
      </div>
      <div
        role="group"
        aria-label="Image upload"
        class="flex min-h-48 flex-1"
        use:fileDrop={{
          disabled: props.disabled,
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
          onDrop: props.onFilesDrop,
        }}
      >
        <Button
          type="button"
          variant="ghost"
          fullWidth
          aria-label="Upload image"
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
