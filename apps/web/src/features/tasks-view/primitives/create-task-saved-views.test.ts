import { err, ok, type Result } from 'neverthrow';
import { createRoot, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedViewsSource } from '../../saved-views/context/saved-views-source';
import type {
  SavedView,
  SavedViewError,
} from '../../saved-views/core/saved-view';
import type { TasksViewState } from '../types';
import { createTaskSavedViews } from './create-task-saved-views';

const view: SavedView = {
  id: '10000000-0000-4000-8000-000000000001',
  ownerId: 'macro|viewer@example.com',
  name: 'My open tasks',
  revision: 1,
  sharedTeamId: null,
  config: {
    kind: 'tasks',
    version: 1,
    filters: {
      scope: 'assigned-to-viewer',
      statusOptionIds: [],
      priorityOptionIds: [],
      assignees: [],
      creators: [],
      tags: [],
    },
  },
};
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

function harness() {
  return createRoot((dispose) => {
    cleanup.push(dispose);
    const [id, setId] = createSignal<string | undefined>(view.id);
    const [detail, setDetail] = createSignal<SavedView | null | undefined>(
      view
    );
    const [taskId, setTaskId] = createSignal<string>();
    const [state, setState] = createStore<TasksViewState>({
      layout: 'list',
      tab: 'team-tasks',
      search: '',
      groupBy: 'none',
      sort: [],
      facets: {},
      collapsedGroupIds: [],
      collapsedSidebarSectionIds: [],
    });
    const update = vi.fn<SavedViewsSource['update']>(async () => ok(view));
    const source: SavedViewsSource = {
      items: () => [view],
      loading: () => false,
      error: () => undefined,
      hasMore: () => false,
      loadingMore: () => false,
      loadMore: async () => {},
      refresh: async () => {},
      detail,
      detailLoading: () => false,
      detailError: () => undefined,
      refreshDetail: async () => {},
      create: vi.fn(async () => ok(view)),
      update,
      delete: vi.fn(async () => ok(undefined)),
    };
    const controller = createTaskSavedViews({
      source,
      selectedId: id,
      taskId,
      viewerId: () => view.ownerId,
      state,
      facetContext: () => ({
        tagPropertyDefinitionByOptionId: new Map(),
        viewerId: view.ownerId,
      }),
      navigate: setId,
      clearSearch: () => setState('search', ''),
      setActive: (active) => setState('savedViewActive', active),
      apply: (tab, facets) => {
        setState('tab', tab);
        setState('facets', reconcile(facets));
      },
    });
    return {
      controller,
      state,
      setState,
      setId,
      setDetail,
      setTaskId,
      source,
      update,
    };
  });
}

describe('saved task drafts', () => {
  it('loads scope, leaves edits unsaved, and resets without writing', () => {
    const h = harness();
    expect(h.state.tab).toBe('my-tasks');
    h.setState('facets', { priority: ['urgent'] });
    expect(h.controller.dirty()).toBe(true);
    expect(h.update).not.toHaveBeenCalled();
    h.controller.reset();
    expect(h.state.facets.priority).toEqual([]);
    expect(h.controller.dirty()).toBe(false);
  });

  it('discards a temporary draft on task navigation and when leaving a view', () => {
    const h = harness();
    h.setState('facets', { priority: ['urgent'] });
    h.setTaskId('task-1');
    expect(h.controller.dirty()).toBe(false);
    h.setState('facets', { priority: ['urgent'] });
    h.controller.leave();
    expect(h.controller.active()).toBe(false);
    expect(h.state.savedViewActive).toBe(false);
    expect(h.state.facets.priority).toBeUndefined();
  });

  it('fails closed on unknown filter versions', () => {
    const h = harness();
    h.setDetail({
      ...view,
      config: { kind: 'tasks', version: 2, filters: {} },
    });
    expect(h.controller.ready()).toBe(false);
    expect(h.controller.unavailable()).toBeTruthy();
  });

  it('does not restore a departed draft after a delayed save failure', async () => {
    const h = harness();
    let finish!: (value: Result<SavedView, SavedViewError>) => void;
    h.source.update = vi.fn(
      () =>
        new Promise<Result<SavedView, SavedViewError>>((resolve) => {
          finish = resolve;
        })
    );
    h.setState('facets', { priority: ['urgent'] });
    const save = h.controller.save();
    h.controller.leave();
    finish(err({ code: 'CONFLICT', message: 'A newer version exists' }));
    await save;
    expect(h.controller.active()).toBe(false);
    expect(h.controller.error()).toBeUndefined();
    expect(h.state.facets.priority).toBeUndefined();
  });

  it('ignores save completion after a task-detail round trip discards its draft', async () => {
    const h = harness();
    let finish!: (result: Result<SavedView, SavedViewError>) => void;
    h.source.update = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    h.setState('facets', { priority: ['urgent'] });
    const save = h.controller.save();
    h.setTaskId('task-1');
    h.setTaskId(undefined);
    finish(ok({ ...view, revision: 2 }));
    await save;
    expect(h.controller.dirty()).toBe(false);
    expect(h.controller.record()?.revision).toBe(1);
    expect(h.state.facets.priority).toEqual([]);
  });

  it('uses the authoritative definition after retrying an already-created ID', async () => {
    const h = harness();
    h.source.create = vi.fn(async (input) => ok({ ...view, id: input.id }));
    h.controller.start();
    h.controller.saveAs();
    h.setState('facets', { priority: ['urgent'] });
    await h.controller.save('Copy', null);
    expect(h.controller.dirty()).toBe(true);
    h.controller.reset();
    expect(h.state.facets.priority).toEqual([]);
  });

  it('does not renew sharing when only filters change', async () => {
    const h = harness();
    h.setDetail({ ...view, sharedTeamId: 'team' });
    h.setState('facets', { priority: ['urgent'] });
    await h.controller.save();
    expect(h.update.mock.calls[0]?.[0]).not.toHaveProperty('sharedTeamId');
  });

  it('keeps the opening revision while metadata is being edited', async () => {
    const h = harness();
    h.controller.manage();
    h.setDetail({ ...view, revision: 2, name: 'Renamed elsewhere' });
    expect(h.controller.record()?.revision).toBe(1);
    await h.controller.save('My rename', null);
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 1 })
    );
  });

  it('keeps a conflicting draft and its revision until the user reloads', async () => {
    const h = harness();
    h.source.update = vi.fn(async () =>
      err({ code: 'CONFLICT', message: 'A newer version exists' })
    );
    h.setState('facets', { priority: ['urgent'] });
    await h.controller.save();
    expect(h.controller.conflict()).toBe(true);
    expect(h.controller.dirty()).toBe(true);
    expect(h.controller.record()?.revision).toBe(1);
    expect(h.state.facets.priority).toEqual(['urgent']);
  });
});
