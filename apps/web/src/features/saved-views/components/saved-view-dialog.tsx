import { Button, Checkbox, Dialog, Input } from '@ui';
import { createSignal, type JSX, Show } from 'solid-js';

export function SavedViewDialog(props: {
  name: string;
  sharedTeamId: string | null;
  team?: { id: string; name: string };
  title: string;
  summary: JSX.Element;
  pending: boolean;
  error?: string;
  onSave: (name: string, sharedTeamId: string | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = createSignal(props.name);
  const [shared, setShared] = createSignal(Boolean(props.sharedTeamId));
  return (
    <Dialog
      open
      position="center"
      class="w-110"
      onOpenChange={(open) => {
        if (!open && !props.pending) props.onClose();
      }}
    >
      <form
        class="flex flex-col gap-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave(
            name().trim(),
            shared() ? (props.team?.id ?? props.sharedTeamId) : null
          );
        }}
      >
        <Dialog.Title class="text-lg font-medium">{props.title}</Dialog.Title>
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
        <Show when={props.team || props.sharedTeamId}>
          <div class="flex flex-col gap-2">
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
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="strong"
            disabled={props.pending || !name().trim()}
          >
            {props.pending ? 'Saving…' : 'Save view'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
