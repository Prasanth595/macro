import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { createStaticFile } from '@core/util/create';
import {
  useChannelPicture,
  useChannelPictureFileName,
} from '@queries/channel/picture';
import { Button } from '@ui/components/Button';
import { HoverCard } from '@ui/components/HoverCard';
import { createSignal, type ParentProps, Show, Suspense } from 'solid-js';
import { createChannelIdentityWriter } from './queries/channel-identity';
import {
  ChannelIdentityCard,
  ChannelIdentityModal,
} from './views/channel-identity-editor';

type ChannelIdentityProps = {
  channelId: string;
  name: string;
  canEdit: boolean;
  disabled?: boolean;
};

function ChannelIdentitySession(
  props: ChannelIdentityProps & {
    onClose: () => void;
    dialog?: boolean;
  }
) {
  const picture = useChannelPicture(() => props.channelId);
  const fileName = useChannelPictureFileName(picture.pictureId);
  const writer = createChannelIdentityWriter({
    channelId: props.channelId,
    name: props.name,
    upload: createStaticFile,
  });
  const editorProps = {
    get name() {
      return props.name;
    },
    get pictureUrl() {
      return picture.largeUrl();
    },
    get channelId() {
      return props.channelId;
    },
    get fileName() {
      return fileName();
    },
    get pictureLoading() {
      return picture.isLoading();
    },
    get canEdit() {
      return props.canEdit;
    },
    writer,
    onClose: props.onClose,
  };

  return (
    <Show
      when={props.dialog}
      fallback={<ChannelIdentityCard {...editorProps} />}
    >
      <ChannelIdentityModal {...editorProps} />
    </Show>
  );
}

export function ChannelTitleHoverCard(
  props: ParentProps<ChannelIdentityProps>
) {
  const [open, setOpen] = createSignal(false);

  return (
    <HoverCard
      placement="bottom-start"
      triggerClass="min-w-0"
      contentClass="w-88 p-4"
      open={open()}
      onOpenChange={setOpen}
      keepOpenOnTriggerPress
      // Draft editors must not be replaced by unrelated rich previews.
      chokeGroup={false}
      disabled={props.disabled}
      triggerTabIndex={0}
      triggerAriaLabel={
        props.canEdit ? 'Edit channel details' : 'Channel details'
      }
      content={
        <Suspense>
          <Show when={open() ? props.channelId : undefined} keyed>
            {(channelId) => (
              <ChannelIdentitySession
                {...props}
                channelId={channelId}
                onClose={() => setOpen(false)}
              />
            )}
          </Show>
        </Suspense>
      }
    >
      {props.children}
    </HoverCard>
  );
}

/** Inline headers have no split-title drawer, so their touch title opens the editor. */
export function ChannelIdentityTitle(props: ParentProps<ChannelIdentityProps>) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <Show
        when={isTouchDevice()}
        fallback={<ChannelTitleHoverCard {...props} />}
      >
        <Show when={props.canEdit && !props.disabled} fallback={props.children}>
          <Button
            variant="ghost"
            size="sm"
            class="min-w-0 px-0"
            onClick={() => setOpen(true)}
          >
            {props.children}
          </Button>
        </Show>
      </Show>
      <ChannelIdentityDialog
        {...props}
        open={open()}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function ChannelIdentityDialog(
  props: ChannelIdentityProps & {
    open: boolean;
    onClose: () => void;
  }
) {
  return (
    <Suspense>
      <Show when={props.open ? props.channelId : undefined} keyed>
        {(channelId) => (
          <ChannelIdentitySession {...props} channelId={channelId} dialog />
        )}
      </Show>
    </Suspense>
  );
}
