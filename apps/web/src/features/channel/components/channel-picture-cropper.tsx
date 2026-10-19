import { Telemetry } from '@macro-inc/observability';
import ArrowCounterClockwiseIcon from '@phosphor/arrow-counter-clockwise.svg';
import MinusIcon from '@phosphor/minus.svg';
import PlusIcon from '@phosphor/plus.svg';
import { Button } from '@ui/components/Button';
import Cropper from 'cropperjs';
import { ResultAsync } from 'neverthrow';
import {
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { ChannelImageEditorLayout } from './channel-image-editor-layout';

export default function ChannelPictureCropper(props: {
  channelId: string;
  source: File | string;
  disabled: boolean;
  actions?: JSX.Element;
  onApply: (file: File) => void;
  onCancel: () => void;
}) {
  let container!: HTMLDivElement;
  let cropper: Cropper | undefined;
  let disposed = false;
  const [ready, setReady] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [zoomPercent, setZoomPercent] = createSignal(100);
  const disabled = () => props.disabled || exporting() || !ready();

  onCleanup(() => {
    disposed = true;
    cropper?.destroy();
  });
  createEffect(
    on(disabled, (value) => {
      const canvas = cropper?.getCropperCanvas();
      if (canvas) canvas.disabled = value;
      container
        .querySelectorAll<HTMLElement>('cropper-handle[role="button"]')
        .forEach((handle) => {
          handle.tabIndex = value ? -1 : 0;
          handle.setAttribute('aria-disabled', String(value));
        });
    })
  );

  onMount(() => {
    const source = props.source;
    const url = source instanceof File ? URL.createObjectURL(source) : source;
    if (source instanceof File) onCleanup(() => URL.revokeObjectURL(url));
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    cropper = new Cropper(image, {
      container,
      template: `
        <cropper-canvas style="width: 100%; height: 100%;">
          <cropper-image initial-fit="cover" min-fit="cover" max-inset="0" scalable translatable></cropper-image>
          <cropper-handle action="move" plain></cropper-handle>
          <cropper-selection initial-coverage="1" aspect-ratio="1" min-inset="0" resizable precise>
            <cropper-handle action="move" plain></cropper-handle>
            <div aria-hidden="true" class="pointer-events-none absolute inset-0 rounded-full border-2 border-accent/80 shadow-[0_0_0_999px_rgb(from_var(--color-modal-overlay)_r_g_b_/_75%)]">
              <div class="absolute inset-0 overflow-hidden rounded-full opacity-0 transition-opacity not-touch:group-hover/crop:opacity-100 group-focus-within/crop:opacity-100">
                <div class="absolute inset-y-0 left-1/3 w-1/3 border-x border-accent/40"></div>
                <div class="absolute inset-x-0 top-1/3 h-1/3 border-y border-accent/40"></div>
              </div>
            </div>
            <cropper-handle action="nw-resize" role="button" aria-label="Resize crop from top left" theme-color="var(--color-accent)" class="top-0 left-0 size-8 rounded-sm after:size-3 after:rounded-sm after:border-2 after:border-surface focus-visible:outline-2 focus-visible:outline-accent touch:size-11"></cropper-handle>
            <cropper-handle action="ne-resize" role="button" aria-label="Resize crop from top right" theme-color="var(--color-accent)" class="top-0 right-0 size-8 rounded-sm after:size-3 after:rounded-sm after:border-2 after:border-surface focus-visible:outline-2 focus-visible:outline-accent touch:size-11"></cropper-handle>
            <cropper-handle action="sw-resize" role="button" aria-label="Resize crop from bottom left" theme-color="var(--color-accent)" class="bottom-0 left-0 size-8 rounded-sm after:size-3 after:rounded-sm after:border-2 after:border-surface focus-visible:outline-2 focus-visible:outline-accent touch:size-11"></cropper-handle>
            <cropper-handle action="se-resize" role="button" aria-label="Resize crop from bottom right" theme-color="var(--color-accent)" class="right-0 bottom-0 size-8 rounded-sm after:size-3 after:rounded-sm after:border-2 after:border-surface focus-visible:outline-2 focus-visible:outline-accent touch:size-11"></cropper-handle>
          </cropper-selection>
        </cropper-canvas>
      `,
    });
    const canvas = cropper.getCropperCanvas();
    if (canvas) canvas.disabled = disabled();
    const selection = cropper.getCropperSelection();
    const onSelectionChange = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        (event.detail.width < 96 || event.detail.height < 96)
      ) {
        event.preventDefault();
      }
    };
    selection?.addEventListener('change', onSelectionChange);
    onCleanup(() =>
      selection?.removeEventListener('change', onSelectionChange)
    );
    const cropperImage = cropper.getCropperImage();
    // Cropper emits before committing a transform, and can reject the change.
    const onTransform = () => queueMicrotask(updateZoom);
    cropperImage?.addEventListener('transform', onTransform);
    onCleanup(() =>
      cropperImage?.removeEventListener('transform', onTransform)
    );
    container.focus({ preventScroll: true });
    void loadImage();
  });

  async function loadImage() {
    const image = cropper?.getCropperImage();
    if (!image) return;
    const result = await ResultAsync.fromPromise(image.$ready(), () => ({
      kind: 'decode' as const,
    }));
    if (disposed) return;
    if (result.isErr()) {
      setError('Could not read this image. Go back and choose another image.');
      return;
    }
    updateZoom();
    setReady(true);
  }

  function updateZoom() {
    if (disposed) return;
    const image = cropper?.getCropperImage();
    const canvas = cropper?.getCropperCanvas();
    if (!image || !canvas || !image.$image.naturalWidth) return;
    const fit = Math.max(
      canvas.clientWidth / image.$image.naturalWidth,
      canvas.clientHeight / image.$image.naturalHeight
    );
    if (!fit) return;
    setZoomPercent(Math.round((image.$getTransform()[0] / fit) * 100));
  }

  function zoom(amount: number) {
    if (disabled()) return;
    const image = cropper?.getCropperImage();
    const selection = cropper?.getCropperSelection();
    if (!image || !selection) return;
    const imageBounds = image.getBoundingClientRect();
    const selectionBounds = selection.getBoundingClientRect();
    image.$zoom(
      amount,
      selectionBounds.x + selectionBounds.width / 2 - imageBounds.x,
      selectionBounds.y + selectionBounds.height / 2 - imageBounds.y
    );
  }

  function reset() {
    if (disabled()) return;
    cropper?.getCropperSelection()?.$reset();
    cropper?.getCropperImage()?.$center('cover');
  }

  async function apply() {
    const selection = cropper?.getCropperSelection();
    if (!selection || disabled()) return;
    setExporting(true);
    setError(undefined);
    await Telemetry.span('channel.picture.crop', async (span) => {
      span.setAttr('channel.id', props.channelId);
      if (props.source instanceof File) {
        span.setAttr('image.input_bytes', props.source.size);
      }
      const result = await ResultAsync.fromPromise(
        (async () => {
          const image = await selection.$toCanvas({
            width: 1024,
            height: 1024,
          });
          return new Promise<Blob | null>((resolve) => {
            image.toBlob(resolve, 'image/png');
          });
        })(),
        () => ({ kind: 'export' as const })
      );
      if (disposed) return;
      setExporting(false);
      if (result.isErr() || !result.value) {
        span.error('Channel picture crop failed');
        setError('Could not crop this image. Try again or go back.');
        return;
      }
      if (props.disabled) return;
      span.setAttr('image.output_bytes', result.value.size);
      props.onApply(
        new File(
          [result.value],
          props.source instanceof File
            ? `${props.source.name.replace(/\.[^.]+$/, '')}.png`
            : 'channel-picture.png',
          {
            type: 'image/png',
          }
        )
      );
    });
  }

  return (
    <ChannelImageEditorLayout
      sidebar={
        <>
          {props.actions}
          <Show when={error()}>
            <p role="alert" class="text-sm text-failure-ink">
              {error()}
            </p>
          </Show>
        </>
      }
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            class="touch:min-h-11"
            onClick={props.onCancel}
          >
            Back
          </Button>
          <Button
            variant="cta"
            size="md"
            class="touch:min-h-11"
            disabled={disabled()}
            onClick={() => void apply()}
          >
            {exporting()
              ? 'Applying…'
              : !ready() && !error()
                ? 'Loading…'
                : 'Apply crop'}
          </Button>
        </>
      }
    >
      <div class="flex flex-col gap-4">
        <div class="group/crop relative aspect-square w-full overflow-hidden rounded-lg">
          <div
            ref={container}
            role="group"
            aria-label="Crop preview"
            aria-busy={!ready() || exporting()}
            tabIndex={0}
            class="size-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-edge-focus"
            onKeyDown={(event) => {
              if (disabled()) return;
              const moves: Record<string, [number, number]> = {
                ArrowLeft: [-10, 0],
                ArrowRight: [10, 0],
                ArrowUp: [0, -10],
                ArrowDown: [0, 10],
              };
              const move = moves[event.key];
              if (!move) return;
              event.preventDefault();
              event.stopPropagation();
              const action =
                event.target instanceof HTMLElement
                  ? event.target
                      .closest('cropper-handle[role="button"]')
                      ?.getAttribute('action')
                  : undefined;
              if (action)
                cropper?.getCropperSelection()?.$resize(action, ...move);
              else cropper?.getCropperImage()?.$move(...move);
            }}
          />
        </div>
        <div class="flex w-full items-center justify-between gap-2">
          <output
            aria-label="Zoom level"
            class="min-w-12 text-sm tabular-nums text-ink-muted"
          >
            {ready() ? `${zoomPercent()}%` : '—'}
          </output>
          <div class="flex items-center gap-2">
            <Button
              label="Reset crop"
              size="md"
              variant="ghost"
              disabled={disabled()}
              onClick={reset}
            >
              <ArrowCounterClockwiseIcon />
              Reset
            </Button>
            <Button
              label="Zoom out"
              size="icon-md"
              variant="outline"
              disabled={disabled()}
              onClick={() => zoom(-0.1)}
            >
              <MinusIcon />
            </Button>
            <Button
              label="Zoom in"
              size="icon-md"
              variant="outline"
              disabled={disabled()}
              onClick={() => zoom(0.1)}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </div>
    </ChannelImageEditorLayout>
  );
}
