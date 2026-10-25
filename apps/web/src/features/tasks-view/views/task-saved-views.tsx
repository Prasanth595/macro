import { replacePaneSearchParams } from '@app/lib/split-router';
import { HeaderActionGroup } from '@components/app/HeaderActionGroup';
import { toast } from '@core/component/Toast/Toast';
import { useUserId } from '@core/context/user';
import { writeClipboardData } from '@core/util/dataTransfer';
import { fireAndForget } from '@core/util/fireAndForget';
import DotsIcon from '@phosphor/dots-three.svg';
import { Button, Dropdown } from '@ui';
import { createEffect, For, on, onCleanup, Show } from 'solid-js';
import {
  SavedViewList,
  SavedViewListRow,
} from '../../saved-views/components/saved-view-list';
import { SavedViewMenuItems } from '../../saved-views/components/saved-view-menu';
import { SavedViewPicker } from '../../saved-views/components/saved-view-picker';
import type { SavedView } from '../../saved-views/core/saved-view';
import { useSavedViewDialogs } from '../../saved-views/views/use-saved-view-dialogs';
import { materializeTaskSavedView } from '../filters/task-saved-view';
import { useTaskFilters } from '../filters/use-task-filters';
import type { SavedViewForm } from '../primitives/create-task-saved-views';
import { tasksTabSearch, tasksTabSearchCodec } from '../tasks-tab-search';
import { useTasksView } from '../tasks-view-context';

function useTaskSavedViewDialogs() {
  const { state, savedViews, savedViewTeam } = useTasksView();
  const viewerId = useUserId();
  const filters = useTaskFilters();
  const dialogs = useSavedViewDialogs<SavedViewForm>({
    team: () => savedViewTeam?.(),
    pending: () => savedViews?.saving() ?? false,
    error: () => savedViews?.error(),
    summary: (form) => {
      const config = form.config ?? savedViews?.current();
      const selection = config ? materializeTaskSavedView(config) : state;
      return (
        <>
          <For each={filters.groups()}>
            {(group) => (
              <Show when={(selection.facets[group.id] ?? []).length}>
                <p>
                  {group.label}:{' '}
                  {(selection.facets[group.id] ?? [])
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
      );
    },
    save: (form, name, team) =>
      savedViews?.save(name, team, form) ?? Promise.resolve(false),
    remove: (record) => savedViews?.remove(record) ?? Promise.resolve(false),
    holdEditing: () => savedViews?.holdEditing() ?? (() => {}),
  });
  createEffect(
    on(
      () => [viewerId(), savedViews?.selectedId(), state.tab] as const,
      (_next, previous) => {
        if (previous) dialogs.close();
      }
    )
  );
  return {
    form: (mode: SavedViewForm['mode'], record?: SavedView) => {
      const form = savedViews?.prepareForm(mode, record);
      if (form) dialogs.form(form);
    },
    delete: (record?: SavedView) => {
      const target = record ?? savedViews?.record();
      if (target && target.ownerId === viewerId() && !savedViews?.saving()) {
        savedViews?.clearError();
        dialogs.delete(target);
      }
    },
  };
}

export function TaskSavedViewsList(props: {
  onAction?: (action: () => void) => void;
  dialogs?: ReturnType<typeof useTaskSavedViewDialogs>;
}) {
  const {
    savedViews,
    savedViewTeam,
    isSidebarSectionOpen,
    setSidebarSectionOpen,
  } = useTasksView();
  const viewerId = useUserId();
  const localDialogs = useTaskSavedViewDialogs();
  const dialogs = props.dialogs ?? localDialogs;
  const run = (action: () => void) =>
    props.onAction ? props.onAction(action) : action();
  return (
    <Show when={savedViews}>
      {(views) => (
        <SavedViewList
          items={views().source.items()}
          loading={views().source.loading()}
          failed={Boolean(views().source.error())}
          open={isSidebarSectionOpen('saved-views')}
          onOpenChange={(open) => setSidebarSectionOpen('saved-views', open)}
          hasMore={views().source.hasMore()}
          loadingMore={views().source.loadingMore()}
          row={(view) => (
            <SavedViewListRow
              view={view}
              selected={view.id === views().record()?.id}
              scopeKey={viewerId()}
              onSelect={() => run(() => views().select(view.id))}
              menu={(context, defer) => (
                <SavedViewMenuItems
                  context={context}
                  owned={view.ownerId === viewerId()}
                  canShare={Boolean(savedViewTeam?.() || view.sharedTeamId)}
                  disabled={views().saving()}
                  onRename={() =>
                    defer(() => run(() => dialogs.form('rename', view)))
                  }
                  onShare={() =>
                    defer(() => run(() => dialogs.form('share', view)))
                  }
                  onDuplicate={() =>
                    defer(() => run(() => dialogs.form('duplicate', view)))
                  }
                  onCopyLink={() =>
                    fireAndForget(copySavedViewLink(view.id), 'saved-views')
                  }
                  onDelete={() => defer(() => run(() => dialogs.delete(view)))}
                />
              )}
            />
          )}
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
  const dialogs = useTaskSavedViewDialogs();
  return (
    <Show when={savedViews}>
      {(views) => (
        <SavedViewPicker
          scopeKey={viewerId()}
          label={views().active() ? views().title() : 'Saved views'}
        >
          {(onAction) => (
            <TaskSavedViewsList onAction={onAction} dialogs={dialogs} />
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
  const copied = await writeClipboardData({ 'text/plain': url.toString() });
  if (!copied) toast.failure('Could not copy link');
  else toast.success('Link copied');
}

export function TaskSaveViewButton() {
  const { savedViews } = useTasksView();
  const dialogs = useTaskSavedViewDialogs();
  return (
    <Show
      when={savedViews && !savedViews.active() && savedViews.changedFromBase()}
    >
      <HeaderActionGroup label="Save task filters">
        <Button
          size="md"
          variant="ghost"
          onClick={() => dialogs.form('create')}
        >
          Save view
        </Button>
      </HeaderActionGroup>
    </Show>
  );
}

export function TaskSavedViewMenu() {
  const { savedViews, savedViewTeam } = useTasksView();
  const viewerId = useUserId();
  const dialogs = useTaskSavedViewDialogs();
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
              onRename={() => defer(() => dialogs.form('rename'))}
              onShare={() => defer(() => dialogs.form('share'))}
              onDuplicate={() => defer(() => dialogs.form('duplicate'))}
              onCopyLink={() => {
                const id = savedViews?.record()?.id;
                if (id) fireAndForget(copySavedViewLink(id), 'saved-views');
              }}
              onDelete={() => defer(() => dialogs.delete())}
            />
          </Dropdown.Content>
        </Dropdown>
      </HeaderActionGroup>
    </Show>
  );
}

export function TaskSavedViewActions() {
  const { savedViews } = useTasksView();
  const dialogs = useTaskSavedViewDialogs();
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
            onClick={() => dialogs.form('create')}
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

export function TaskSavedViewStatus() {
  const { savedViews } = useTasksView();
  const dialogs = useTaskSavedViewDialogs();
  return (
    <Show when={savedViews?.error()}>
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
          onClick={() => dialogs.form('duplicate')}
        >
          Duplicate
        </Button>
      </div>
    </Show>
  );
}
