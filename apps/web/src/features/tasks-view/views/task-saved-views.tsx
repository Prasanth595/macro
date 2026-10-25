import { replacePaneSearchParams } from '@app/lib/split-router';
import { HeaderActionGroup } from '@components/app/HeaderActionGroup';
import { toast } from '@core/component/Toast/Toast';
import { useUserId } from '@core/context/user';
import { writeClipboardData } from '@core/util/dataTransfer';
import { fireAndForget } from '@core/util/fireAndForget';
import { Telemetry } from '@macro-inc/observability';
import DotsIcon from '@phosphor/dots-three.svg';
import { Button, Dropdown, openDialog } from '@ui';
import {
  batch,
  createMemo,
  For,
  getOwner,
  type Owner,
  onCleanup,
  Show,
} from 'solid-js';
import { v4 as uuid } from 'uuid';
import {
  SavedViewList,
  SavedViewListRow,
} from '../../saved-views/components/saved-view-list';
import { SavedViewMenuItems } from '../../saved-views/components/saved-view-menu';
import { SavedViewPicker } from '../../saved-views/components/saved-view-picker';
import type { SavedView } from '../../saved-views/core/saved-view';
import {
  savedViewErrorMessage,
  useUpdateSavedView,
} from '../../saved-views/queries/saved-view-actions';
import { toSavedView } from '../../saved-views/queries/saved-views';
import {
  CreateSavedViewDialog,
  DeleteSavedViewDialog,
  RenameSavedViewDialog,
  ShareSavedViewDialog,
} from '../../saved-views/views/saved-view-dialogs';
import { TaskSavedViewError } from '../components/TaskSavedViewError';
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_VIEWER,
} from '../filters/task-facets';
import {
  decodeTaskSavedView,
  inspectTaskSavedView,
  materializeTaskSavedView,
  type TaskSavedViewConfig,
} from '../filters/task-saved-view';
import { useTaskFilters } from '../filters/use-task-filters';
import { taskSavedViewTitle } from '../primitives/create-task-saved-views';
import { tasksTabSearch, tasksTabSearchCodec } from '../tasks-tab-search';
import { useTasksView } from '../tasks-view-context';

function TaskSavedViewSummary(props: { config: TaskSavedViewConfig }) {
  const { state } = useTasksView();
  const filters = useTaskFilters();
  const selection = () => materializeTaskSavedView(props.config);
  return (
    <>
      <For each={filters.groups()}>
        {(group) => (
          <Show when={(selection().facets[group.id] ?? []).length}>
            <p>
              {group.label}:{' '}
              {(selection().facets[group.id] ?? [])
                .map(
                  (id) =>
                    group.options.find((option) => option.id === id)?.label ??
                    'Unavailable option'
                )
                .join(', ')}
            </p>
          </Show>
        )}
      </For>
      <Show when={state.search.trim()}>
        <p>Search text is not included.</p>
      </Show>
    </>
  );
}

/** Creation is shared by capture, duplication, and the unsaved-view toolbar. */
function useCreateTaskSavedViewDialog(owner = getOwner()) {
  const { savedViews, savedViewsList, savedViewTeam } = useTasksView();
  const viewerId = useUserId();
  return (record?: SavedView) => {
    if (!savedViews || !savedViewsList) return;
    const selection = savedViews.view();
    const definition =
      record &&
      !(selection.kind === 'saved' && selection.record.id === record.id)
        ? decodeTaskSavedView(record.config)
        : savedViews.capture();
    if (definition.isErr()) {
      toast.failure(definition.error);
      return;
    }
    const config = definition.value;
    const id = uuid();
    const request = savedViews.checkpoint();
    openDialog(
      CreateSavedViewDialog,
      () => ({
        refresh: savedViewsList.refresh,
        viewerId,
        isCurrent: request.isCurrent,
        id,
        name: record ? `${record.name.slice(0, 113)} (copy)` : '',
        config,
        title: record ? 'Duplicate saved view' : 'Save view',
        submitLabel: record ? 'Duplicate' : 'Save view',
        team: savedViewTeam?.(),
        summary: <TaskSavedViewSummary config={config} />,
        onCreated: (created: SavedView) => {
          const decoded = decodeTaskSavedView(created.config);
          if (decoded.isErr()) {
            toast.failure(decoded.error);
            return;
          }
          batch(() => {
            if (request.created(created) && record) savedViews.reset();
          });
        },
      }),
      { owner }
    );
  };
}

function TaskSavedViewMenuItems(props: {
  record: SavedView;
  owner: Owner | null;
  defer: (action: () => void) => void;
}) {
  const { savedViews, savedViewsList, savedViewTeam } = useTasksView();
  const viewerId = useUserId();
  const create = useCreateTaskSavedViewDialog(props.owner);
  const rename = () => {
    if (!savedViews || !savedViewsList) return;
    const record = props.record;
    const request = savedViews.checkpoint();
    props.defer(() =>
      openDialog(
        RenameSavedViewDialog,
        {
          refresh: savedViewsList.refresh,
          viewerId,
          record,
          isCurrent: request.isCurrent,
          onUpdated: request.updated,
        },
        { owner: props.owner }
      )
    );
  };
  const share = () => {
    if (!savedViews || !savedViewsList) return;
    const record = props.record;
    const request = savedViews.checkpoint();
    props.defer(() =>
      openDialog(
        ShareSavedViewDialog,
        () => ({
          refresh: savedViewsList.refresh,
          viewerId,
          record,
          team: savedViewTeam?.(),
          isCurrent: request.isCurrent,
          onUpdated: request.updated,
        }),
        { owner: props.owner }
      )
    );
  };
  const remove = () => {
    if (!savedViews || !savedViewsList) return;
    const record = props.record;
    const request = savedViews.checkpoint();
    props.defer(() =>
      openDialog(
        DeleteSavedViewDialog,
        {
          refresh: savedViewsList.refresh,
          viewerId,
          record,
          isCurrent: request.isCurrent,
          onDeleted: savedViews.deleted,
        },
        { owner: props.owner }
      )
    );
  };
  return (
    <SavedViewMenuItems
      owned={props.record.ownerId === viewerId()}
      canShare={Boolean(savedViewTeam?.() || props.record.sharedTeamId)}
      onRename={rename}
      onShare={share}
      onDelete={remove}
      onDuplicate={() => {
        const record = props.record;
        props.defer(() => create(record));
      }}
      onCopyLink={() =>
        fireAndForget(copySavedViewLink(props.record.id), 'saved-views')
      }
    />
  );
}

export function TaskSavedViewsList(props: {
  onAction?: (action: () => void) => void;
  dialogOwner?: Owner | null;
}) {
  const {
    savedViews,
    savedViewsList,
    isSidebarSectionOpen,
    setSidebarSectionOpen,
  } = useTasksView();
  const viewerId = useUserId();
  const owner = props.dialogOwner ?? getOwner();
  const selectedId = () => {
    const view = savedViews?.view();
    return view?.kind === 'saved' ? view.record.id : undefined;
  };
  const run = (action: () => void) =>
    props.onAction ? props.onAction(action) : action();
  return (
    <Show when={savedViews && savedViewsList}>
      {(views) => (
        <SavedViewList.Root
          open={isSidebarSectionOpen('saved-views')}
          onOpenChange={(open) => setSidebarSectionOpen('saved-views', open)}
        >
          <SavedViewList.Header
            onCreate={() => run(() => savedViews?.start())}
          />
          <SavedViewList.Content>
            <SavedViewList.Items>
              <For each={views().items()}>
                {(record) => (
                  <SavedViewListRow
                    view={record}
                    selected={selectedId() === record.id}
                    scopeKey={viewerId()}
                    onSelect={() => run(() => savedViews?.select(record.id))}
                    menu={(defer) => (
                      <TaskSavedViewMenuItems
                        record={record}
                        owner={owner}
                        defer={(action) => defer(() => run(action))}
                      />
                    )}
                  />
                )}
              </For>
            </SavedViewList.Items>
            <Show when={views().loading() && !views().items()}>
              <p class="px-3 py-2 text-xs text-ink-muted" role="status">
                Loading views…
              </p>
            </Show>
            <Show when={!views().loading() && views().items()?.length === 0}>
              <p class="px-3 py-2 text-xs text-ink-muted">
                Save a set of filters to return to it.
              </p>
            </Show>
            <Show when={views().error()}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fireAndForget(views().refresh(), 'saved-views')}
              >
                Retry loading views
              </Button>
            </Show>
            <Show when={views().hasMore()}>
              <Button
                size="sm"
                variant="ghost"
                disabled={views().loadingMore()}
                onClick={() => fireAndForget(views().loadMore(), 'saved-views')}
              >
                Load more views
              </Button>
            </Show>
          </SavedViewList.Content>
        </SavedViewList.Root>
      )}
    </Show>
  );
}

export function TaskSavedViewsPicker() {
  const { savedViews, state } = useTasksView();
  const viewerId = useUserId();
  // The drawer closes before its action opens a dialog; retain the outer owner.
  const owner = getOwner();
  return (
    <Show when={savedViews}>
      {(views) => (
        <SavedViewPicker
          active={state.savedViewActive ?? false}
          scopeKey={viewerId()}
          label={
            views().view().kind === 'default'
              ? 'Saved views'
              : taskSavedViewTitle(views().view())
          }
        >
          {(onAction) => (
            <TaskSavedViewsList onAction={onAction} dialogOwner={owner} />
          )}
        </SavedViewPicker>
      )}
    </Show>
  );
}

async function copySavedViewLink(id: string) {
  const params = tasksTabSearchCodec.serialize({
    ...tasksTabSearch.defaults,
    savedView: id,
  });
  if (!params) return;
  const url = new URL('/app/component/tasks', window.location.origin);
  replacePaneSearchParams(url.searchParams, [
    { [tasksTabSearch.namespace]: params },
  ]);
  if (await writeClipboardData({ 'text/plain': url.toString() }))
    toast.success('Link copied');
  else toast.failure('Could not copy link');
}

export function TaskSaveViewButton() {
  const { savedViews } = useTasksView();
  const create = useCreateTaskSavedViewDialog();
  const visible = () => {
    const view = savedViews?.view();
    return view?.kind === 'default' && view.changed;
  };
  return (
    <Show when={visible()}>
      <HeaderActionGroup label="Save task filters">
        <Button size="md" variant="ghost" onClick={() => create()}>
          Save view
        </Button>
      </HeaderActionGroup>
    </Show>
  );
}

export function TaskSavedViewMenu() {
  const { savedViews } = useTasksView();
  const viewerId = useUserId();
  const owner = getOwner();
  let trigger: HTMLButtonElement | undefined;
  let menuOpen = false;
  let disposed = false;
  let pending:
    | { viewer: string | undefined; recordId: string; run: () => void }
    | undefined;
  onCleanup(() => {
    disposed = true;
    pending = undefined;
  });
  const selected = () => {
    const view = savedViews?.view();
    return view?.kind === 'saved' ? view.record : undefined;
  };
  const defer = (run: () => void) => {
    const record = selected();
    if (record) pending = { viewer: viewerId(), recordId: record.id, run };
  };
  const finish = (event: Event) => {
    const action = pending;
    pending = undefined;
    if (!action) return;
    event.preventDefault();
    queueMicrotask(() => {
      if (
        disposed ||
        menuOpen ||
        action.viewer !== viewerId() ||
        action.recordId !== selected()?.id
      )
        return;
      trigger?.focus({ preventScroll: true });
      action.run();
    });
  };
  return (
    <Show when={selected()}>
      {(record) => (
        <HeaderActionGroup label="Saved view menu">
          <Dropdown
            placement="bottom-start"
            onOpenChange={(open) => {
              menuOpen = open;
              if (open) pending = undefined;
            }}
          >
            <Dropdown.Trigger
              ref={trigger}
              size="icon-md"
              variant="ghost"
              label="Saved view actions"
            >
              <DotsIcon class="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Content class="min-w-44" onCloseAutoFocus={finish}>
              <TaskSavedViewMenuItems
                record={record()}
                owner={owner}
                defer={defer}
              />
            </Dropdown.Content>
          </Dropdown>
        </HeaderActionGroup>
      )}
    </Show>
  );
}

export function TaskSavedViewActions() {
  const { savedViews, savedViewsList } = useTasksView();
  if (!savedViews || !savedViewsList) return null;
  const viewerId = useUserId();
  const create = useCreateTaskSavedViewDialog();
  const update = useUpdateSavedView({
    refresh: savedViewsList.refresh,
  });
  const selected = () => {
    const view = savedViews?.view();
    return view?.kind === 'saved' ? view : undefined;
  };
  let lastRequest:
    | ReturnType<NonNullable<typeof savedViews>['checkpoint']>
    | undefined;
  const save = async () => {
    const view = selected();
    if (
      !savedViews ||
      !view ||
      update.isPending ||
      view.record.ownerId !== viewerId()
    )
      return;
    const config = savedViews.capture();
    if (config.isErr()) {
      toast.failure(config.error);
      return;
    }
    const request = savedViews.checkpoint();
    lastRequest = request;
    const result = await update.mutateAsync({
      id: view.record.id,
      name: view.record.name,
      config: config.value,
      expectedRevision: view.record.revision,
    });
    if (!result.error && result.data?.updateSavedView)
      request.updated(toSavedView(result.data.updateSavedView));
  };
  const failure = () => {
    const error = update.error;
    const pending = update.isPending;
    return !pending && selected()?.dirty && lastRequest?.isCurrent()
      ? error
      : null;
  };
  return (
    <>
      <Show when={savedViews?.view().kind === 'new' || selected()?.dirty}>
        <HeaderActionGroup label="Saved view actions">
          <Show
            when={savedViews?.view().kind === 'new'}
            fallback={
              <>
                <Show when={selected()?.record.ownerId === viewerId()}>
                  <Button
                    size="md"
                    variant="ghost"
                    disabled={update.isPending}
                    onClick={() => fireAndForget(save(), 'saved-views')}
                  >
                    Save changes
                  </Button>
                </Show>
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => savedViews?.reset()}
                >
                  Reset
                </Button>
              </>
            }
          >
            <Button size="md" variant="ghost" onClick={() => create()}>
              Save view
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={() => savedViews?.leave()}
            >
              Cancel
            </Button>
          </Show>
        </HeaderActionGroup>
      </Show>
      <Show when={failure()}>
        {(error) => (
          <HeaderActionGroup label="Saved view save error">
            <span
              role="alert"
              class="max-w-48 truncate text-xs text-failure-ink"
              title={savedViewErrorMessage(error())}
            >
              {savedViewErrorMessage(error())}
            </span>
            <Show
              when={error().graphQLErrors[0]?.extensions.code === 'CONFLICT'}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  fireAndForget(
                    savedViews?.reload() ?? Promise.resolve(),
                    'saved-views'
                  )
                }
              >
                Reload saved view
              </Button>
            </Show>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => create(selected()?.record)}
            >
              Duplicate
            </Button>
          </HeaderActionGroup>
        )}
      </Show>
    </>
  );
}

/** Keeps unreadable definitions intact while offering an explicit new draft. */
export function TaskSavedViewFailure() {
  const { savedViews, setTab } = useTasksView();
  const filters = useTaskFilters();
  const problem = () => {
    const view = savedViews?.view();
    return view?.kind === 'unavailable' ? view : undefined;
  };
  const inspection = createMemo(() => {
    const record = problem()?.record;
    return record ? inspectTaskSavedView(record.config) : undefined;
  });
  const fields: Record<string, { id: string; label: string }> = {
    statusOptionIds: { id: 'status', label: 'Status' },
    priorityOptionIds: { id: 'priority', label: 'Priority' },
    assignees: { id: 'assignees', label: 'Assignee' },
    creators: { id: 'created-by', label: 'Created by' },
    tags: { id: 'tags', label: 'Tags' },
  };
  const pathLabel = (path: string[]) =>
    path
      .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part))
      .join(' → ');
  const valueLabel = (key: string, value: unknown) => {
    let id: string | undefined;
    if (typeof value === 'string') id = value;
    else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      if ('type' in value && value.type === 'viewer') id = TASK_VIEWER;
      else if ('id' in value && typeof value.id === 'string') id = value.id;
      else if ('optionId' in value && typeof value.optionId === 'string')
        id = value.optionId;
    }
    if (id !== undefined) {
      const known =
        key === 'statusOptionIds'
          ? TASK_STATUS_OPTIONS.find((option) => option.propertyOptionId === id)
          : key === 'priorityOptionIds'
            ? TASK_PRIORITY_OPTIONS.find(
                (option) => option.propertyOptionId === id
              )
            : undefined;
      if (known) return known.label;
      const group = filters
        .groups()
        .find((group) => group.id === fields[key]?.id);
      const label = group?.options.find((option) => option.id === id)?.label;
      return label ?? id;
    }
    return JSON.stringify(value) ?? 'Missing filter definition';
  };
  const details = createMemo(() => {
    const inspected = inspection();
    const record = problem()?.record;
    if (!inspected || !record) return;
    const keys = new Set([
      ...Object.keys(inspected.filters ?? {}),
      ...inspected.issues
        .filter((issue) => issue.path[0] === 'filters' && issue.path.length > 1)
        .map((issue) => issue.path[1]),
    ]);
    return {
      filters: [...keys].map((key) => {
        const value = inspected.filters?.[key];
        return {
          label: fields[key]?.label ?? key,
          values: (Array.isArray(value) ? value : [value]).map((value) =>
            valueLabel(key, value)
          ),
          issues: inspected.issues
            .filter(
              (issue) => issue.path[0] === 'filters' && issue.path[1] === key
            )
            .map(
              (issue) =>
                `${pathLabel(issue.path.slice(2))}${issue.path.length > 2 ? ': ' : ''}${issue.message}`
            ),
        };
      }),
      issues: inspected.issues
        .filter((issue) => issue.path[0] !== 'filters' || issue.path.length < 2)
        .map(
          (issue) =>
            `${pathLabel(issue.path)}${issue.path.length ? ': ' : ''}${issue.message}`
        ),
      source: JSON.stringify(record.config, null, 2),
      recoverable: inspected.recovered !== undefined,
    };
  });
  return (
    <TaskSavedViewError
      message={problem()?.message ?? 'This saved view is unavailable.'}
      details={details()}
      onKeep={() => setTab('my-tasks')}
      onRecreate={() => {
        const record = problem()?.record;
        if (!record) return;
        const recovered = inspection()?.recovered;
        const span = Telemetry.span('saved_view.recreate');
        span.setAttr('saved_view.id', record.id);
        span.setAttr('saved_view.recovery_uses_defaults', !recovered);
        try {
          span.run(() => savedViews?.start(recovered));
        } finally {
          span.end();
        }
      }}
    />
  );
}
