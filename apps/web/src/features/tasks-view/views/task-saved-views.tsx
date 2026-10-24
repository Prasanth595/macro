import { replacePaneSearchParams } from '@app/lib/split-router';
import { HeaderActionGroup } from '@components/app/HeaderActionGroup';
import { MobileDrawer } from '@components/app/mobile/MobileDrawer';
import { toast } from '@core/component/Toast/Toast';
import { writeClipboardData } from '@core/util/dataTransfer';
import { fireAndForget } from '@core/util/fireAndForget';
import BookmarkIcon from '@phosphor/bookmark-simple.svg';
import DotsIcon from '@phosphor/dots-three.svg';
import { Button, ConfirmDialog, Dropdown } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { SavedViewDialog } from '../../saved-views/components/saved-view-dialog';
import { SavedViewList } from '../../saved-views/components/saved-view-list';
import { useTaskFilters } from '../filters/use-task-filters';
import { tasksTabSearch, tasksTabSearchCodec } from '../tasks-tab-search';
import { useTasksView } from '../tasks-view-context';

export function TaskSavedViewsList(props: { onNavigate?: () => void }) {
  const { savedViews, isSidebarSectionOpen, setSidebarSectionOpen } =
    useTasksView();
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
          onSelect={(id) => {
            views().select(id);
            props.onNavigate?.();
          }}
          onCreate={() => {
            views().start();
            props.onNavigate?.();
          }}
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
  const [open, setOpen] = createSignal(false);
  return (
    <Show when={savedViews}>
      {(views) => (
        <MobileDrawer open={open()} onOpenChange={setOpen} restoreFocus>
          <MobileDrawer.Trigger
            as={Button}
            size="icon-md"
            variant="outline"
            depth={3}
            label={views().active() ? views().title() : 'Saved views'}
          >
            <BookmarkIcon class="size-4" />
          </MobileDrawer.Trigger>
          <MobileDrawer.Portal>
            <MobileDrawer.Overlay />
            <MobileDrawer.Content>
              <MobileDrawer.Handle />
              <MobileDrawer.Title class="px-6 pb-3 text-base font-medium">
                Saved views
              </MobileDrawer.Title>
              <MobileDrawer.ScrollBody class="px-3">
                <TaskSavedViewsList onNavigate={() => setOpen(false)} />
              </MobileDrawer.ScrollBody>
            </MobileDrawer.Content>
          </MobileDrawer.Portal>
        </MobileDrawer>
      )}
    </Show>
  );
}

export function TaskSavedViewActions() {
  const { savedViews } = useTasksView();
  const copyLink = async () => {
    const id = savedViews?.record()?.id;
    if (!id) return;
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
  };
  return (
    <Show when={savedViews?.active() && savedViews?.ready()}>
      <HeaderActionGroup label="Saved view actions">
        <Show
          when={savedViews?.creating()}
          fallback={
            <>
              <Show when={savedViews?.dirty()}>
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
              </Show>
              <Dropdown placement="bottom-end">
                <Dropdown.Trigger
                  size="icon-md"
                  variant="ghost"
                  label="Saved view actions"
                >
                  <DotsIcon class="size-4" />
                </Dropdown.Trigger>
                <Dropdown.Content>
                  <Show when={savedViews?.owned()}>
                    <Dropdown.Item onSelect={() => savedViews?.manage()}>
                      Rename or share
                    </Dropdown.Item>
                  </Show>
                  <Dropdown.Item onSelect={() => savedViews?.saveAs()}>
                    Save as new
                  </Dropdown.Item>
                  <Dropdown.Item
                    onSelect={() => fireAndForget(copyLink(), 'saved-views')}
                  >
                    Copy link
                  </Dropdown.Item>
                  <Show when={savedViews?.owned()}>
                    <Dropdown.Item onSelect={() => savedViews?.confirmDelete()}>
                      Delete view
                    </Dropdown.Item>
                  </Show>
                </Dropdown.Content>
              </Dropdown>
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
        {(form) => (
          <SavedViewDialog
            title={
              form.mode === 'create' ? 'Save task view' : 'Edit saved view'
            }
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
                <p>
                  Scope:{' '}
                  {state.tab === 'my-tasks'
                    ? 'Assigned to me (each viewer)'
                    : state.tab === 'created-by-me'
                      ? 'Created by me (each viewer)'
                      : 'All tasks'}
                </p>
                <For
                  each={filters
                    .groups()
                    .filter((group) => group.id !== 'scope')}
                >
                  {(group) => (
                    <Show when={(state.facets[group.id] ?? []).length}>
                      <p>
                        {group.label}:{' '}
                        {(state.facets[group.id] ?? [])
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
        )}
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
        <Button size="sm" variant="ghost" onClick={() => savedViews?.saveAs()}>
          Save as new
        </Button>
      </div>
    </Show>
  );
}
