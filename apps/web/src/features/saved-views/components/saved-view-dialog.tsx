import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Input,
  type ManagedDialogProps,
} from '@ui';
import { createSignal, type JSX, Show } from 'solid-js';

type FormStatus = Pick<ManagedDialogProps, 'onOpenChange'> & {
  pending: boolean;
  error?: string;
};

export function SavedViewForm(
  props: FormStatus & {
    name: string;
    sharedTeamId?: string | null;
    title?: string;
    submitLabel?: string;
    summary?: JSX.Element;
    team?: { id: string; name: string };
    onSave: (name: string, team: string | null) => void;
  }
) {
  const [name, setName] = createSignal(props.name);
  const [shared, setShared] = createSignal(Boolean(props.sharedTeamId));
  return (
    <form
      class="flex flex-col gap-5 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave(
          name().trim(),
          shared() ? (props.sharedTeamId ?? props.team?.id ?? null) : null
        );
      }}
    >
      <Dialog.Title class="text-lg font-medium">
        {props.title ?? 'Save view'}
      </Dialog.Title>
      <label class="flex flex-col gap-2 text-sm">
        Name
        <Input
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          maxLength={120}
          required
          disabled={props.pending}
          placeholder="e.g. Needs review"
        />
      </label>
      <Show when={props.summary}>
        <div class="flex flex-col gap-2 text-xs text-ink-muted">
          {props.summary}
        </div>
      </Show>
      <Show when={props.team || props.sharedTeamId}>
        <div class="flex flex-col gap-2">
          <Checkbox
            checked={shared()}
            onChange={setShared}
            disabled={props.pending}
          >
            <Checkbox.Control />
            <Checkbox.Label>
              Share with{' '}
              {props.sharedTeamId && props.sharedTeamId !== props.team?.id
                ? 'team'
                : props.team?.name}
            </Checkbox.Label>
          </Checkbox>
          <p class="text-xs text-ink-muted">
            Teammates can use these filters on items they can already access.
            Only you can edit this view.
          </p>
        </div>
      </Show>
      <Show when={props.error}>
        <p role="alert" class="text-sm text-failure-ink">
          {props.error}
        </p>
      </Show>
      <div class="flex justify-end gap-2">
        <Button
          variant="ghost"
          disabled={props.pending}
          onClick={() => props.onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="strong"
          disabled={props.pending || !name().trim()}
        >
          {props.pending ? 'Saving…' : (props.submitLabel ?? 'Save view')}
        </Button>
      </div>
    </form>
  );
}

export function DeleteSavedViewConfirmation(
  props: ManagedDialogProps & FormStatus & { onDelete: () => void }
) {
  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={(open) => {
        if (!props.pending) props.onOpenChange(open);
      }}
      title="Delete saved view?"
      body={
        <>
          <p>
            This removes the view for you and anyone it is shared with. Items
            are not deleted.
          </p>
          <Show when={props.error}>
            <p role="alert">{props.error}</p>
          </Show>
        </>
      }
      confirmLabel="Delete view"
      tone="danger"
      pending={props.pending}
      onConfirm={props.onDelete}
    />
  );
}
