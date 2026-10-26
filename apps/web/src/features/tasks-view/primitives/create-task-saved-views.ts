import { fireAndForget } from '@core/util/fireAndForget';
import {
  type Accessor,
  batch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import type { SavedViewSource } from '../../saved-views/context/saved-views-source';
import type { SavedView } from '../../saved-views/core/saved-view';
import { createSavedViewDraft } from '../../saved-views/primitives/create-saved-view-draft';
import {
  DEFAULT_TASK_FACET_SELECTION,
  type TaskFacetContext,
} from '../filters/task-facets';
import {
  captureTaskSavedView,
  decodeTaskSavedView,
  materializeTaskSavedView,
  readTaskSavedView,
  type TaskSavedViewConfig,
  type TaskSavedViewIssue,
  taskSavedViewsEqual,
  withTaskTabFilters,
} from '../filters/task-saved-view';
import type { TasksViewState, TaskTab } from '../types';

export type TaskSavedViewSelection =
  | { kind: 'default'; changed: boolean }
  | { kind: 'new' }
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | {
      kind: 'saved';
      record: SavedView;
      dirty: boolean;
      issues: TaskSavedViewIssue[];
    };

export function taskSavedViewTitle(view: TaskSavedViewSelection): string {
  if (view.kind === 'saved') return view.record.name;
  return view.kind === 'new' ? 'New view' : 'Saved view';
}

/** Owns the selected filter draft, not mutations or dialog state. */
export function createTaskSavedViews(options: {
  source: SavedViewSource;
  selectedId: Accessor<string | undefined>;
  viewerId: Accessor<string | undefined>;
  taskId: Accessor<string | undefined>;
  state: TasksViewState;
  facetContext: Accessor<TaskFacetContext>;
  navigate: (id: string | undefined) => void;
  apply: (tab: TaskTab, facets: TasksViewState['facets']) => void;
  clearSearch: () => void;
  setActive: (active: boolean) => void;
}) {
  const [creating, setCreating] = createSignal(false);
  const [tagBindings, setTagBindings] = createSignal<
    ReadonlyMap<string, string>
  >(new Map());
  const [unavailable, setUnavailable] = createSignal<string>();
  const active = () => creating() || Boolean(options.selectedId());
  const capture = () =>
    captureTaskSavedView({
      tab: options.state.tab,
      facets: options.state.facets,
      context: options.facetContext(),
    });
  const current = createMemo(() => {
    const result = capture();
    return result.isOk() ? result.value : undefined;
  });
  const draft = createSavedViewDraft({ current, equal: taskSavedViewsEqual });
  const apply = (
    definition: TaskSavedViewConfig,
    facets?: TasksViewState['facets']
  ) => {
    const materialized = materializeTaskSavedView(definition);
    batch(() => {
      setTagBindings(materialized.tagBindings);
      options.apply(materialized.tab, facets ?? materialized.facets);
    });
  };
  const reset = () => {
    const baseline = draft.baseline();
    if (baseline) apply(baseline);
  };
  // Dirty filters can defer installation, but not knowledge of a newer revision.
  let latestRevision = 0;
  const installRecord = (record: SavedView) => {
    latestRevision = Math.max(latestRevision, record.revision);
    if (record.revision < latestRevision) return;
    const previous = draft.record();
    if (previous?.id === record.id && record.revision < previous.revision)
      return;
    const { config } = readTaskSavedView(record.config);
    setUnavailable(undefined);
    if (previous?.id === record.id && draft.dirty()) return;
    draft.install(record, config);
    apply(config);
  };
  let draftOwner = {};
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  let priorSelection: string | undefined;
  let priorViewer: string | undefined;
  createEffect(
    on(
      () => [options.selectedId(), options.viewerId(), creating()] as const,
      ([id, viewer, isNew]) => {
        const accountChanged =
          priorViewer !== undefined && viewer !== priorViewer;
        if (accountChanged) {
          setCreating(false);
          setTagBindings(new Map());
        }
        if (isNew && !accountChanged) {
          if (!draft.record() || draft.record()?.id !== id) return;
          setCreating(false);
        }
        const changed = id !== priorSelection || viewer !== priorViewer;
        const wasSelected = Boolean(priorSelection);
        const hadBaseline = draft.baseline() !== undefined;
        const keepConfirmed =
          draft.record()?.id === id && viewer === priorViewer;
        priorSelection = id;
        priorViewer = viewer;
        if (changed) {
          latestRevision = 0;
          draftOwner = {};
          options.setActive(Boolean(id));
          if (!keepConfirmed) draft.install(undefined, undefined);
          setUnavailable(undefined);
          options.clearSearch();
        }
        if (!id) {
          if ((wasSelected && hadBaseline) || accountChanged) {
            setTagBindings(new Map());
            options.apply(
              accountChanged ? 'my-tasks' : options.state.tab,
              DEFAULT_TASK_FACET_SELECTION
            );
          }
        }
      }
    )
  );
  createEffect(
    on(
      () =>
        [
          options.selectedId(),
          options.viewerId(),
          creating(),
          options.source.data(),
          options.source.error(),
          options.source.viewerId(),
        ] as const,
      ([id, viewer, isNew, record, loadError, detailViewer]) => {
        if (!id || isNew) return;
        if (detailViewer !== undefined && detailViewer !== viewer) return;
        if (loadError || record === null) {
          setUnavailable(
            'This saved view is unavailable or you no longer have access.'
          );
          return;
        }
        if (viewer && record?.id === id) installRecord(record);
      }
    )
  );
  createEffect(
    on(options.taskId, (id, previous) => {
      if (id === previous) return;
      draftOwner = {};
      if (!active()) return;
      reset();
      if (id === undefined)
        fireAndForget(options.source.refresh(), 'saved-views');
    })
  );
  createEffect(
    on(
      () => options.state.tab,
      (tab, previous) => {
        if (previous !== undefined && tab !== previous) draftOwner = {};
      }
    )
  );

  const view = createMemo<TaskSavedViewSelection>(() => {
    const problem = unavailable();
    if (active() && problem) return { kind: 'unavailable', message: problem };
    if (creating()) return { kind: 'new' };
    if (!options.selectedId()) {
      const base = captureTaskSavedView({
        tab: options.state.tab,
        facets: DEFAULT_TASK_FACET_SELECTION,
        context: options.facetContext(),
      });
      const definition = current();
      return {
        kind: 'default',
        changed: Boolean(
          definition &&
            base.isOk() &&
            !taskSavedViewsEqual(definition, base.value)
        ),
      };
    }
    const record = draft.record();
    return options.viewerId() && record && record.id === options.selectedId()
      ? {
          kind: 'saved',
          record,
          dirty: draft.dirty(),
          issues: readTaskSavedView(record.config).issues,
        }
      : { kind: 'loading' };
  });
  const select = (id: string) => {
    setCreating(false);
    options.navigate(id);
  };
  const leave = () => {
    draftOwner = {};
    batch(() => {
      setCreating(false);
      options.setActive(false);
      options.apply('my-tasks', DEFAULT_TASK_FACET_SELECTION);
      draft.install(undefined, undefined);
      setTagBindings(new Map());
      setUnavailable(undefined);
      options.navigate(undefined);
    });
  };
  const start = () => {
    draftOwner = {};
    batch(() => {
      setCreating(true);
      options.setActive(true);
      setTagBindings(new Map());
      options.apply('team-tasks', DEFAULT_TASK_FACET_SELECTION);
      options.clearSearch();
      const result = capture();
      if (result.isOk()) draft.install(undefined, result.value);
      setUnavailable(undefined);
    });
    options.navigate(undefined);
  };
  const selectedRevision = () => {
    const id = options.selectedId();
    const local = draft.record();
    const remote = options.source.data();
    return Math.max(
      latestRevision,
      local && local.id === id ? local.revision : 0,
      remote && remote.id === id ? remote.revision : 0
    );
  };
  /** Binds a completion to this draft, including leaving and returning to the same view. */
  const checkpoint = () => {
    const owner = draftOwner;
    const viewer = options.viewerId();
    const id = options.selectedId();
    const task = options.taskId();
    const tab = options.state.tab;
    const isNew = creating();
    const revision = selectedRevision();
    const isCurrent = () =>
      !disposed &&
      owner === draftOwner &&
      viewer === options.viewerId() &&
      id === options.selectedId() &&
      task === options.taskId() &&
      tab === options.state.tab &&
      isNew === creating();
    const accept = (record: SavedView) => {
      if (!isCurrent()) return;
      const previous = draft.record();
      if (previous?.id === record.id && previous.revision > record.revision)
        return;
      const decoded = decodeTaskSavedView(record.config);
      if (decoded.isOk()) return decoded.value;
      // Rename/share retain skipped clauses; keep their existing filter baseline.
      if (
        previous?.id === record.id &&
        JSON.stringify(previous.config) === JSON.stringify(record.config)
      )
        return draft.baseline();
    };
    return {
      isCurrent,
      created(record: SavedView) {
        if (selectedRevision() !== revision) return false;
        const definition = accept(record);
        if (!definition) return false;
        const facets = withTaskTabFilters(
          options.state.tab,
          options.state.facets
        );
        batch(() => {
          setCreating(true);
          draft.install(record, definition);
          apply(definition, facets);
          options.navigate(record.id);
        });
        return true;
      },
      updated(record: SavedView) {
        if (
          options.selectedId() !== record.id ||
          selectedRevision() > record.revision
        )
          return false;
        const definition = accept(record);
        if (!definition) return false;
        draft.install(record, definition);
        return true;
      },
    };
  };
  const deleted = (record: SavedView, viewer: string) => {
    if (
      !disposed &&
      options.viewerId() === viewer &&
      options.selectedId() === record.id
    )
      leave();
  };
  const reload = async () => {
    const request = checkpoint();
    await options.source.refresh();
    if (!request.isCurrent()) return;
    const record = options.source.data();
    if (record?.id !== options.selectedId()) return;
    if (!record) return;
    const { config } = readTaskSavedView(record.config);
    if (record.revision < (draft.record()?.revision ?? 0)) return;
    setUnavailable(undefined);
    draft.install(record, config);
    reset();
  };
  return {
    view,
    tagBindings,
    capture,
    checkpoint,
    select,
    start,
    leave,
    reset,
    reload,
    deleted,
  };
}

export type TaskSavedViews = ReturnType<typeof createTaskSavedViews>;
