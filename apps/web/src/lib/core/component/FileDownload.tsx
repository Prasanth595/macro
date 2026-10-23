import { isTouchDevice } from '@core/mobile/isTouchDevice';
import type { FileDownloadController } from '@core/util/createFileDownload';
import { fireAndForget } from '@core/util/fireAndForget';
import { isPlatform } from '@core/util/platform';
import DownloadIcon from '@phosphor/download-simple.svg';
import ShareIcon from '@phosphor/export.svg';
import SpinnerIcon from '@phosphor/spinner.svg';
import { Button, Dialog } from '@ui';
import { Match, Show, Switch } from 'solid-js';

export function FileDownloadButton(props: {
  download: FileDownloadController;
}) {
  const label = () => (isTouchDevice() ? 'Save or share' : 'Download');
  const preparing = () => {
    const { loaded, total } = props.download.progress();
    return total > 0
      ? `Preparing ${Math.min(100, Math.round((loaded / total) * 100))}%`
      : 'Preparing…';
  };
  return (
    <>
      <Button
        variant="ghost"
        size="md"
        disabled={props.download.busy()}
        onClick={() => fireAndForget(props.download.start(), 'file-download')}
      >
        <Show when={props.download.busy()} fallback={<DownloadIcon />}>
          <SpinnerIcon class="animate-spin" />
        </Show>
        {props.download.busy()
          ? preparing()
          : props.download.phase() === 'error'
            ? 'Retry download'
            : label()}
      </Button>
      <Show when={props.download.busy() && !props.download.open()}>
        <Button variant="ghost" size="md" onClick={props.download.cancel}>
          Cancel
        </Button>
      </Show>
    </>
  );
}

export function FileDownloadDialog(props: {
  download: FileDownloadController;
}) {
  const percent = () => {
    const { loaded, total } = props.download.progress();
    return total > 0
      ? Math.min(100, Math.round((loaded / total) * 100))
      : undefined;
  };
  return (
    <Dialog
      open={props.download.open()}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        props.download.restoreFocus();
      }}
      onOpenChange={(open) => {
        if (!open) props.download.cancel();
      }}
      position="center"
      class="max-w-md"
    >
      <div class="flex flex-col gap-4 p-5 text-ink">
        <Dialog.Title class="text-lg font-medium">
          Save or share file
        </Dialog.Title>
        <Dialog.Description class="break-words text-sm text-ink-muted">
          {props.download.name()}
        </Dialog.Description>
        <Switch>
          <Match when={props.download.phase() === 'loading'}>
            <div
              role="status"
              class="flex items-center gap-2 text-sm text-ink-muted"
            >
              <SpinnerIcon class="size-4 animate-spin" />
              Preparing file{percent() !== undefined ? ` · ${percent()}%` : '…'}
            </div>
          </Match>
          <Match when={props.download.phase() === 'error'}>
            <p role="alert" class="text-sm text-ink-muted">
              This file couldn’t be downloaded. Check your connection and try
              again.
            </p>
            <Button
              variant="outline"
              onClick={() =>
                fireAndForget(props.download.start(), 'file-download')
              }
            >
              Try again
            </Button>
          </Match>
          <Match when={props.download.file()}>
            <p class="text-sm text-ink-muted">
              {isPlatform('android')
                ? 'Save a copy on your device, or send the file to another app.'
                : props.download.canShare()
                  ? 'Choose Save to Files, Save Video, or another app in your device’s share sheet. Available options depend on the file and device.'
                  : 'Your browser will handle the download. Find it in your browser or device downloads.'}
            </p>
            <Show when={isPlatform('android') || !isPlatform('ios')}>
              <Button
                variant="outline"
                disabled={props.download.busy()}
                onClick={() =>
                  fireAndForget(props.download.handOff('save'), 'file-download')
                }
              >
                <DownloadIcon />
                {isPlatform('android') ? 'Save file' : 'Download file'}
              </Button>
            </Show>
            <Show when={props.download.canShare()}>
              <Button
                variant="outline"
                disabled={props.download.busy()}
                onClick={() =>
                  fireAndForget(
                    props.download.handOff('share'),
                    'file-download'
                  )
                }
              >
                <ShareIcon />
                {isPlatform('android') ? 'Share file' : 'Save or share…'}
              </Button>
            </Show>
            <Show when={isPlatform('ios') && !props.download.canShare()}>
              <p role="alert" class="text-sm text-ink-muted">
                This device can’t share this file. Open Macro in Safari to
                download it.
              </p>
            </Show>
          </Match>
        </Switch>
        <Button variant="ghost" onClick={props.download.cancel}>
          {props.download.phase() === 'loading' ? 'Cancel download' : 'Close'}
        </Button>
      </div>
    </Dialog>
  );
}
