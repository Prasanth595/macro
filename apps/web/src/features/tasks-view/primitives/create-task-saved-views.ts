import { fireAndForget } from '@core/util/fireAndForget';
import {
  type Accessor,
  batch,
  createEffect,
  createMemo,
  createSignal,
  on,
} from 'solid-js';
import { v4 as uuid } from 'uuid';
import type { SavedViewsSource } from '../../saved-views/context/saved-views-source';
import type {
  CreateSavedView,
  SavedView,
  UpdateSavedView,
} from '../../saved-views/core/saved-view';
import { createSavedViewDraft } from '../../saved-views/primitives/create-saved-view-draft';
import {
  DEFAULT_TASK_FACET_SELECTION,
  type TaskFacetContext,
} from '../filters/task-facets';
import {
  captureTaskSavedView,
  decodeTaskSavedView,
  materializeTaskSavedView,
  type TaskSavedViewConfig,
  taskSavedViewsEqual,
} from '../filters/task-saved-view';
import type { TasksViewState, TaskTab } from '../types';

type SavedViewForm = {
  mode: 'create' | 'update';
  id: string;
  name: string;
  sharedTeamId: string | null;
};

type SavedViewWrite =
  | { mode: 'create'; input: CreateSavedView }
  | { mode: 'update'; input: UpdateSavedView };

export function createTaskSavedViews(options: {
  source: SavedViewsSource;
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
  const [error, setError] = createSignal<string>();
  const [conflict, setConflict] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [form, setForm] = createSignal<SavedViewForm>();
  const [deleting, setDeleting] = createSignal(false);
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
  const apply = (definition: TaskSavedViewConfig) => {
    const materialized = materializeTaskSavedView(definition);
    batch(() => {
      setTagBindings(materialized.tagBindings);
      options.apply(materialized.tab, materialized.facets);
    });
  };
  const reset = () => {
    const baseline = draft.baseline();
    if (baseline) apply(baseline);
    setError(undefined);
    setConflict(false);
  };
  const installRecord = (record: SavedView) => {
    const previous = draft.record();
    if (previous?.id === record.id && record.revision < previous.revision)
      return;
    const decoded = decodeTaskSavedView(record.config);
    if (decoded.isErr()) {
      setUnavailable(decoded.error);
      return;
    }
    setUnavailable(undefined);
    if (
      previous?.id === record.id &&
      (draft.dirty() || saving() || form() || deleting())
    )
      return;
    draft.install(record, decoded.value);
    apply(decoded.value);
  };
  let navigationEpoch = 0;
  let priorSelection: string | undefined;
  let priorViewer: string | undefined;
  createEffect(
    on(
      () =>
        [
          options.selectedId(),
          options.viewerId(),
          creating(),
          options.source.detail(),
          options.source.detailError(),
        ] as const,
      ([id, viewer, isNew, record, loadError]) => {
        if (isNew) {
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
          navigationEpoch += 1;
          options.setActive(Boolean(id));
          if (!keepConfirmed) draft.install(undefined, undefined);
          setUnavailable(undefined);
          setError(undefined);
          setForm(undefined);
          setDeleting(false);
          options.clearSearch();
        }
        if (!id) {
          if (wasSelected && hadBaseline) {
            setTagBindings(new Map());
            options.apply(options.state.tab, DEFAULT_TASK_FACET_SELECTION);
          }
          return;
        }
        if (loadError || record === null) {
          setUnavailable(
            'This saved view is unavailable or you no longer have access.'
          );
          return;
        }
        if (!viewer || record?.id !== id) return;
        installRecord(record);
      }
    )
  );
  createEffect(
    on(options.taskId, (id, previous) => {
      if (id === previous) return;
      navigationEpoch += 1;
      if (!active()) return;
      reset();
      if (id === undefined)
        fireAndForget(options.source.refreshDetail(), 'saved-views');
    })
  );

  const ready = () =>
    !active() ||
    Boolean(
      options.viewerId() &&
        !unavailable() &&
        (creating() || draft.record()?.id === options.selectedId())
    );
  const owned = () => draft.record()?.ownerId === options.viewerId();
  const select = (id: string) => {
    setCreating(false);
    options.navigate(id);
  };
  const leave = () => {
    navigationEpoch += 1;
    batch(() => {
      setCreating(false);
      options.setActive(false);
      options.apply('my-tasks', DEFAULT_TASK_FACET_SELECTION);
      draft.install(undefined, undefined);
      setTagBindings(new Map());
      setForm(undefined);
      setDeleting(false);
      setError(undefined);
      setUnavailable(undefined);
      options.navigate(undefined);
    });
  };
  const start = () => {
    navigationEpoch += 1;
    batch(() => {
      setCreating(true);
      options.setActive(true);
      setTagBindings(new Map());
      options.apply('team-tasks', DEFAULT_TASK_FACET_SELECTION);
      options.clearSearch();
      const result = capture();
      if (result.isOk()) draft.install(undefined, result.value);
      setUnavailable(undefined);
      setError(undefined);
      setForm(undefined);
    });
    options.navigate(undefined);
  };
  const openForm = (mode: 'create' | 'update') => {
    const record = draft.record();
    if (mode === 'update' && (!record || !owned())) return;
    setError(undefined);
    setForm({
      mode,
      id: mode === 'update' && record ? record.id : uuid(),
      name: mode === 'update' ? (record?.name ?? '') : '',
      sharedTeamId: mode === 'update' ? (record?.sharedTeamId ?? null) : null,
    });
  };
  const writeRequest = (
    config: TaskSavedViewConfig,
    name?: string,
    team?: string | null
  ): SavedViewWrite | undefined => {
    const metadata = form();
    const record = draft.record();
    const targetName = (name ?? metadata?.name ?? record?.name ?? '').trim();
    if (!targetName) {
      setError('Give this view a name.');
      return;
    }
    const mode = metadata?.mode ?? 'update';
    if (mode === 'create') {
      if (!metadata) return;
      return {
        mode,
        input: {
          id: metadata.id,
          name: targetName,
          config,
          sharedTeamId: team === undefined ? metadata.sharedTeamId : team,
        },
      };
    }
    if (!record || !owned()) return;
    const input: UpdateSavedView = {
      id: record.id,
      name: targetName,
      config,
      expectedRevision: record.revision,
    };
    // A filter/name save must not renew an expired sharing lifetime.
    if (team !== undefined && team !== record.sharedTeamId)
      input.sharedTeamId = team;
    return { mode, input };
  };
  const scope = () =>
    JSON.stringify([
      options.viewerId(),
      creating() ? 'new' : options.selectedId(),
      navigationEpoch,
      draft.record()?.revision,
    ]);
  const save = async (name?: string, sharedTeamId?: string | null) => {
    if (saving()) return;
    const definition = capture();
    if (definition.isErr()) {
      setError(definition.error);
      return;
    }
    const request = writeRequest(definition.value, name, sharedTeamId);
    if (!request) return;
    const requestScope = scope();
    const requestViewer = options.viewerId();
    setSaving(true);
    setError(undefined);
    const result =
      request.mode === 'create'
        ? await options.source.create(request.input)
        : await options.source.update(request.input);
    setSaving(false);
    if (scope() !== requestScope) {
      if (
        result.isOk() &&
        options.viewerId() === requestViewer &&
        options.selectedId() === request.input.id
      )
        fireAndForget(options.source.refreshDetail(), 'saved-views');
      return;
    }
    if (result.isErr()) {
      setConflict(result.error.code === 'CONFLICT');
      setError(result.error.message);
      return;
    }
    const confirmed = decodeTaskSavedView(result.value.config);
    if (confirmed.isErr()) {
      setError(confirmed.error);
      return;
    }
    batch(() => {
      setForm(undefined);
      setCreating(request.mode === 'create');
      draft.install(result.value, confirmed.value);
      setConflict(false);
      if (request.mode === 'create') options.navigate(result.value.id);
    });
  };
  const remove = async () => {
    const record = draft.record();
    if (!record || !owned() || saving()) return;
    const requestScope = scope();
    setSaving(true);
    const result = await options.source.delete({
      id: record.id,
      expectedRevision: record.revision,
    });
    setSaving(false);
    if (scope() !== requestScope) return;
    if (result.isErr()) {
      setError(result.error.message);
      setConflict(result.error.code === 'CONFLICT');
      return;
    }
    leave();
  };
  const reload = async () => {
    const requestScope = scope();
    await options.source.refreshDetail();
    if (scope() !== requestScope) return;
    const record = options.source.detail();
    if (!record || record.id !== options.selectedId()) return;
    const decoded = decodeTaskSavedView(record.config);
    if (decoded.isErr()) {
      setUnavailable(decoded.error);
      return;
    }
    draft.install(record, decoded.value);
    reset();
  };
  return {
    source: options.source,
    active,
    creating,
    ready,
    unavailable,
    error,
    conflict,
    saving,
    record: draft.record,
    dirty: draft.dirty,
    owned,
    tagBindings,
    form,
    deleting,
    title: () =>
      creating() ? 'New view' : (draft.record()?.name ?? 'Saved view'),
    select,
    leave,
    start,
    reset,
    save,
    remove,
    reload,
    saveAs: () => openForm('create'),
    manage: () => openForm('update'),
    closeForm: () => setForm(undefined),
    confirmDelete: () => {
      setError(undefined);
      setDeleting(true);
    },
    cancelDelete: () => setDeleting(false),
    setScope: (tab: TaskTab) => options.apply(tab, options.state.facets),
  };
}

export type TaskSavedViews = ReturnType<typeof createTaskSavedViews>;
