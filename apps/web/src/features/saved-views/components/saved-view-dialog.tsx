import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Input,
  type ManagedDialogProps,
} from '@ui';
import { createSignal, type JSX, Show } from 'solid-js';

export type DialogStatus = ManagedDialogProps & {
  pending: boolean;
  error?: string;
};

export function SavedViewCreateDialog(
  props: DialogStatus & {
    name: string;
    title?: string;
    submitLabel?: string;
    summary: JSX.Element;
    team?: { id: string; name: string };
    onSave: (name: string, team: string | null) => void;
  }
) {
  const [name, setName] = createSignal(props.name);
  const [shared, setShared] = createSignal(false);
  return (
    <Dialog
      open={props.open}
      position="center"
      class="w-110"
      onOpenChange={(open) => {
        if (!props.pending) props.onOpenChange(open);
      }}
    >
      <form
        class="flex flex-col gap-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave(
            name().trim(),
            shared() ? (props.team?.id ?? null) : null
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
        <div class="flex flex-col gap-2 text-xs text-ink-muted">
          {props.summary}
        </div>
        <Show when={props.team}>
          <div class="flex flex-col gap-2">
            <Checkbox
              checked={shared()}
              onChange={setShared}
              disabled={props.pending}
            >
              <Checkbox.Control />
              <Checkbox.Label>Share with {props.team?.name}</Checkbox.Label>
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
    </Dialog>
  );
}

export function SavedViewRenameDialog(
  props: DialogStatus & {
    name: string;
    onSave: (name: string) => void;
  }
) {
  const [name, setName] = createSignal(props.name);
  return (
    <Dialog
      open={props.open}
      position="center"
      class="w-110"
      onOpenChange={(open) => {
        if (!props.pending) props.onOpenChange(open);
      }}
    >
      <form
        class="flex flex-col gap-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave(name().trim());
        }}
      >
        <Dialog.Title class="text-lg font-medium">
          Rename saved view
        </Dialog.Title>
        <label class="flex flex-col gap-2 text-sm">
          Name
          <Input
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            maxLength={120}
            required
            disabled={props.pending}
          />
        </label>
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
            {props.pending ? 'Saving…' : 'Rename'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function SavedViewShareDialog(
  props: DialogStatus & {
    sharedTeamId: string | null;
    team?: { id: string; name: string };
    onSave: (team: string | null) => void;
  }
) {
  const [shared, setShared] = createSignal(Boolean(props.sharedTeamId));
  return (
    <Dialog
      open={props.open}
      position="center"
      class="w-110"
      onOpenChange={(open) => {
        if (!props.pending) props.onOpenChange(open);
      }}
    >
      <form
        class="flex flex-col gap-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave(
            shared() ? (props.team?.id ?? props.sharedTeamId) : null
          );
        }}
      >
        <Dialog.Title class="text-lg font-medium">
          Share saved view
        </Dialog.Title>
        <Checkbox
          checked={shared()}
          onChange={setShared}
          disabled={props.pending || (!props.team && !props.sharedTeamId)}
        >
          <Checkbox.Control />
          <Checkbox.Label>
            Share with {props.team?.name ?? 'team'}
          </Checkbox.Label>
        </Checkbox>
        <p class="text-xs text-ink-muted">
          Teammates can use these filters on items they can already access. Only
          you can edit this view.
        </p>
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
          <Button type="submit" variant="strong" disabled={props.pending}>
            {props.pending ? 'Saving…' : 'Save sharing'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function SavedViewDeleteDialog(
  props: DialogStatus & { onDelete: () => void }
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
