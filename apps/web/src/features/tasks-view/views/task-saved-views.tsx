import { replacePaneSearchParams } from '@app/lib/split-router';
import { HeaderActionGroup } from '@components/app/HeaderActionGroup';
import { toast } from '@core/component/Toast/Toast';
import { useUserId } from '@core/context/user';
import { writeClipboardData } from '@core/util/dataTransfer';
import { fireAndForget } from '@core/util/fireAndForget';
import DotsIcon from '@phosphor/dots-three.svg';
import { Button, ConfirmDialog, Dropdown } from '@ui';
import { For, onCleanup, Show } from 'solid-js';
import { SavedViewDialog } from '../../saved-views/components/saved-view-dialog';
import { SavedViewList } from '../../saved-views/components/saved-view-list';
import { SavedViewMenuItems } from '../../saved-views/components/saved-view-menu';
import { SavedViewPicker } from '../../saved-views/components/saved-view-picker';
import { materializeTaskSavedView } from '../filters/task-saved-view';
import { useTaskFilters } from '../filters/use-task-filters';
import { tasksTabSearch, tasksTabSearchCodec } from '../tasks-tab-search';
import { useTasksView } from '../tasks-view-context';

export function TaskSavedViewsList(props: {
  onAction?: (action: () => void) => void;
}) {
  const {
    savedViews,
    savedViewTeam,
    isSidebarSectionOpen,
    setSidebarSectionOpen,
  } = useTasksView();
  const viewerId = useUserId();
  const run = (action: () => void) =>
    props.onAction ? props.onAction(action) : action();
  return (
    <Show when={savedViews}>
      {(views) => (
        <SavedViewList
          items={views().source.items()}
          selectedId={views().record()?.id}
          loading={views().source.loading()}
          failed={Boolean(views().source.error())}
          open={isSidebarSectionOpen('saved-views')}
          onOpenChange={(open) => setSidebarSectionOpen('saved-views', open)}
          hasMore={views().source.hasMore()}
          loadingMore={views().source.loadingMore()}
          viewerId={viewerId()}
          canShare={Boolean(savedViewTeam?.())}
          saving={views().saving()}
          onRename={(view) => run(() => views().rename(view))}
          onShare={(view) => run(() => views().share(view))}
          onDuplicate={(view) => run(() => views().duplicate(view))}
          onCopyLink={(view) =>
            fireAndForget(copySavedViewLink(view.id), 'saved-views')
          }
          onDelete={(view) => run(() => views().confirmDelete(view))}
          onSelect={(id) => run(() => views().select(id))}
          onCreate={() => run(() => views().start())}
          onRetry={() => fireAndForget(views().source.refresh(), 'saved-views')}
          onLoadMore={() =>
            fireAndForget(views().source.loadMore(), 'saved-views')
          }
        />
      )}
    </Show>
  );
}

export function TaskSavedViewsPicker() {
  const { savedViews } = useTasksView();
  const viewerId = useUserId();
  return (
    <Show when={savedViews}>
      {(views) => (
        <SavedViewPicker
          scopeKey={viewerId()}
          label={views().active() ? views().title() : 'Saved views'}
        >
          {(onAction) => <TaskSavedViewsList onAction={onAction} />}
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
  const copied = await writeClipboardData({ 'text/plain': url.toString() });
  if (!copied) toast.failure('Could not copy link');
  else toast.success('Link copied');
}

export function TaskSaveViewButton() {
  const { savedViews } = useTasksView();
  return (
    <Show
      when={savedViews && !savedViews.active() && savedViews.changedFromBase()}
    >
      <HeaderActionGroup label="Save task filters">
        <Button size="md" variant="ghost" onClick={() => savedViews?.saveAs()}>
          Save view
        </Button>
      </HeaderActionGroup>
    </Show>
  );
}

export function TaskSavedViewMenu() {
  const { savedViews, savedViewTeam } = useTasksView();
  const viewerId = useUserId();
  let trigger: HTMLButtonElement | undefined;
  let menuOpen = false;
  let disposed = false;
  let pendingAction:
    | {
        viewerId: string | undefined;
        viewId: string | undefined;
        run: () => void;
      }
    | undefined;
  onCleanup(() => {
    disposed = true;
    pendingAction = undefined;
  });
  const defer = (run: () => void) => {
    pendingAction = {
      viewerId: viewerId(),
      viewId: savedViews?.record()?.id,
      run,
    };
  };
  const finishMenuClose = (event: Event) => {
    const action = pendingAction;
    pendingAction = undefined;
    if (!action) return;
    event.preventDefault();
    // Release the menu's modal lock before opening another focus trap.
    queueMicrotask(() => {
      if (
        disposed ||
        menuOpen ||
        action.viewerId !== viewerId() ||
        action.viewId !== savedViews?.record()?.id
      )
        return;
      trigger?.focus({ preventScroll: true });
      action.run();
    });
  };
  return (
    <Show
      when={
        savedViews?.active() && savedViews.ready() && !savedViews.creating()
      }
    >
      <HeaderActionGroup label="Saved view menu">
        <Dropdown
          placement="bottom-start"
          onOpenChange={(open) => {
            menuOpen = open;
            if (open) pendingAction = undefined;
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
          <Dropdown.Content class="min-w-44" onCloseAutoFocus={finishMenuClose}>
            <SavedViewMenuItems
              owned={savedViews?.owned() ?? false}
              canShare={Boolean(
                savedViewTeam?.() || savedViews?.record()?.sharedTeamId
              )}
              disabled={savedViews?.saving()}
              onRename={() => defer(() => savedViews?.rename())}
              onShare={() => defer(() => savedViews?.share())}
              onDuplicate={() => defer(() => savedViews?.duplicate())}
              onCopyLink={() => {
                const id = savedViews?.record()?.id;
                if (id) fireAndForget(copySavedViewLink(id), 'saved-views');
              }}
              onDelete={() => defer(() => savedViews?.confirmDelete())}
            />
          </Dropdown.Content>
        </Dropdown>
      </HeaderActionGroup>
    </Show>
  );
}

export function TaskSavedViewActions() {
  const { savedViews } = useTasksView();
  return (
    <Show
      when={
        savedViews?.active() &&
        savedViews.ready() &&
        (savedViews.creating() || savedViews.dirty())
      }
    >
      <HeaderActionGroup label="Saved view actions">
        <Show
          when={savedViews?.creating()}
          fallback={
            <>
              <Show when={savedViews?.owned()}>
                <Button
                  size="md"
                  variant="ghost"
                  disabled={savedViews?.saving()}
                  onClick={() =>
                    fireAndForget(
                      savedViews?.save() ?? Promise.resolve(),
                      'saved-views'
                    )
                  }
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
          <Button
            size="md"
            variant="ghost"
            onClick={() => savedViews?.saveAs()}
          >
            Save view
          </Button>
          <Button size="md" variant="ghost" onClick={() => savedViews?.leave()}>
            Cancel
          </Button>
        </Show>
      </HeaderActionGroup>
    </Show>
  );
}

export function TaskSavedViewDialogs() {
  const { state, savedViews, savedViewTeam } = useTasksView();
  const filters = useTaskFilters();
  return (
    <>
      <Show when={savedViews?.form()} keyed>
        {(form) => {
          const selection = () => {
            const config = form.config ?? savedViews?.current();
            return config ? materializeTaskSavedView(config) : state;
          };
          return (
            <SavedViewDialog
              mode={form.mode}
              name={form.name}
              sharedTeamId={form.sharedTeamId}
              team={savedViewTeam?.()}
              pending={savedViews?.saving() ?? false}
              error={savedViews?.error()}
              onClose={() => savedViews?.closeForm()}
              onSave={(name, team) =>
                fireAndForget(
                  savedViews?.save(name, team) ?? Promise.resolve(),
                  'saved-views'
                )
              }
              summary={
                <>
                  <For each={filters.groups()}>
                    {(group) => (
                      <Show when={(selection().facets[group.id] ?? []).length}>
                        <p>
                          {group.label}:{' '}
                          {(selection().facets[group.id] ?? [])
                            .map(
                              (id) =>
                                group.options.find((option) => option.id === id)
                                  ?.label ?? 'Unavailable option'
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
              }
            />
          );
        }}
      </Show>
      <ConfirmDialog
        open={savedViews?.deleting() ?? false}
        onOpenChange={(open) => {
          if (!open) savedViews?.cancelDelete();
        }}
        title="Delete saved view?"
        body={
          <>
            <p>
              This removes the view for you and anyone it is shared with. Tasks
              are not deleted.
            </p>
            <Show when={savedViews?.error()}>
              <p role="alert">{savedViews?.error()}</p>
            </Show>
          </>
        }
        confirmLabel="Delete view"
        tone="danger"
        pending={savedViews?.saving()}
        onConfirm={() =>
          fireAndForget(
            savedViews?.remove() ?? Promise.resolve(),
            'saved-views'
          )
        }
      />
    </>
  );
}

export function TaskSavedViewStatus() {
  const { savedViews } = useTasksView();
  return (
    <Show
      when={
        savedViews?.error() && !savedViews?.form() && !savedViews?.deleting()
      }
    >
      <div
        class="flex flex-wrap items-center gap-2 px-4 py-2 text-sm text-failure-ink"
        role="alert"
      >
        <span>{savedViews?.error()}</span>
        <Show when={savedViews?.conflict()}>
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
          onClick={() => savedViews?.duplicate()}
        >
          Duplicate
        </Button>
      </div>
    </Show>
  );
}
