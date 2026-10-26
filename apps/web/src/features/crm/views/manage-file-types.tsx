import { fireAndForget } from '@core/util/fireAndForget';
import { catchToResult } from '@core/util/result';
import { Button, Dialog, Input, Panel } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import type { FileTypesSource } from '../context/file-types';
import type { FileTypeOption } from '../core/file-types';

export function ManageFileTypes(props: {
  source: FileTypesSource;
  onClose(): void;
}) {
  const [name, setName] = createSignal('');
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal('');
  async function run(action: () => Promise<void>) {
    if (pending()) return;
    setPending(true);
    setError('');
    const result = await catchToResult(action);
    if (result.isErr())
      setError(
        'Could not save file types. Names must be unique. Please retry.'
      );
    setPending(false);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending() && props.onClose()}
      class="w-112 max-w-[calc(100vw-2rem)]"
    >
      <Panel>
        <Panel.Body>
          <div class="flex flex-col gap-4 p-5">
            <Dialog.Title class="text-base font-semibold">
              File types
            </Dialog.Title>
            <Dialog.Description class="text-sm text-ink-muted">
              Team members can manage these types. Renaming a type updates its
              label everywhere. Removing a type leaves its files unclassified.
            </Dialog.Description>
            <For each={props.source.data()?.options}>
              {(option) => (
                <FileTypeRow
                  option={option}
                  pending={pending()}
                  onRename={(name) =>
                    run(() => props.source.rename(option.id, name))
                  }
                  onRemove={() => run(() => props.source.remove(option.id))}
                />
              )}
            </For>
            <div class="flex items-center gap-2">
              <Input
                aria-label="New file type"
                placeholder="New file type"
                value={name()}
                onInput={(event) => setName(event.currentTarget.value)}
                disabled={pending()}
              />
              <Button
                variant="outline"
                disabled={pending() || !name().trim()}
                onClick={() =>
                  fireAndForget(
                    run(async () => {
                      await props.source.add(name().trim());
                      setName('');
                    }),
                    'crm-files'
                  )
                }
              >
                Add
              </Button>
            </div>
            <Show when={error()}>
              <p role="alert" class="text-sm text-failure">
                {error()}
              </p>
            </Show>
            <Button
              variant="outline"
              disabled={pending()}
              onClick={props.onClose}
            >
              Done
            </Button>
          </div>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}

function FileTypeRow(props: {
  option: FileTypeOption;
  pending: boolean;
  onRename(name: string): Promise<void>;
  onRemove(): Promise<void>;
}) {
  const [name, setName] = createSignal(props.option.name);
  const [confirm, setConfirm] = createSignal(false);
  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <Input
          aria-label={`Rename ${props.option.name}`}
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          disabled={props.pending}
        />
        <Button
          variant="ghost"
          disabled={
            props.pending ||
            !name().trim() ||
            name().trim() === props.option.name
          }
          onClick={() =>
            fireAndForget(props.onRename(name().trim()), 'crm-files')
          }
        >
          Save
        </Button>
        <Button
          variant="ghost"
          disabled={props.pending}
          onClick={() => setConfirm(true)}
        >
          Remove
        </Button>
      </div>
      <Show when={confirm()}>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span>Leave all {props.option.name} files unclassified?</span>
          <Button
            variant="outline"
            size="sm"
            disabled={props.pending}
            onClick={() => fireAndForget(props.onRemove(), 'crm-files')}
          >
            Remove type
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={props.pending}
            onClick={() => setConfirm(false)}
          >
            Cancel
          </Button>
        </div>
      </Show>
    </div>
  );
}
