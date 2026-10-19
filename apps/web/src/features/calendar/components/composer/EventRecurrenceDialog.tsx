import { Button, Dialog, Panel } from '@ui';
import { createSignal, Show } from 'solid-js';
import {
  defaultCustomConfig,
  isValidRecurrenceConfig,
  type RecurrenceConfig,
  recurrencePresetsFor,
} from '../../utils/recurrence';
import { RecurrenceBuilder } from './RecurrenceBuilder';

interface EventRecurrenceDialogProps {
  open: boolean;
  choice: string;
  config: RecurrenceConfig;
  start: Date;
  allDay: boolean;
  onClose: () => void;
  onDone: (config: RecurrenceConfig) => void;
}

/** Edits a recurrence without touching the controller until Done. */
export function EventRecurrenceDialog(props: EventRecurrenceDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      position="center"
      class="w-150"
    >
      <Show when={props.open}>
        <RecurrenceDialogContent {...props} />
      </Show>
    </Dialog>
  );
}

function RecurrenceDialogContent(props: EventRecurrenceDialogProps) {
  const [draft, setDraft] = createSignal<RecurrenceConfig>(
    props.choice === 'custom'
      ? props.config
      : (recurrencePresetsFor(props.start).find(
          (preset) => preset.id === props.choice
        )?.config ?? defaultCustomConfig(props.start))
  );

  return (
    <Panel depth={2} class="rounded-xl text-ink">
      <Panel.Header class="px-5">
        <Dialog.Title class="text-sm font-semibold">
          Custom recurrence
        </Dialog.Title>
      </Panel.Header>
      <Panel.Body class="flex flex-col gap-4 p-5">
        <RecurrenceBuilder
          value={draft()}
          start={props.start}
          allDay={props.allDay}
          onChange={setDraft}
        />
        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="cta"
            disabled={!isValidRecurrenceConfig(draft())}
            onClick={() => props.onDone(draft())}
          >
            Done
          </Button>
        </div>
      </Panel.Body>
    </Panel>
  );
}
