import { fireAndForget } from '@core/util/fireAndForget';
import { catchToResult } from '@core/util/result';
import type { EntityData } from '@entity';
import { Button } from '@ui';
import { createMemo, createSignal, Show } from 'solid-js';
import { FileTypeSelect } from '../components/file-type-select';
import { RecordSection } from '../components/record-section';
import { useCrmContext } from '../context/crm-context';
import type { FileTypesSource } from '../context/file-types';
import { groupFilesByType } from '../core/file-types';
import type { CrmRecordScope } from '../core/record';
import { AttachFileDialog } from './attach-file-dialog';
import { ManageFileTypes } from './manage-file-types';
import { RecordItemList } from './record-item-list';

/** Both surfaces read classification from the file, never from its record link. */
export function RecordFiles(props: {
  scope?: CrmRecordScope;
  overview?: boolean;
}) {
  const context = useCrmContext();
  const files = context.createRecordFiles(() => props.scope);
  const types = context.createFileTypes();
  const navigation = context.createNavigation();
  const ids = createMemo(() =>
    files.isPending || files.isError
      ? []
      : (files.data?.entities.map((entity) => entity.id) ?? [])
  );
  const classifications = types.classifications(ids);
  const [search, setSearch] = createSignal('');
  const [dialog, setDialog] = createSignal<'attach' | 'manage'>();
  const [setupPending, setSetupPending] = createSignal(false);
  const [error, setError] = createSignal('');
  async function setup() {
    if (setupPending()) return;
    setSetupPending(true);
    setError('');
    const result = await catchToResult(() => types.initialize());
    if (result.isErr())
      setError(
        'Could not set up file types. The team’s File type property must be single-select.'
      );
    setSetupPending(false);
  }
  const actions = () => (
    <Show when={types.canManage()}>
      <Show
        when={types.data()}
        fallback={
          <Button
            variant="outline"
            disabled={types.pending() || setupPending()}
            onClick={() => fireAndForget(setup(), 'crm-files')}
          >
            Set up file types
          </Button>
        }
      >
        <Button variant="ghost" onClick={() => setDialog('manage')}>
          Manage types
        </Button>
        <Button
          variant="outline"
          disabled={!props.scope}
          onClick={() => setDialog('attach')}
        >
          Add file
        </Button>
      </Show>
    </Show>
  );
  const list = () => (
    <>
      <Show when={error()}>
        <p role="alert" class="p-3 text-sm text-failure">
          {error()}
        </p>
      </Show>
      <Show when={types.error() || classifications.error()}>
        <div class="flex items-center gap-2 p-3 text-sm text-ink-muted">
          <span>Couldn’t refresh file types.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              fireAndForget(
                Promise.all([types.refresh(), classifications.refresh()]),
                'crm-files'
              )
            }
          >
            Retry
          </Button>
        </div>
      </Show>
      <Show when={types.pending() || classifications.pending()}>
        <p class="px-3 py-2 text-xs text-ink-muted">Loading file types…</p>
      </Show>
      <RecordItemList
        source={files}
        pending={!props.scope}
        search={search()}
        empty={`No files with this ${props.scope?.type ?? 'record'} yet.`}
        groupItems={(items) =>
          groupFilesByType(
            items,
            types.data()?.options ?? [],
            classifications.data() ?? new Map()
          )
        }
        rowActions={(entity) => (
          <FileTypeEditor
            entity={entity}
            source={types}
            value={classifications.data()?.get(entity.id)}
          />
        )}
      />
    </>
  );
  return (
    <>
      <Show
        when={props.overview}
        fallback={
          <RecordSection
            title="Files"
            search={search()}
            onSearchChange={setSearch}
            actions={actions()}
          >
            {list()}
          </RecordSection>
        }
      >
        <section aria-label="Files" class="min-w-0">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-medium">Files</h2>
            <div class="flex flex-wrap items-center gap-2">{actions()}</div>
          </div>
          {list()}
        </section>
      </Show>
      <Show when={dialog() === 'manage'}>
        <ManageFileTypes source={types} onClose={() => setDialog(undefined)} />
      </Show>
      <Show when={dialog() === 'attach' && props.scope} keyed>
        {(scope) => (
          <AttachFileDialog
            source={types}
            record={scope}
            onClose={() => setDialog(undefined)}
            onOpenCreated={(id) => navigation.openWithSplit({ type: 'md', id })}
          />
        )}
      </Show>
    </>
  );
}

function FileTypeEditor(props: {
  entity: EntityData;
  source: FileTypesSource;
  value: string | null | undefined;
}) {
  const editable = props.source.canEdit(() => props.entity.id);
  const value = () =>
    props.value === null ||
    props.source.data()?.options.some((option) => option.id === props.value)
      ? props.value
      : undefined;
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal(false);
  async function save(value: string | null) {
    if (pending() || !editable()) return;
    setPending(true);
    setError(false);
    const result = await catchToResult(() =>
      props.source.classify(props.entity.id, value)
    );
    setError(result.isErr());
    setPending(false);
  }
  return (
    <Show when={props.source.data()}>
      <FileTypeSelect
        options={props.source.data()?.options ?? []}
        value={value() ?? null}
        emptyLabel={value() === undefined ? 'Type unavailable' : undefined}
        disabled={!editable() || pending() || value() === undefined}
        label={`File type for ${props.entity.name}`}
        onChange={(value) => fireAndForget(save(value), 'crm-files')}
      />
      <Show when={error()}>
        <p role="alert" class="text-xs text-failure">
          Type wasn’t saved. Retry.
        </p>
      </Show>
    </Show>
  );
}
