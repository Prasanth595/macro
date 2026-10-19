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
      <p class="text-sm text-ink-muted">
        Drag to reposition. Use the arrow keys or zoom buttons to adjust.
      </p>
      <div
        ref={container}
        role="group"
        aria-label="Crop preview"
        aria-busy={!ready() || exporting()}
        tabIndex={0}
        class="mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-full border border-edge-muted bg-control outline-none focus-visible:ring-2 focus-visible:ring-edge-focus"
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
      <div class="flex items-center justify-center gap-2">
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
        <Button
          label="Reset crop"
          size="icon-lg"
          variant="ghost"
          disabled={disabled()}
          onClick={() => cropper?.getCropperImage()?.$center('cover')}
        >
          <ArrowCounterClockwiseIcon />
        </Button>
      </div>
      <Show when={error()}>
        <p role="alert" class="text-sm text-failure-ink">
          {error()}
        </p>
      </Show>
      <p class="text-xs text-ink-muted">
        Applying the crop updates your draft. Save the channel to keep it.
      </p>
      <div class="flex justify-end gap-2 border-t border-edge-muted pt-4">
        <Button variant="ghost" onClick={props.onCancel}>
          Back
        </Button>
        <Button
          variant="cta"
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
