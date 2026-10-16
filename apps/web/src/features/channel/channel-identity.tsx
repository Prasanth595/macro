import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { Button } from '@ui/components/Button';
import { HoverCard } from '@ui/components/HoverCard';
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

export function ChannelTitleHoverCard(
  props: ParentProps<ChannelIdentityProps & ChannelIdentityOpenProps>
) {
  const [localOpen, setLocalOpen] = createSignal(false);
  const open = () => props.open ?? localOpen();
  const setOpen = (value: boolean) => {
    setLocalOpen(value);
    props.onOpenChange?.(value);
  };

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
        <Suspense
          fallback={
            <span class="text-sm text-ink-muted">Loading channel details…</span>
          }
        >
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
      <Show
        when={isTouchDevice()}
        fallback={
          <ChannelTitleHoverCard
            {...props}
            open={open()}
            onOpenChange={setOpen}
          />
        }
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
        open={isTouchDevice() && open()}
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
