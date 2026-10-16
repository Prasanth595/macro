import { scrollToFocusedInput } from '@components/app/mobile/MobileDrawer';
import { useHoldParentHoverCardOpen } from '@core/component/HoverCard';
import { toast } from '@core/component/Toast/Toast';
import { isMobile } from '@core/mobile/isMobile';
import { Telemetry } from '@macro-inc/observability';
import XIcon from '@phosphor/x.svg';
import { Button } from '@ui/components/Button';
import { Dialog } from '@ui/components/Dialog';
import { Panel } from '@ui/components/Panel';
import { createMemo, createSignal, onCleanup, Show } from 'solid-js';
import { ChannelIdentityFields } from '../components/channel-identity-fields';
import type { ChannelIdentityWriter } from '../core/channel-identity';
import { CHANNEL_PICTURE_MIME_TYPES } from '../core/channel-picture';
import { createChannelIdentityEditor } from '../primitives/create-channel-identity-editor';

export type ChannelIdentityEditorProps = {
  channelId: string;
  name: string;
  pictureUrl?: string;
  fileName?: string;
  pictureLoading: boolean;
  canEdit: boolean;
  writer: ChannelIdentityWriter;
  onClose: () => void;
};

function ChannelIdentityEditor(
  props: ChannelIdentityEditorProps & { dialog?: boolean }
) {
  const state = createChannelIdentityEditor({
    name: props.name,
    canEdit: () => props.canEdit,
    writer: props.writer,
    onClose: props.onClose,
  });
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const [focused, setFocused] = createSignal(false);
  const [picking, setPicking] = createSignal(false);
  useHoldParentHoverCardOpen(
    () =>
      focused() ||
      picking() ||
      state.dirty() ||
      state.pending() ||
      !!state.error()
  );
  let input!: HTMLInputElement;
  const localUrl = createMemo(() => {
    const file = state.picture();
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });
  const pictureUrl = () =>
    state.picture() === null ? undefined : (localUrl() ?? props.pictureUrl);
  const fileName = () =>
    state.picture() === null
      ? undefined
      : (state.picture()?.name ?? props.fileName);
  async function save() {
    if (!state.canSave() || props.pictureLoading) return;
    await Telemetry.span('channel.identity.save', async (span) => {
      span.setAttr('channel.id', props.channelId);
      span.setAttr(
        'channel.identity.picture_changed',
        state.picture() !== undefined
      );
      span.setAttr(
        'channel.identity.name_changed',
        state.name().trim() !== props.name
      );
      const saved = await state.save();
      if (saved === false) {
        span.error('Channel identity save failed');
        if (disposed) {
          toast.failure(
            'Some channel changes could not be saved. Reopen the channel to retry.'
          );
        }
      }
    });
  }
  const fields = () => (
    <div
      onFocusIn={(event) => {
        setFocused(true);
        if (isMobile()) scrollToFocusedInput(event);
      }}
      onFocusOut={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setFocused(false);
      }}
    >
      <input
        ref={input}
        type="file"
        accept={CHANNEL_PICTURE_MIME_TYPES.join(',')}
        class="hidden"
        aria-label="Choose channel picture"
        disabled={!props.canEdit || state.pending()}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) state.changePicture(file);
          event.currentTarget.value = '';
          setPicking(false);
        }}
        onCancel={() => setPicking(false)}
      />
      <ChannelIdentityFields
        name={state.name()}
        pictureUrl={pictureUrl()}
        fileName={fileName()}
        pictureLoading={props.pictureLoading}
        canEdit={props.canEdit}
        pending={state.pending()}
        canSave={state.canSave()}
        error={state.error()}
        onNameChange={state.changeName}
        onPickPicture={() => {
          setPicking(true);
          input.click();
        }}
        onClearPicture={() => state.changePicture(null)}
        onCancel={state.close}
        onSave={() => void save()}
      />
    </div>
  );

  return (
    <Show when={props.dialog} fallback={fields()}>
      <Dialog
        open
        onOpenChange={(open) => !open && state.close()}
        class="w-100"
      >
        <Panel depth={2} class="rounded-xl">
          <Panel.Body>
            <div class="flex flex-col gap-6 p-5 mobile:p-4">
              <div class="flex items-center justify-between gap-4">
                <Dialog.Title class="text-lg font-semibold">
                  Edit channel
                </Dialog.Title>
                <Dialog.CloseButton
                  as={Button}
                  variant="ghost"
                  size="icon-sm"
                  label="Close"
                  tabIndex={-1}
                  disabled={state.pending()}
                >
                  <XIcon />
                </Dialog.CloseButton>
              </div>
              {fields()}
            </div>
          </Panel.Body>
        </Panel>
      </Dialog>
    </Show>
  );
}

export function ChannelIdentityCard(props: ChannelIdentityEditorProps) {
  return <ChannelIdentityEditor {...props} />;
}

export function ChannelIdentityModal(props: ChannelIdentityEditorProps) {
  return <ChannelIdentityEditor {...props} dialog />;
}
