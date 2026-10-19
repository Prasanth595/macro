import { usePreference } from '@app/preferences/use-preference';
import { StaticMarkdownContext } from '@core/component/LexicalMarkdown/component/core/StaticMarkdown';
import { getPermissions } from '@core/component/SharePermissions';
import { toast } from '@core/component/Toast/Toast';
import { ShareTrigger } from '@core/component/TopBar/ShareButton';
import { useShareModal } from '@core/component/TopBar/shareModal';
import PlusIcon from '@phosphor/plus.svg';
import { queryReadyGate } from '@queries/gate';
import { storageServiceClient } from '@service-storage/client';
import type { CardPosition } from '@service-storage/generated/schemas/cardPosition';
import type { DatabaseView } from '@service-storage/generated/schemas/databaseView';
import { useQueryClient } from '@tanstack/solid-query';
import { Button } from '@ui';
import {
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from 'solid-js';
import { match } from 'ts-pattern';
import {
  DatabaseMentionPicker,
  DatabaseMentionValue,
  DatabaseTextEditor,
  DatabaseTextValue,
} from '../block-database/database-mentions';
import { DatabaseToolbar } from '../database/components/database-toolbar';
import { DatabaseProvider, useDatabase } from '../database/context/database';
import type { CardMove } from '../database/core/board-moves';
import type { DatabaseCellValue } from '../database/core/database-view';
import type { ViewChange } from '../database/core/view-state';
import { allRecordsView, boardLayout } from '../database/core/views';
import {
  type DatabaseOpFailure,
  databaseOpMessage,
} from '../database/core/write-failure';
import type { BoardPositions } from '../database/views/database-board-view';
import { DatabaseRecords } from '../database/views/database-records';
import type { DatabaseRecordsActions } from '../database/views/database-records-view';
import { DealMention, DealScheduleCell } from './components/deal-card';
import { DealDialog } from './components/deal-dialog';
import type { Pipeline } from './core/pipeline';
import { createPipelineApi } from './queries/pipeline-data';
import {
  createPipelineViews,
  type PipelineViews,
  usePipelineTableQuery,
} from './queries/pipeline-views';
import { AddPipelineRecordDialog } from './views/add-pipeline-record';

/** Pipelines supply their own identity and owner to the existing share dialog. */
export function PipelineShare(props: {
  pipeline: Pipeline;
  onCopyLink(): void;
}) {
  const openShare = useShareModal(() => ({
    id: props.pipeline.id,
    blockAlias: 'pipeline',
    itemType: 'crm_pipeline',
    name: props.pipeline.name,
    owner: props.pipeline.userId,
    userPermissions: getPermissions(props.pipeline.grant),
    copyLink: props.onCopyLink,
  }));
  return (
    <ShareTrigger
      id={props.pipeline.id}
      blockType="pipeline"
      onClick={openShare}
      copyLink={props.onCopyLink}
    />
  );
}

/** The CRM adapter supplies authorized data to the reusable records UI. */
export function PipelineDatabaseEditor(props: {
  pipeline: Pipeline;
  actions?: JSX.Element;
  onOpenRecord?(record: {
    type: 'company' | 'contact' | 'deal';
    id: string;
    pipelineId?: string;
    name?: string;
  }): void;
}) {
  return (
    <div
      class="@container/database flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas-base text-ink"
      style={{ '--database-title-column-width': '18rem' }}
    >
      <Suspense
        fallback={
          <div class="p-4 text-sm text-ink-muted">Loading pipeline…</div>
        }
      >
        <Show when={props.pipeline.id} keyed>
          {(_id) => (
            <PipelineRecords
              pipeline={props.pipeline}
              actions={props.actions}
              onOpenRecord={props.onOpenRecord}
            />
          )}
        </Show>
      </Suspense>
    </div>
  );
}

const viewFailure = (failure: DatabaseOpFailure) =>
  toast.failure(databaseOpMessage(failure, 'this view'));

function PipelineRecords(props: {
  pipeline: Pipeline;
  actions?: JSX.Element;
  onOpenRecord?(record: {
    type: 'company' | 'contact' | 'deal';
    id: string;
    pipelineId?: string;
    name?: string;
  }): void;
}) {
  const deps = { storage: storageServiceClient, client: useQueryClient() };
  const tableQuery = usePipelineTableQuery(deps, props.pipeline);
  const views = createPipelineViews(deps, props.pipeline);
  const storedViews = () =>
    queryReadyGate(tableQuery) ? tableQuery.data.views : [];
  const [selectedViewId, setSelectedViewId] = usePreference<string | undefined>(
    `macro:pref:crm:pipeline-view:${props.pipeline.id}`,
    {
      default: undefined,
    }
  );
  const selectedView = () =>
    storedViews().find((view) => view.id === selectedViewId());
  // All records is this viewer's own, like a database's.
  const [allRecords, setAllRecords] = createSignal<DatabaseView>(
    allRecordsView({
      id: props.pipeline.tableId,
      database_id: props.pipeline.databaseId,
    })
  );
  const view = () => {
    const current = selectedView() ?? allRecords();
    if (props.pipeline.recordType !== 'deal' || current.layout.kind !== 'board')
      return current;
    return { ...current, layout: { ...current.layout, cardFields: [] } };
  };
  const changeView = (change: ViewChange) => {
    const stored = selectedView();
    if (stored) void views.update(stored, change).mapErr(viewFailure);
    else setAllRecords((current) => ({ ...current, ...change }));
  };
  // No read of stored card places exists for pipelines; moves keep theirs here.
  const [positions, setPositions] = createSignal<
    Record<string, CardPosition[]>
  >({});
  const boardPositions: BoardPositions = {
    state: () => ({
      kind: 'ready',
      positions: positions()[view().id] ?? [],
    }),
    setPositions: (change) =>
      setPositions((current) => ({
        ...current,
        [view().id]: change(current[view().id] ?? []),
      })),
    // The server moves cards only on stored boards.
    get move() {
      const stored = selectedView();
      return stored
        ? (move: CardMove) => views.moveCard(stored, move)
        : undefined;
    },
  };
  const canEdit = () =>
    props.pipeline.grant === 'owner' || props.pipeline.grant === 'edit';
  const api = createPipelineApi(storageServiceClient, props.pipeline);
  const [composing, setComposing] =
    createSignal<Record<string, DatabaseCellValue>>();
  return (
    <StaticMarkdownContext>
      <DatabaseProvider
        api={api}
        tableId={props.pipeline.tableId}
        view={view()}
        capabilities={{ editRows: canEdit(), editColumns: canEdit() }}
      >
        <PipelineRefresh />
        <DatabaseRecords
          contentClass="mx-4 mb-4 mt-1 rounded-xl border border-edge-muted touch:m-0 touch:rounded-none touch:border-0"
          view={view()}
          stored={!!selectedView()}
          onViewChange={changeView}
          onClearConstraints={() =>
            changeView({ query: { ...view().query, filter: null } })
          }
          boardPositions={boardPositions}
          showCardDetails={props.pipeline.recordType !== 'deal'}
          hiddenColumnNames={
            props.pipeline.recordType === 'deal' && !selectedView()
              ? ['Next activity', 'Outcome']
              : undefined
          }
          renderColumnCell={(row, column) =>
            props.pipeline.recordType === 'deal' && column.name === 'When' ? (
              <DealScheduleCell
                row={row}
                primaryColumnId={props.pipeline.primaryColumnId}
              />
            ) : undefined
          }
          onComposeRecord={setComposing}
          renderTextEditor={(editor) => <DatabaseTextEditor {...editor} />}
          renderTextValue={(value) => <DatabaseTextValue value={value} />}
          renderMentionPicker={(picker) => (
            <DatabaseMentionPicker {...picker} />
          )}
          renderMentionValue={(id, entityType) =>
            entityType === 'DEAL' ? (
              <DealMention
                id={id}
                compact={view().layout.kind === 'table'}
                primaryColumnId={props.pipeline.primaryColumnId}
                onOpen={(name) =>
                  props.onOpenRecord?.({
                    type: 'deal',
                    id,
                    name,
                    pipelineId: props.pipeline.id,
                  })
                }
                onOpenCompany={(companyId) =>
                  props.onOpenRecord?.({ type: 'company', id: companyId })
                }
              />
            ) : (
              <DatabaseMentionValue id={id} entityType={entityType} />
            )
          }
          onOpenTitleMention={(id, entityType) => {
            if (entityType === 'COMPANY')
              props.onOpenRecord?.({ type: 'company', id });
            else if (entityType === 'CONTACT')
              props.onOpenRecord?.({ type: 'contact', id });
            else if (entityType === 'DEAL')
              props.onOpenRecord?.({
                type: 'deal',
                id,
                pipelineId: props.pipeline.id,
              });
          }}
          renderToolbar={(actions) => (
            <PipelineToolbar
              views={views}
              storedViews={storedViews()}
              view={view()}
              selectedViewId={selectedView()?.id}
              canEdit={canEdit()}
              pipeline={props.pipeline}
              composing={composing()}
              onCompose={setComposing}
              onSelectView={setSelectedViewId}
              onChangeView={changeView}
              actions={actions}
              pipelineActions={props.actions}
            />
          )}
        />
      </DatabaseProvider>
    </StaticMarkdownContext>
  );
}

/** The database toolbar over a pipeline's one table: its views and record controls. */
function PipelineToolbar(props: {
  views: PipelineViews;
  storedViews: DatabaseView[];
  view: DatabaseView;
  selectedViewId: string | undefined;
  canEdit: boolean;
  pipeline: Pipeline;
  /** The new record's starting values while its form is open. */
  composing: Record<string, DatabaseCellValue> | undefined;
  onCompose: (values: Record<string, DatabaseCellValue> | undefined) => void;
  onSelectView: (id: string | undefined) => void;
  onChangeView: (change: ViewChange) => void;
  actions: DatabaseRecordsActions;
  pipelineActions?: JSX.Element;
}) {
  const database = useDatabase();
  const columns = () => database.data.rows.columns();
  const [dealOpen, setDealOpen] = createSignal(false);
  async function addDeal(deal: { id: string }) {
    const stage = columns().find((column) => column.name === 'Stage');
    const values: Record<string, string> = {
      [props.pipeline.primaryColumnId]: deal.id,
    };
    const stageLabel = stage?.options[0]?.label;
    if (stage && stageLabel) values[stage.id] = stageLabel;
    const saved = await database.data.rows.write(
      { kind: 'create', values },
      database.data.table()?.version,
      false
    );
    if (saved.isErr()) throw saved.error;
  }
  // A column added with a board shows once the table is read again.
  const refreshColumns = () => {
    database.data.rows.refresh('refresh');
  };
  return (
    <>
    <DatabaseToolbar
      columns={columns()}
      views={props.storedViews}
      view={props.view}
      selectedViewId={props.selectedViewId}
      canEdit={props.canEdit}
      onSelectView={props.onSelectView}
      onChangeView={props.onChangeView}
      onCreateView={(created) =>
        props.views.create(props.view, created, columns()).map((view) => {
          props.onSelectView(view.id);
          if (
            created.layout === 'board' &&
            created.groupBy.kind === 'new-status'
          )
            refreshColumns();
        })
      }
      onRenameView={(target, name) =>
        props.views.update(target, { name }).map(() => undefined)
      }
      onShowViewAs={(target, shown) =>
        match(shown)
          .with({ kind: 'table' }, () =>
            props.views
              .update(target, { layout: { kind: 'table', columns: [] } })
              .map(() => undefined)
          )
          .with({ kind: 'board', groupBy: { kind: 'column' } }, ({ groupBy }) =>
            props.views
              .update(target, {
                layout: boardLayout(groupBy.columnId, columns()),
              })
              .map(() => undefined)
          )
          .with({ kind: 'board', groupBy: { kind: 'new-status' } }, () =>
            props.views
              .showAsBoardWithStatusColumn(target, columns())
              .map(refreshColumns)
          )
          .exhaustive()
      }
      onDeleteView={(target) => {
        if (props.selectedViewId === target.id) props.onSelectView(undefined);
        return props.views.remove(target);
      }}
      actions={
        <>
          <Show when={props.canEdit && props.pipeline.recordType === 'deal'}>
            <Button variant="outline" onClick={() => setDealOpen(true)}>
              <PlusIcon class="size-4" />
              Add deal
            </Button>
          </Show>
          <Show when={props.canEdit && props.pipeline.recordType !== 'deal'}>
            <Button variant="outline" onClick={() => props.onCompose({})}>
              <PlusIcon class="size-4" />
              {props.pipeline.recordType === 'company'
                ? 'Add deal'
                : 'Add contact'}
            </Button>
          </Show>
          <Show
            when={
              props.canEdit &&
              props.pipeline.recordType !== 'deal' &&
              props.composing
            }
            keyed
          >
            {(initialValues) => (
              <AddPipelineRecordDialog
                pipeline={props.pipeline}
                columns={columns()}
                initialValues={initialValues}
                onCreate={props.actions.createRow}
                onClose={() => props.onCompose(undefined)}
                renderTextEditor={(editor) => (
                  <DatabaseTextEditor {...editor} />
                )}
                renderTextValue={(value) => <DatabaseTextValue value={value} />}
                renderMentionPicker={(picker) => (
                  <DatabaseMentionPicker {...picker} />
                )}
                renderMentionValue={(id, entityType) => (
                  <DatabaseMentionValue id={id} entityType={entityType} />
                )}
              />
            )}
          </Show>
          {props.pipelineActions}
        </>
      }
    />
    <Show when={dealOpen()}>
      <DealDialog onClose={() => setDealOpen(false)} onCreate={addDeal} />
    </Show>
    </>
  );
}

/** CRM owns the polling subscription; the shared source owns invalidation. */
function PipelineRefresh() {
  const database = useDatabase();
  onMount(() => {
    const timer = setInterval(() => {
      database.data.rows.refresh('refresh');
    }, 5000);
    onCleanup(() => clearInterval(timer));
  });
  return null;
}
