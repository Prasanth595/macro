import '@app/index.css';
import { fireAndForget } from '@core/util/fireAndForget';
import { Button, Checkbox } from '@ui';
import { ok } from 'neverthrow';
import { createSignal, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { render } from 'solid-js/web';
import { SavedViewDialog } from '../../saved-views/components/saved-view-dialog';
import { SavedViewList } from '../../saved-views/components/saved-view-list';
import type { SavedViewsSource } from '../../saved-views/context/saved-views-source';
import type { SavedView } from '../../saved-views/core/saved-view';
import { createTaskSavedViews } from '../primitives/create-task-saved-views';
import type { TasksViewState } from '../types';

function Fixture() {
  const [items, setItems] = createSignal<SavedView[]>([]);
  const [selected, setSelected] = createSignal<string>();
  const [writes, setWrites] = createSignal(0);
  const [open, setOpen] = createSignal(true);
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
  const detail = () => items().find((item) => item.id === selected());
  const source: SavedViewsSource = {
    items,
    detail,
    error: () => undefined,
    detailError: () => undefined,
    detailViewerId: () => 'viewer',
    loading: () => false,
    detailLoading: () => false,
    hasMore: () => false,
    loadingMore: () => false,
    loadMore: async () => {},
    refresh: async () => {},
    refreshDetail: async () => {},
    create: async (input) => {
      const view = { ...input, ownerId: 'viewer', revision: 1 };
      setWrites((n) => n + 1);
      setItems((list) => [...list, view]);
      return ok(view);
    },
    update: async (input) => {
      const previous = items().find((item) => item.id === input.id);
      const view = {
        ...input,
        sharedTeamId:
          input.sharedTeamId === undefined
            ? (previous?.sharedTeamId ?? null)
            : input.sharedTeamId,
        ownerId: 'viewer',
        revision: input.expectedRevision + 1,
      };
      setWrites((n) => n + 1);
      setItems((list) =>
        list.map((item) => (item.id === input.id ? view : item))
      );
      return ok(view);
    },
    delete: async ({ id }) => {
      setItems((list) => list.filter((item) => item.id !== id));
      return ok(undefined);
    },
  };
  const views = createTaskSavedViews({
    source,
    selectedId: selected,
    taskId: () => undefined,
    viewerId: () => 'viewer',
    state,
    facetContext: () => ({ tagPropertyDefinitionByOptionId: new Map() }),
    navigate: setSelected,
    clearSearch: () => setState('search', ''),
    setActive: (active) => setState('savedViewActive', active),
    apply: (tab, facets) => {
      setState('tab', tab);
      setState('facets', reconcile(facets));
    },
  });
  return (
    <main
      class="mx-auto flex max-w-4xl flex-col gap-6 p-6 text-ink sm:flex-row"
      data-writes={writes()}
    >
      <aside class="w-full sm:w-60">
        <h1 class="pb-4 text-xl font-medium">Tasks</h1>
        <SavedViewList
          items={items()}
          loading={false}
          failed={false}
          selectedId={selected()}
          open={open()}
          onOpenChange={setOpen}
          hasMore={false}
          loadingMore={false}
          viewerId="viewer"
          canShare
          saving={views.saving()}
          onRename={views.rename}
          onShare={views.share}
          onDuplicate={views.duplicate}
          onCopyLink={() => {}}
          onDelete={views.confirmDelete}
          onSelect={views.select}
          onCreate={views.start}
          onRetry={() => {}}
          onLoadMore={() => {}}
        />
      </aside>
      <section class="flex flex-1 flex-col gap-4">
        <h2>{views.active() ? views.title() : 'All tasks'}</h2>
        <Checkbox
          checked={state.facets.priority?.includes('urgent') ?? false}
          onChange={(checked) =>
            setState('facets', 'priority', checked ? ['urgent'] : [])
          }
        >
          <Checkbox.Control />
          <Checkbox.Label>Urgent priority</Checkbox.Label>
        </Checkbox>
        <div class="flex flex-wrap gap-2">
          <Button onClick={views.saveAs}>Save as view</Button>
          <Show when={views.dirty()}>
            <Button
              onClick={() => {
                fireAndForget(views.save(), 'saved-views-browser');
              }}
            >
              Save changes
            </Button>
            <Button onClick={views.reset}>Reset</Button>
          </Show>
          <Button onClick={views.leave}>All tasks</Button>
        </div>
        <output aria-label="Saved writes">{writes()}</output>
      </section>
      <Show when={views.form()} keyed>
        {(form) => (
          <SavedViewDialog
            mode={form.mode}
            name={form.name}
            sharedTeamId={form.sharedTeamId}
            team={{ id: 'team', name: 'Example team' }}
            pending={views.saving()}
            error={views.error()}
            summary={
              <p>
                Scope:{' '}
                {state.tab === 'team-tasks' ? 'All tasks' : 'Assigned to me'}
              </p>
            }
            onSave={(name, team) => {
              fireAndForget(views.save(name, team), 'saved-views-browser');
            }}
            onClose={views.closeForm}
          />
        )}
      </Show>
    </main>
  );
}
render(() => <Fixture />, document.getElementById('root')!);
