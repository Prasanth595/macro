import { Button } from '@ui/components/Button';
import {
  type ManagedDialogProps,
  useImperativeDialog,
} from '@ui/components/ImperativeDialog';
import {
  type Accessor,
  lazy,
  type ParentProps,
  Show,
  Suspense,
} from 'solid-js';

const ChannelIdentitySession = lazy(() => import('./channel-identity-session'));

export type ChannelIdentityProps = {
  channelId: string;
  name: string;
  canEdit: boolean;
  disabled?: boolean;
};

function ChannelIdentityDialog(
  props: ChannelIdentityProps & ManagedDialogProps
) {
  return (
    <Suspense>
      <Show when={props.channelId} keyed>
        {(channelId) => (
          <ChannelIdentitySession {...props} channelId={channelId} />
        )}
      </Show>
    </Suspense>
  );
}

export function useChannelIdentityDialog(
  source: Accessor<ChannelIdentityProps>
) {
  const dialog = useImperativeDialog(ChannelIdentityDialog);

  return () => {
    const props = source();
    if (!props.canEdit || props.disabled || dialog.isOpen()) return;
    dialog.open(source);
  };
}

export function ChannelIdentityTitle(
  props: ParentProps<{
    canEdit: boolean;
    disabled?: boolean;
    onEdit: () => void;
  }>
) {
  return (
    <Show when={props.canEdit && !props.disabled} fallback={props.children}>
      <Button
        variant="ghost"
        size="sm"
        class="min-w-0 px-0"
        label="Edit channel details"
        onClick={props.onEdit}
      >
        {props.children}
      </Button>
    </Show>
  );
}
