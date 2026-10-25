import { err, ok, type Result } from 'neverthrow';
import { batch, createRoot, createSignal } from 'solid-js';
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
      statusOptionIds: [],
      priorityOptionIds: [],
      assignees: [{ type: 'viewer' }],
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
    const [viewerId, setViewerId] = createSignal<string | undefined>(
      view.ownerId
    );
    const [detailViewerId, setDetailViewerId] = createSignal<
      string | undefined
    >(view.ownerId);
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
      detailViewerId,
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
      viewerId,
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
      setViewerId,
      setDetailViewerId,
      source,
      update,
    };
  });
}

describe('saved task drafts', () => {
  it('loads person filters, leaves edits unsaved, and resets without writing', () => {
    const h = harness();
    expect(h.state.tab).toBe('team-tasks');
    expect(h.state.facets.assignees).toEqual(['@viewer']);
    h.setState('facets', { priority: ['urgent'] });
    expect(h.controller.dirty()).toBe(true);
    expect(h.update).not.toHaveBeenCalled();
    h.controller.reset();
    expect(h.state.facets.priority).toEqual([]);
    expect(h.controller.dirty()).toBe(false);
  });

  it('opens a captured built-in view with editable person alternatives and no tab restriction', async () => {
    const h = harness();
    h.controller.leave();
    h.setState('tab', 'my-tasks');
    h.setState('facets', { assignees: ['macro|other@example.com'] });
    h.source.create = async (input) => ok({ ...view, ...input });
    h.controller.saveAs();
    await h.controller.save('Either assignee');
    expect(h.state.tab).toBe('team-tasks');
    expect(h.state.facets.assignees).toEqual([
      'macro|other@example.com',
      '@viewer',
    ]);
    expect(h.controller.dirty()).toBe(false);
    h.setState('facets', 'assignees', ['macro|other@example.com']);
    expect(h.controller.dirty()).toBe(true);
    h.controller.reset();
    expect(h.state.facets.assignees).toContain('@viewer');
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

  it('does not install another account’s cached detail before its new read arrives', () => {
    const h = harness();
    h.setViewerId('other-viewer');
    expect(h.controller.ready()).toBe(false);
    expect(h.controller.record()).toBeUndefined();
    batch(() => {
      h.setDetail({ ...view, sharedTeamId: 'team' });
      h.setDetailViewerId('other-viewer');
    });
    expect(h.controller.ready()).toBe(true);
    expect(h.controller.owned()).toBe(false);
  });

  it('discards a new-view draft when the account changes', () => {
    const h = harness();
    h.controller.start();
    h.controller.saveAs();
    h.setViewerId('other-viewer');
    expect(h.controller.creating()).toBe(false);
    expect(h.controller.form()).toBeUndefined();
  });

  it('does not open a completed copy after the built-in tab changes', async () => {
    const h = harness();
    h.controller.leave();
    h.controller.saveAs();
    let finish!: (result: Result<SavedView, SavedViewError>) => void;
    h.source.create = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const save = h.controller.save('Copy', null);
    h.setState('tab', 'created-by-me');
    finish(ok({ ...view, id: 'new-view' }));
    await save;
    expect(h.controller.active()).toBe(false);
    expect(h.controller.record()).toBeUndefined();
    expect(h.state.tab).toBe('created-by-me');
  });

  it('fails closed on unknown filter versions', () => {
    const h = harness();
    h.setDetail({
      ...view,
      config: { kind: 'tasks', version: 3, filters: {} },
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

  it('keeps filter edits made while a new view is saving', async () => {
    const h = harness();
    h.controller.leave();
    h.setState('tab', 'my-tasks');
    h.controller.saveAs();
    let finish!: () => void;
    h.source.create = (input) =>
      new Promise((resolve) => {
        finish = () => resolve(ok({ ...view, ...input }));
      });
    const save = h.controller.save('Pending view');
    h.setState('facets', 'priority', ['urgent']);
    finish();
    await save;
    expect(h.state.tab).toBe('team-tasks');
    expect(h.state.facets.assignees).toEqual(['@viewer']);
    expect(h.state.facets.priority).toEqual(['urgent']);
    expect(h.controller.dirty()).toBe(true);
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
    h.controller.rename();
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

  it('compares saved filters against the built-in defaults without search or layout', () => {
    const h = harness();
    h.controller.leave();
    expect(h.controller.changedFromBase()).toBe(false);
    h.setState('search', 'urgent');
    h.setState('layout', 'board');
    expect(h.controller.changedFromBase()).toBe(false);
    h.setState('facets', 'priority', ['urgent']);
    expect(h.controller.changedFromBase()).toBe(true);
  });

  it('renames another sidebar view without persisting or replacing the current draft', async () => {
    const h = harness();
    h.setState('facets', 'priority', ['urgent']);
    const other = { ...view, id: 'other-view', revision: 3 };
    h.source.update = vi.fn(async (input) =>
      ok({ ...other, name: input.name })
    );
    h.controller.rename(other);
    await h.controller.save('Renamed');
    expect(h.source.update).toHaveBeenCalledWith({
      id: other.id,
      name: 'Renamed',
      expectedRevision: 3,
      config: other.config,
    });
    expect(h.controller.record()?.id).toBe(view.id);
    expect(h.state.facets.priority).toEqual(['urgent']);
    expect(h.controller.dirty()).toBe(true);
  });

  it('shares the saved definition without saving temporary filters', async () => {
    const h = harness();
    h.setState('facets', 'priority', ['urgent']);
    h.source.update = vi.fn(async () =>
      ok({ ...view, sharedTeamId: 'team', revision: 2 })
    );
    h.controller.share();
    await h.controller.save(view.name, 'team');
    expect(h.source.update).toHaveBeenCalledWith(
      expect.objectContaining({ config: view.config, sharedTeamId: 'team' })
    );
    expect(h.controller.dirty()).toBe(true);
    expect(h.state.facets.priority).toEqual(['urgent']);
  });

  it('duplicates current edits privately and prefills the name', async () => {
    const h = harness();
    h.setDetail({ ...view, sharedTeamId: 'team' });
    h.setState('facets', 'priority', ['urgent']);
    h.source.create = vi.fn(async (input) =>
      ok({ ...input, ownerId: view.ownerId, revision: 1 })
    );
    h.controller.duplicate();
    const form = h.controller.form();
    expect(form?.name).toBe(`${view.name} (copy)`);
    expect(form?.sharedTeamId).toBeNull();
    await h.controller.save(form?.name);
    expect(h.source.create).toHaveBeenCalledWith(
      expect.objectContaining({ sharedTeamId: null })
    );
    expect(h.controller.record()?.id).not.toBe(view.id);
    expect(h.state.facets.priority).toEqual(['urgent']);
    expect(h.controller.dirty()).toBe(false);
  });

  it('duplicates another sidebar definition rather than the open view filters', async () => {
    const h = harness();
    h.setState('facets', 'priority', ['urgent']);
    const other = { ...view, id: 'other-view', name: 'Other view' };
    h.source.create = vi.fn(async (input) =>
      ok({ ...input, ownerId: view.ownerId, revision: 1 })
    );
    h.controller.duplicate(other);
    await h.controller.save(h.controller.form()?.name);
    expect(h.source.create).toHaveBeenCalledWith(
      expect.objectContaining({ config: other.config })
    );
    expect(h.state.facets.priority).toEqual([]);
    expect(h.controller.dirty()).toBe(false);
  });

  it('deletes an unselected view without leaving the current draft', async () => {
    const h = harness();
    h.setState('facets', 'priority', ['urgent']);
    const other = { ...view, id: 'other-view', revision: 3 };
    h.controller.confirmDelete(other);
    await h.controller.remove();
    expect(h.source.delete).toHaveBeenCalledWith({
      id: other.id,
      expectedRevision: 3,
    });
    expect(h.controller.record()?.id).toBe(view.id);
    expect(h.controller.dirty()).toBe(true);
  });

  it('leaves the deleted view when selected during its pending deletion', async () => {
    const h = harness();
    const other = { ...view, id: 'other-view' };
    let finish!: (result: Result<void, SavedViewError>) => void;
    h.source.delete = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    h.controller.confirmDelete(other);
    const remove = h.controller.remove();
    h.setId(other.id);
    h.setDetail(other);
    expect(h.controller.record()?.id).toBe(other.id);
    finish(ok(undefined));
    await remove;
    expect(h.controller.active()).toBe(false);
    expect(h.controller.record()).toBeUndefined();
  });

  it('does not apply a completed deletion to another account', async () => {
    const h = harness();
    let finish!: (result: Result<void, SavedViewError>) => void;
    h.source.delete = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    h.controller.confirmDelete();
    const remove = h.controller.remove();
    batch(() => {
      h.setViewerId('other-viewer');
      h.setDetailViewerId('other-viewer');
      h.setDetail({ ...view, ownerId: 'other-viewer' });
    });
    finish(ok(undefined));
    await remove;
    expect(h.controller.active()).toBe(true);
    expect(h.controller.record()?.ownerId).toBe('other-viewer');
  });
});
