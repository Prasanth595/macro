import X from '@phosphor/x.svg';
import { Button, Dialog } from '@ui';
import { ActionDialogShell } from '@ui/components/ActionDialogShell';
import { createSignal, Show } from 'solid-js';
import { EventReview } from '../components/event-review';
import type {
  AvailabilitySchedule,
  EventType,
  SchedulingMember,
} from '../core/types';

type EventDetailsDialogProps = {
  event: EventType;
  link: string;
  schedule?: AvailabilitySchedule;
  members: SchedulingMember[];
  team: boolean;
  saving: boolean;
  opener?: HTMLElement;
  onCopyLink: () => Promise<void>;
  onClose: () => void;
  onEdit?: (event: EventType, opener?: HTMLElement) => void;
};

export function EventDetailsDialog(props: EventDetailsDialogProps) {
  const [open, setOpen] = createSignal(true);
  const active = () => props.event.enabled && !props.event.requiresConfirmation;
  let editing: EventType | undefined;
  const close = () => {
    if (!open()) return;
    setOpen(false);
    props.onClose();
  };
  const edit = () => {
    if (!props.onEdit || props.saving) return;
    editing = props.event;
    close();
  };

  return (
    <Dialog
      open={open()}
      onOpenChange={(next) => !next && close()}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const next = editing;
        editing = undefined;
        // The details trap releases focus before the editor opens or the opener regains focus.
        queueMicrotask(() => {
          if (next) props.onEdit?.(next, props.opener);
          else if (props.opener?.isConnected)
            props.opener.focus({ preventScroll: true });
        });
      }}
      position="center"
      animate
      class="w-full max-w-[min(42rem,calc(100vw-16px))] overflow-hidden"
    >
      <ActionDialogShell class="max-h-[calc(100dvh-16px)]">
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-edge-divider px-5 py-4">
          <Dialog.Title class="text-lg font-semibold">
            Booking link details
          </Dialog.Title>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            label="Close booking link details"
            tooltipDisabled
            onClick={close}
          >
            <X class="size-4" aria-hidden="true" />
          </Button>
        </div>
        <ActionDialogShell.Body class="min-h-0 overflow-y-auto">
          <EventReview
            draft={props.event}
            link={props.link}
            schedule={props.schedule}
            members={props.members}
            team={props.team}
            active={active()}
            saving={props.saving}
            onCopyLink={active() ? props.onCopyLink : undefined}
          />
        </ActionDialogShell.Body>
        <Show when={props.onEdit}>
          <ActionDialogShell.Footer>
            <Button
              type="button"
              variant="strong"
              depth={2}
              disabled={props.saving}
              onClick={edit}
            >
              Edit booking link
            </Button>
          </ActionDialogShell.Footer>
        </Show>
      </ActionDialogShell>
    </Dialog>
  );
}
