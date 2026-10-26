import { fireAndForget } from '@core/util/fireAndForget';
import { Button, Dialog, Input, Panel, Tabs } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { FileTypeSelect } from '../components/file-type-select';
import type { FileTypesSource } from '../context/file-types';
import type { CrmRecordTarget } from '../core/record';
import { createFileAttachment } from '../primitives/file-attachment';

export function AttachFileDialog(props: {
  source: FileTypesSource;
  record: CrmRecordTarget;
  onClose(): void;
  onOpenCreated(id: string): void;
}) {
  const [mode, setMode] = createSignal<'attach' | 'create'>('attach');
  const [name, setName] = createSignal('');
  const [selected, setSelected] = createSignal<string>();
  const [visibleCount, setVisibleCount] = createSignal(50);
  const [typeId, setTypeId] = createSignal<string | null>(null);
  const candidates = props.source.candidates(name);
  const editor = createFileAttachment(props.source, props.record);
  const editable = props.source.canEdit(() => selected() ?? '');
  const enabled = () =>
    mode() === 'create' ? !!name().trim() : !!selected() && editable();
  async function save() {
    if (!enabled()) return;
    const success = await editor.save({
      name: name().trim(),
      documentId: mode() === 'attach' ? selected() : undefined,
      typeId: typeId(),
    });
    if (success) props.onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !editor.pending() && props.onClose()}
      class="w-112 max-w-[calc(100vw-2rem)]"
    >
      <Panel>
        <Panel.Body>
          <div class="flex flex-col gap-4 p-5">
            <Dialog.Title class="text-base font-semibold">
              Add file
            </Dialog.Title>
            <Dialog.Description class="text-sm text-ink-muted">
              Link a file you can edit. Its access stays the same, and its type
              is shared across records.
            </Dialog.Description>
            <Show when={!editor.createdId()}>
              <Tabs<'attach' | 'create'>
                aria-label="Add file mode"
                disabled={editor.pending()}
                value={mode()}
                onChange={(value) => {
                  setMode(value);
                  setSelected(undefined);
                  setName('');
                }}
                options={[
                  { value: 'attach', label: 'Existing file' },
                  { value: 'create', label: 'New note' },
                ]}
              />
            </Show>
            <Input
              aria-label={mode() === 'create' ? 'File name' : 'Find a file'}
              placeholder={mode() === 'create' ? 'File name' : 'Find a file…'}
              value={name()}
              onInput={(event) => {
                setName(event.currentTarget.value);
                setSelected(undefined);
                setVisibleCount(50);
              }}
              disabled={editor.pending() || !!editor.createdId()}
            />
            <Show when={mode() === 'attach'}>
              <div class="max-h-60 overflow-auto" aria-label="Files to attach">
                <For each={candidates.files().slice(0, visibleCount())}>
                  {(file) => (
                    <Button
                      variant="ghost"
                      fullWidth
                      aria-pressed={selected() === file.id}
                      disabled={editor.pending()}
                      onClick={() => setSelected(file.id)}
                    >
                      {file.name}
                    </Button>
                  )}
                </For>
                <Show when={candidates.error()}>
                  <p role="alert" class="p-3 text-sm text-failure">
                    Couldn’t load files.
                  </p>
                </Show>
                <Show
                  when={
                    candidates.files().length > visibleCount() ||
                    candidates.hasMore()
                  }
                >
                  <Button
                    variant="ghost"
                    disabled={editor.pending() || candidates.pending()}
                    onClick={() => {
                      if (candidates.files().length > visibleCount())
                        setVisibleCount((count) => count + 50);
                      else fireAndForget(candidates.loadMore(), 'crm-files');
                    }}
                  >
                    More files
                  </Button>
                </Show>
                <Show when={candidates.files().length === 0}>
                  <p class="p-3 text-sm text-ink-muted">
                    {candidates.pending()
                      ? 'Loading files…'
                      : 'No matching files.'}
                  </p>
                </Show>
              </div>
              <Show when={selected() && !editable()}>
                <p class="text-sm text-ink-muted">
                  Edit access to the source file is required.
                </p>
              </Show>
            </Show>
            <FileTypeSelect
              options={props.source.data()?.options ?? []}
              value={typeId()}
              onChange={setTypeId}
              emptyLabel={
                mode() === 'attach' ? 'Keep current type' : 'Unclassified'
              }
              disabled={editor.pending()}
            />
            <Show when={editor.error()}>
              <p role="alert" class="text-sm text-failure">
                {editor.error()}
              </p>
            </Show>
            <Show when={editor.createdId()}>
              {(id) => (
                <Button
                  variant="ghost"
                  onClick={() => props.onOpenCreated(id())}
                >
                  Open created file
                </Button>
              )}
            </Show>
            <div class="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={editor.pending()}
                onClick={props.onClose}
              >
                Cancel
              </Button>
              <Button
                disabled={editor.pending() || !enabled()}
                onClick={() => fireAndForget(save(), 'crm-files')}
              >
                {editor.pending()
                  ? 'Saving…'
                  : editor.createdId()
                    ? 'Retry'
                    : mode() === 'create'
                      ? 'Create and attach'
                      : 'Attach file'}
              </Button>
            </div>
          </div>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}
