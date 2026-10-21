import { toast } from '@core/component/Toast/Toast';
import PictureIcon from '@phosphor/image.svg';
import { Button } from '@ui/components/Button';
import {
  createMemo,
  createSignal,
  lazy,
  onCleanup,
  Show,
  Suspense,
} from 'solid-js';
import { ImageEditorLayout } from '../components/image-editor-layout';
import { ImagePreviewButton } from '../components/image-preview-button';
import { ImageUploadArea } from '../components/image-upload-area';
import { IMAGE_MIME_TYPES, imageFileError } from '../core/image-file';
import type { ImagePreviewController } from '../primitives/create-image-preview';

const ImageCropper = lazy(() => import('../components/image-cropper'));

export type ImageEditorProps = {
  source?: File | string;
  pictureUrl?: string;
  fileName?: string;
  disabled: boolean;
  saveDisabled?: boolean;
  canSave: boolean;
  hasImageDraft: boolean;
  error?: string;
  cancelLabel?: string;
  outputFileName?: string;
  telemetryAttributes?: Record<string, string>;
  preview: ImagePreviewController;
  onSelect: (file: File) => void;
  onClear: () => void;
  onSave: (file?: File) => void;
  onCancel: () => void;
};

export function ImageEditor(props: ImageEditorProps) {
  let input!: HTMLInputElement;
  const [validationError, setValidationError] = createSignal<string>();
  const previewUrl = createMemo(() => {
    const source = props.source;
    if (!(source instanceof File)) return source || props.pictureUrl;
    const url = URL.createObjectURL(source);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });

  function select(file: File) {
    if (props.disabled) return;
    const error = imageFileError(file);
    setValidationError(error);
    if (!error) props.onSelect(file);
  }

  function drop(files: File[]) {
    if (props.disabled) return;
    if (files.length !== 1) {
      toast.failure('Drop one image at a time.');
      return;
    }
    select(files[0]);
  }

  function Actions() {
    return (
      <ImageUploadArea
        fileName={props.fileName}
        disabled={props.disabled}
        canClear={Boolean(props.source || props.pictureUrl)}
        error={validationError() ?? props.error}
        onPick={() => input.click()}
        onFilesDrop={drop}
        onClear={() => {
          setValidationError(undefined);
          props.onClear();
        }}
      />
    );
  }

  function Preview() {
    return (
      <Show when={previewUrl()}>
        {(url) => (
          <ImagePreviewButton
            disabled={props.disabled}
            onPreview={(trigger) => props.preview.show(url(), trigger)}
          />
        )}
      </Show>
    );
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={IMAGE_MIME_TYPES.join(',')}
        class="hidden"
        aria-label="Choose image"
        disabled={props.disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) select(file);
        }}
      />
      <Show
        when={props.source}
        keyed
        fallback={
          <ImageEditorLayout
            sidebar={<Actions />}
            footer={
              <>
                <Button
                  variant="ghost"
                  size="md"
                  class="touch:min-h-11"
                  disabled={props.disabled}
                  onClick={props.onCancel}
                >
                  {props.cancelLabel ?? 'Back'}
                </Button>
                <Button
                  variant="cta"
                  size="md"
                  class="touch:min-h-11"
                  disabled={
                    props.disabled || props.saveDisabled || !props.canSave
                  }
                  onClick={() => props.onSave()}
                >
                  {props.disabled ? 'Saving…' : 'Save'}
                </Button>
              </>
            }
          >
            <div class="group/image-editor relative flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-edge-muted bg-control p-6 text-center">
              <Show
                when={props.pictureUrl}
                fallback={
                  <>
                    <PictureIcon class="size-12 text-ink-placeholder" />
                    <p class="text-sm text-ink-muted">
                      Choose an image to get started.
                    </p>
                  </>
                }
              >
                {(url) => (
                  <>
                    <img
                      src={url()}
                      alt="Image draft"
                      class="max-h-80 max-w-full object-contain"
                    />
                    <p class="text-xs text-ink-muted">
                      Animated images are kept as uploaded.
                    </p>
                  </>
                )}
              </Show>
              <Preview />
            </div>
          </ImageEditorLayout>
        }
      >
        {(source) => (
          <Suspense
            fallback={
              <p class="px-6 text-sm text-ink-muted mobile:px-4">
                Loading image editor…
              </p>
            }
          >
            <ImageCropper
              source={source}
              disabled={props.disabled}
              actions={<Actions />}
              preview={<Preview />}
              saveDisabled={props.saveDisabled}
              canSave={props.canSave}
              hasImageDraft={props.hasImageDraft}
              telemetryAttributes={props.telemetryAttributes}
              outputFileName={props.outputFileName}
              cancelLabel={props.cancelLabel}
              onSave={props.onSave}
              onCancel={props.onCancel}
            />
          </Suspense>
        )}
      </Show>
    </>
  );
}
