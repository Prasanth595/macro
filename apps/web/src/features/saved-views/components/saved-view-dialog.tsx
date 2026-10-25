import { Button, Checkbox, Dialog, Input, type ManagedDialogProps } from '@ui';
import { createSignal, type JSX, Show } from 'solid-js';
import { match } from 'ts-pattern';

export type SavedViewDialogProps = ManagedDialogProps & {
  name: string;
  sharedTeamId: string | null;
  team?: { id: string; name: string };
  mode: 'create' | 'duplicate' | 'rename' | 'share';
  summary: JSX.Element;
  pending: boolean;
  error?: string;
  onSave: (name: string, sharedTeamId: string | null) => void;
};

export function SavedViewDialog(props: SavedViewDialogProps) {
  const [name, setName] = createSignal(props.name);
  const [shared, setShared] = createSignal(Boolean(props.sharedTeamId));
  const labels = () =>
    match(props.mode)
      .with('create', () => ({ title: 'Save view', submit: 'Save view' }))
      .with('duplicate', () => ({
        title: 'Duplicate saved view',
        submit: 'Duplicate',
      }))
      .with('rename', () => ({ title: 'Rename saved view', submit: 'Rename' }))
      .with('share', () => ({
        title: 'Share saved view',
        submit: 'Save sharing',
      }))
      .exhaustive();
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
            shared() ? (props.team?.id ?? props.sharedTeamId) : null
          );
        }}
      >
        <Dialog.Title class="text-lg font-medium">
          {labels().title}
        </Dialog.Title>
        <Show when={props.mode !== 'share'}>
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
        </Show>
        <Show when={props.mode === 'create' || props.mode === 'duplicate'}>
          <div class="flex flex-col gap-2 text-xs text-ink-muted">
            {props.summary}
          </div>
        </Show>
        <Show
          when={props.mode !== 'rename' && (props.team || props.sharedTeamId)}
        >
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
            onClick={() => props.onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="strong"
            disabled={props.pending || !name().trim()}
          >
            {props.pending ? 'Saving…' : labels().submit}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
