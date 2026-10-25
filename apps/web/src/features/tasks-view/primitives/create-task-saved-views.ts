import { fireAndForget } from '@core/util/fireAndForget';
import { ok } from 'neverthrow';
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
  SavedView,
  UpdateSavedView,
} from '../../saved-views/core/saved-view';
import { createSavedViewCrud } from '../../saved-views/primitives/create-saved-view-crud';
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
  withTaskTabFilters,
} from '../filters/task-saved-view';
import type { TasksViewState, TaskTab } from '../types';

export type SavedViewForm = {
  mode: 'create' | 'duplicate' | 'rename' | 'share';
  id: string;
  name: string;
  sharedTeamId: string | null;
  record?: SavedView;
  config?: TaskSavedViewConfig;
};

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
  const changedFromBase = () => {
    const base = captureTaskSavedView({
      tab: options.state.tab,
      facets: DEFAULT_TASK_FACET_SELECTION,
      context: options.facetContext(),
    });
    const definition = current();
    return Boolean(
      definition && base.isOk() && !taskSavedViewsEqual(definition, base.value)
    );
  };
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
    crud.clear();
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
      (draft.dirty() || crud.saving() || crud.editing())
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
          options.source.detailViewerId(),
        ] as const,
      ([id, viewer, isNew, record, loadError, detailViewer]) => {
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
          navigationEpoch += 1;
          options.setActive(Boolean(id));
          if (!keepConfirmed) draft.install(undefined, undefined);
          setUnavailable(undefined);
          crud.clear();
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
          return;
        }
        if (detailViewer !== undefined && detailViewer !== viewer) return;
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

  createEffect(
    on(
      () => options.state.tab,
      (tab, previous) => {
        if (tab === previous || active()) return;
        navigationEpoch += 1;
        crud.clear();
      }
    )
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
      crud.clear();
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
      crud.clear();
    });
    options.navigate(undefined);
  };
  const prepareForm = (
    mode: SavedViewForm['mode'],
    record = draft.record()
  ): SavedViewForm | undefined => {
    if (crud.saving()) return;
    crud.clear();
    if (mode === 'create') {
      return { mode, id: uuid(), name: '', sharedTeamId: null };
    }
    if (!record) return;
    if (mode !== 'duplicate' && record.ownerId !== options.viewerId()) return;
    const definition =
      mode === 'duplicate' && record.id === draft.record()?.id
        ? capture()
        : decodeTaskSavedView(record.config);
    if (definition.isErr()) {
      crud.fail(definition.error);
      return;
    }
    return {
      mode,
      id: mode === 'duplicate' ? uuid() : record.id,
      name:
        mode === 'duplicate'
          ? `${record.name.slice(0, 113)} (copy)`
          : record.name,
      sharedTeamId: mode === 'duplicate' ? null : record.sharedTeamId,
      record,
      config: definition.value,
    };
  };
  const scope = () =>
    JSON.stringify([
      options.viewerId(),
      creating() ? 'new' : options.selectedId(),
      navigationEpoch,
      draft.record()?.revision,
    ]);
  let savedMetadata: SavedViewForm | undefined;
  const crud = createSavedViewCrud({
    source: options.source,
    viewerId: options.viewerId,
    selectedId: options.selectedId,
    scope,
    onDeleted: leave,
    onSaved: (record, mode) => {
      const confirmed = decodeTaskSavedView(record.config);
      if (confirmed.isErr()) {
        crud.fail(confirmed.error);
        return false;
      }
      batch(() => {
        if (mode === 'create') {
          apply(
            confirmed.value,
            savedMetadata?.mode === 'duplicate'
              ? undefined
              : withTaskTabFilters(options.state.tab, options.state.facets)
          );
          setCreating(true);
          draft.install(record, confirmed.value);
          options.navigate(record.id);
        } else if (options.selectedId() === record.id) {
          draft.install(record, confirmed.value);
        }
      });
      return true;
    },
  });
  const save = async (
    name?: string,
    team?: string | null,
    metadata?: SavedViewForm
  ) => {
    if (crud.saving()) return false;
    const definition = metadata?.config ? ok(metadata.config) : capture();
    if (definition.isErr()) {
      crud.fail(definition.error);
      return false;
    }
    const record = metadata?.record ?? draft.record();
    const targetName = (name ?? metadata?.name ?? record?.name ?? '').trim();
    if (!targetName) {
      crud.fail('Give this view a name.');
      return false;
    }
    savedMetadata = metadata;
    if (metadata?.mode === 'create' || metadata?.mode === 'duplicate') {
      return crud.save({
        mode: 'create',
        input: {
          id: metadata.id,
          name: targetName,
          config: definition.value,
          sharedTeamId: team === undefined ? metadata.sharedTeamId : team,
        },
      });
    }
    if (!record) return false;
    const input: UpdateSavedView = {
      id: record.id,
      name: targetName,
      config: definition.value,
      expectedRevision: record.revision,
    };
    // Only an explicit sharing edit changes the selected team.
    if (
      metadata?.mode !== 'rename' &&
      team !== undefined &&
      team !== record.sharedTeamId
    )
      input.sharedTeamId = team;
    return crud.save({ mode: 'update', input, record });
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
    selectedId: options.selectedId,
    active,
    creating,
    ready,
    unavailable,
    error: crud.error,
    conflict: crud.conflict,
    saving: crud.saving,
    record: draft.record,
    dirty: draft.dirty,
    owned,
    changedFromBase,
    current,
    tagBindings,
    title: () =>
      creating() ? 'New view' : (draft.record()?.name ?? 'Saved view'),
    select,
    leave,
    start,
    reset,
    save,
    remove: crud.remove,
    reload,
    prepareForm,
    clearError: crud.clear,
    holdEditing: crud.hold,
  };
}

export type TaskSavedViews = ReturnType<typeof createTaskSavedViews>;
