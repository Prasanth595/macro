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
    on(
      () => props.disabled || exporting(),
      (value) => {
        const canvas = cropper?.getCropperCanvas();
        if (canvas) canvas.disabled = value;
      }
    )
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
          <cropper-image initial-fit="cover" min-fit="cover" max-inset="0" zoom-around-center scalable translatable></cropper-image>
          <cropper-handle action="move" plain></cropper-handle>
        </cropper-canvas>
      `,
    });
    const canvas = cropper.getCropperCanvas();
    if (canvas) canvas.disabled = props.disabled;
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
    cropper?.getCropperImage()?.$zoom(amount);
  }

  async function apply() {
    const canvas = cropper?.getCropperCanvas();
    if (!canvas || disabled()) return;
    setExporting(true);
    setError(undefined);
    await Telemetry.span('channel.picture.crop', async (span) => {
      span.setAttr('channel.id', props.channelId);
      if (props.source instanceof File) {
        span.setAttr('image.input_bytes', props.source.size);
      }
      const result = await ResultAsync.fromPromise(
        (async () => {
          const image = await canvas.$toCanvas({ width: 1024, height: 1024 });
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
          <div class="flex flex-col gap-3 border-t border-edge-muted pt-4">
            <div>
              <h3 class="text-sm font-medium">Position and zoom</h3>
              <p class="mt-1 text-xs text-ink-muted">
                Drag the image or use the arrow keys to reposition it.
              </p>
            </div>
            <div class="flex items-center justify-center gap-2">
              <Button
                label="Zoom out"
                size="icon-md"
                variant="outline"
                disabled={disabled()}
                onClick={() => zoom(-0.1)}
              >
                <MinusIcon />
              </Button>
              <output
                aria-label="Zoom level"
                class="min-w-12 text-center text-sm tabular-nums text-ink-muted"
              >
                {ready() ? `${zoomPercent()}%` : '—'}
              </output>
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
            <Button
              label="Reset crop"
              size="md"
              variant="ghost"
              disabled={disabled()}
              onClick={() => cropper?.getCropperImage()?.$center('cover')}
            >
              <ArrowCounterClockwiseIcon />
              Reset
            </Button>
          </div>
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
      <div class="flex justify-center">
        <div class="group/crop relative mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-lg">
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
              cropper?.getCropperImage()?.$move(...move);
            }}
          />
          <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 rounded-full border-2 border-accent/80 shadow-[0_0_0_999px_rgb(from_var(--color-modal-overlay)_r_g_b_/_75%)]"
          >
            <div class="absolute inset-0 overflow-hidden rounded-full opacity-0 transition-opacity not-touch:group-hover/crop:opacity-100 group-focus-within/crop:opacity-100">
              <div class="absolute inset-y-0 left-1/3 w-1/3 border-x border-accent/40" />
              <div class="absolute inset-x-0 top-1/3 h-1/3 border-y border-accent/40" />
            </div>
          </div>
        </div>
      </div>
    </ChannelImageEditorLayout>
  );
}
