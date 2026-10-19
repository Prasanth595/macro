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
  on,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';

export default function ChannelPictureCropper(props: {
  channelId: string;
  file: File;
  disabled: boolean;
  onApply: (file: File) => void;
  onCancel: () => void;
}) {
  let container!: HTMLDivElement;
  let cropper: Cropper | undefined;
  let disposed = false;
  const [ready, setReady] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [error, setError] = createSignal<string>();
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
    const url = URL.createObjectURL(props.file);
    onCleanup(() => URL.revokeObjectURL(url));
    const image = new Image();
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
    setReady(true);
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
      span.setAttr('image.input_bytes', props.file.size);
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
          `${props.file.name.replace(/\.[^.]+$/, '')}.png`,
          {
            type: 'image/png',
          }
        )
      );
    });
  }

  return (
    <div class="flex flex-col gap-4">
      <div class="rounded-xl border border-edge-muted bg-control p-4 mobile:p-3">
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
            class="pointer-events-none absolute inset-0 rounded-full border-2 border-accent/80 shadow-[0_0_0_999px_var(--color-modal-overlay)]"
          >
            <div class="absolute inset-0 overflow-hidden rounded-full opacity-0 transition-opacity not-touch:group-hover/crop:opacity-100 group-focus-within/crop:opacity-100">
              <div class="absolute inset-y-0 left-1/3 w-1/3 border-x border-accent/40" />
              <div class="absolute inset-x-0 top-1/3 h-1/3 border-y border-accent/40" />
            </div>
          </div>
        </div>
        <p class="mt-3 text-center text-xs text-ink-muted">
          Drag to reposition or use the arrow keys.
        </p>
      </div>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="mr-1 text-sm text-ink-muted">Zoom</span>
          <Button
            label="Zoom out"
            size="icon-lg"
            variant="outline"
            disabled={disabled()}
            onClick={() => zoom(-0.1)}
          >
            <MinusIcon />
          </Button>
          <Button
            label="Zoom in"
            size="icon-lg"
            variant="outline"
            disabled={disabled()}
            onClick={() => zoom(0.1)}
          >
            <PlusIcon />
          </Button>
        </div>
        <Button
          label="Reset crop"
          size="lg"
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
      <div class="flex justify-end gap-3 border-t border-edge-muted pt-5">
        <Button
          variant="ghost"
          size="xl"
          class="min-w-28 mobile:min-w-0 mobile:flex-1"
          onClick={props.onCancel}
        >
          Back
        </Button>
        <Button
          variant="cta"
          size="xl"
          class="min-w-28 mobile:min-w-0 mobile:flex-1"
          disabled={disabled()}
          onClick={() => void apply()}
        >
          {exporting()
            ? 'Applying…'
            : !ready() && !error()
              ? 'Loading…'
              : 'Apply crop'}
        </Button>
      </div>
    </div>
  );
}
