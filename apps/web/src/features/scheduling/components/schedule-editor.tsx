import ArrowLeft from '@phosphor/arrow-left.svg';
import { Button } from '@ui';
import { type JSX, Show } from 'solid-js';
import type { AvailabilitySchedule } from '../core/types';
import { TextInput } from './fields';

export function ScheduleEditorForm(props: {
  schedule: AvailabilitySchedule;
  saving: boolean;
  editingRange: boolean;
  error: string;
  topBarOwned?: boolean;
  creating?: boolean;
  children: JSX.Element;
  onNameChange: (name: string) => void;
  onSubmit: (event: SubmitEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form class="flex min-h-0 flex-1 flex-col gap-4" onSubmit={props.onSubmit}>
      <header class="flex w-full shrink-0 flex-wrap items-center gap-3 py-3">
        <Show when={!props.topBarOwned}>
          <Button
            variant="ghost"
            size="icon-md"
            label="Back to availability"
            disabled={props.saving}
            onClick={props.onCancel}
          >
            <ArrowLeft class="size-5" />
          </Button>
          <h1 class="text-lg font-semibold">
            {props.creating ? 'Create schedule' : 'Edit schedule'}
          </h1>
        </Show>
        <TextInput
          aria-label="Schedule name"
          required
          maxLength={100}
          value={props.schedule.name}
          disabled={props.saving}
          class="h-10 min-w-0 flex-1 border-transparent bg-transparent px-2 text-xl font-semibold focus-visible:border-edge"
          onInput={(event) => props.onNameChange(event.currentTarget.value)}
        />
      </header>
      <Show when={props.error}>
        <p role="alert" class="text-sm text-failure">
          {props.error}
        </p>
      </Show>
      {props.children}
      <footer class="flex shrink-0 items-center justify-end gap-3 border-t border-edge-muted bg-panel py-3">
        <Button
          variant="ghost"
          disabled={props.saving}
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button
          data-save-schedule
          type="submit"
          variant="cta"
          disabled={props.saving || props.editingRange}
        >
          {props.saving ? 'Saving…' : 'Save schedule'}
        </Button>
      </footer>
    </form>
  );
}
