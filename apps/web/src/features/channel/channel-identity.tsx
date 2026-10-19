import { Button } from '@ui/components/Button';
import { createSignal, lazy, type ParentProps, Show, Suspense } from 'solid-js';

const ChannelIdentitySession = lazy(() => import('./channel-identity-session'));

export type ChannelIdentityProps = {
  channelId: string;
  name: string;
  canEdit: boolean;
  disabled?: boolean;
};

type ChannelIdentityOpenProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ChannelIdentityTitle(
  props: ParentProps<ChannelIdentityProps & ChannelIdentityOpenProps>
) {
  const [localOpen, setLocalOpen] = createSignal(false);
  const open = () => props.open ?? localOpen();
  const setOpen = (value: boolean) => {
    setLocalOpen(value);
    props.onOpenChange?.(value);
  };

  return (
    <>
      <Show when={props.canEdit && !props.disabled} fallback={props.children}>
        <Button
          variant="ghost"
          size="sm"
          class="min-w-0 px-0"
          label="Edit channel details"
          onClick={() => setOpen(true)}
        >
          {props.children}
        </Button>
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
          <ChannelIdentitySession {...props} channelId={channelId} />
        )}
      </Show>
    </Suspense>
  );
}
