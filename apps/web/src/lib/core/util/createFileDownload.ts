import { toast } from '@core/component/Toast/Toast';
import { exportAndroidFileWithProgress } from '@core/mobile/exportAndroidFileWithProgress';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { isPlatform } from '@core/util/platform';
import type { ResultError } from '@core/util/result';
import { downloadFile } from '@filesystem/download';
import { type Span, Telemetry } from '@macro-inc/observability';
import type { FetchProgress } from '@service-storage/util/fetchPresigned';
import type { Result } from 'neverthrow';
import {
  type Accessor,
  batch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';

export type DownloadSource = {
  id: string;
  name: string;
  load: (options: {
    signal: AbortSignal;
    onProgress: (progress: FetchProgress) => void;
  }) => Promise<Result<{ blob: Blob; name?: string }, ResultError<string>[]>>;
};

export function createFileDownload(
  source: Accessor<DownloadSource | undefined>
) {
  const [phase, setPhase] = createSignal<
    'idle' | 'loading' | 'ready' | 'saving' | 'error'
  >('idle');
  const [open, setOpen] = createSignal(false);
  const [file, setFile] = createSignal<File>();
  const [name, setName] = createSignal('');
  const [progress, setProgress] = createSignal<FetchProgress>({
    loaded: 0,
    total: 0,
  });
  let controller: AbortController | undefined;
  let selectedId: string | undefined;
  let trace: Span | undefined;
  const finishTrace = (outcome: string, error?: unknown) => {
    if (error !== undefined) trace?.error(error);
    trace?.setAttr('file.outcome', outcome);
    trace?.end();
    trace = undefined;
  };
  let opener: HTMLElement | undefined;
  const restoreFocus = () => {
    if (opener?.isConnected) opener.focus();
  };

  const cancel = () => {
    finishTrace('canceled');
    controller?.abort();
    controller = undefined;
    setOpen(false);
    setFile(undefined);
    setPhase('idle');
  };
  onCleanup(cancel);
  // Abort the external transfer when the viewer changes file or version.
  createEffect(on(() => source()?.id, cancel, { defer: true }));

  const busy = () => phase() === 'loading' || phase() === 'saving';
  const canShare = () => {
    const ready = file();
    return (
      !!ready &&
      (isPlatform('android') || !!navigator.canShare?.({ files: [ready] }))
    );
  };

  // Called directly from the ready sheet's button, without a network await:
  // Web Share requires a fresh user gesture, especially for large videos on iOS.
  const handOff = async (action: 'save' | 'share') => {
    const ready = file();
    const request = controller;
    if (!ready || !request || request.signal.aborted || phase() === 'saving')
      return;
    if (source()?.id !== selectedId) {
      cancel();
      return;
    }
    setPhase('saving');
    // A cancelled chooser can be retried with the already prepared bytes.
    trace ??= Telemetry.span('file.download');
    trace.setAttr('file.id', selectedId ?? '');
    trace.setAttr('file.size', ready.size);
    const span = trace.span(`file.${action}`);
    try {
      await span.run(async () => {
        let canceled = false;
        if (isPlatform('android')) {
          ({ canceled } = await exportAndroidFileWithProgress(
            ready,
            ready.name,
            action,
            request.signal
          ));
        } else if (action === 'share') {
          await navigator.share({ files: [ready] });
        } else {
          const { saved } = await downloadFile(ready, ready.name);
          if (!saved) {
            span.error('Unable to save file');
            if (controller === request) {
              setPhase('ready');
              finishTrace('failed', 'Unable to save file');
            }
            return;
          }
        }
        span.setAttr('file.outcome', canceled ? 'canceled' : 'handed_off');
        if (controller !== request) return;
        if (canceled) {
          finishTrace('canceled');
          setPhase('ready');
          return;
        }
        if (action === 'save') {
          toast.success(
            isPlatform('android') ? 'File saved' : 'Download started',
            {
              subtext: isPlatform('android')
                ? ready.name
                : `${ready.name} — check your browser or device downloads.`,
            }
          );
        }
        finishTrace('handed_off');
        cancel();
        if (!isTouchDevice()) restoreFocus();
      });
    } catch (error) {
      const canceled =
        request.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError');
      if (canceled) span.setAttr('file.outcome', 'canceled');
      else span.error(error);
      if (controller !== request) return;
      setPhase('ready');
      finishTrace(
        canceled ? 'canceled' : 'failed',
        canceled ? undefined : error
      );
      if (canceled) return;
      Telemetry.error(error, { surface: 'file-download' });
      toast.failure('Unable to save or share file', {
        subtext: 'Please try again.',
      });
    } finally {
      span.end();
    }
  };

  const start = async () => {
    if (busy()) return;
    const snapshot = source();
    if (!snapshot) return;
    if (document.activeElement instanceof HTMLElement)
      opener = document.activeElement;
    const request = new AbortController();
    const mobile = isTouchDevice();
    batch(() => {
      cancel();
      selectedId = snapshot.id;
      controller = request;
      setName(snapshot.name);
      setProgress({ loaded: 0, total: 0 });
      setPhase('loading');
      setOpen(mobile);
    });
    trace = Telemetry.span('file.download');
    trace.setAttr('file.id', snapshot.id);
    const span = trace.span('file.load');
    try {
      const result = await span.run(async () => {
        try {
          const result = await snapshot.load({
            signal: request.signal,
            onProgress: (next) => {
              if (controller === request) setProgress(next);
            },
          });
          if (result.isErr() && !request.signal.aborted)
            span.error(result.error);
          return result;
        } catch (error) {
          if (request.signal.aborted) span.setAttr('file.outcome', 'canceled');
          else span.error(error);
          throw error;
        } finally {
          span.end();
        }
      });
      if (controller !== request || request.signal.aborted) return;
      if (source()?.id !== snapshot.id) {
        cancel();
        return;
      }
      if (result.isErr()) {
        setPhase('error');
        finishTrace('failed', result.error);
        if (!mobile)
          toast.failure('Unable to download file', {
            subtext: 'Try again. The file may no longer be available.',
          });
        return;
      }
      const filename = result.value.name || snapshot.name;
      trace?.setAttr('file.size', result.value.blob.size);
      setName(filename);
      setFile(
        new File([result.value.blob], filename, {
          type: result.value.blob.type,
        })
      );
      setPhase('ready');
      if (!mobile) await handOff('save');
    } catch (error) {
      if (controller !== request || request.signal.aborted) return;
      setPhase('error');
      finishTrace('failed', error);
      Telemetry.error(error, { surface: 'file-download' });
      if (!mobile)
        toast.failure('Unable to download file', {
          subtext: 'Try again. The file may no longer be available.',
        });
    }
  };

  return {
    start,
    cancel,
    handOff,
    open,
    phase,
    busy,
    file,
    name,
    progress,
    canShare,
    restoreFocus,
  };
}

export type FileDownloadController = ReturnType<typeof createFileDownload>;
