import { parseAgentsRoute } from '@app/features/agents-view/core/route';
import type { Entry, PaneId, SplitRouter } from '@app/lib/split-router';
import { Telemetry } from '@macro-inc/observability';
import {
  type Accessor,
  createComputed,
  mapArray,
  on,
  onCleanup,
  untrack,
} from 'solid-js';
import type { SplitContent, SplitManager } from '../split-layout/layoutManager';

/** Nested routes keep their host identity; Agents encodes conversations in its component id. */
function viewIdOfContent(content: SplitContent): string | undefined {
  if (content.type !== 'component') return;
  return parseAgentsRoute(content.id) ? 'agents' : content.id;
}

type SavedView = {
  content: SplitContent;
  routeState: unknown;
};

/** App-session navigation memory. Views opt into local state through the existing entry-state captors. */
export function createViewSession(options: {
  router: Pick<SplitRouter, 'panes' | 'entry' | 'registerGuard'>;
  manager: Pick<
    SplitManager,
    | 'activeSplit'
    | 'activeSplitId'
    | 'getSplit'
    | 'openWithSplit'
    | 'replaceAllSplits'
  >;
  accountId: Accessor<string | undefined>;
}) {
  const { router, manager, accountId } = options;
  const saved = new Map<string, SavedView>();
  const owners = new Map<
    PaneId,
    { entryId: string; accountId: string | undefined; generation: number }
  >();
  let account = untrack(accountId);
  let generation = 0;
  onCleanup(() => saved.clear());

  // Account changes retire memory even when the layout survives a sign-out.
  createComputed(
    on(accountId, (next) => {
      if (account === next) return;
      saved.clear();
      account = next;
      generation += 1;
    })
  );

  function remember(
    pane: PaneId,
    entry: Entry,
    active = manager.activeSplit()
  ) {
    const owner = owners.get(pane);
    if (
      !account ||
      owner?.accountId !== account ||
      owner.entryId !== entry.id ||
      owner.generation !== generation
    )
      return;
    // A native navigation can remove background panes too. Only the last focused view wins.
    if (active?.id !== pane.toString()) return;
    const viewId = viewIdOfContent(active.content());
    if (!viewId) return;

    active.captureEntryState();
    const content = active.content();
    if (content.type !== 'component') return;
    saved.set(viewId, {
      content: {
        ...content,
        // Do not replay one-shot navigation props, such as a message focus request.
        params: content.preserveParams ? content.params : undefined,
        entryMetadata: entry.location,
      },
      routeState: entry.state,
    });
  }

  const panes = mapArray(router.panes, (pane) => {
    createComputed(
      on(
        () => [router.entry(pane)?.id, accountId()] as const,
        ([entryId, currentAccount]) => {
          if (!entryId) return;
          const previous = owners.get(pane);
          // An unchanged entry still belongs to its original account after an account switch.
          if (previous?.entryId === entryId && previous.accountId !== undefined)
            return;
          owners.set(pane, { entryId, accountId: currentAccount, generation });
        }
      )
    );
    const unregister = router.registerGuard(
      pane,
      Number.MAX_SAFE_INTEGER,
      ({ from }) => {
        remember(pane, from);
        return true;
      }
    );
    onCleanup(() => {
      unregister();
      owners.delete(pane);
    });
    return pane;
  });
  createComputed(panes);

  // Changing split focus also leaves a view, without changing either pane's route.
  createComputed(
    on(manager.activeSplitId, (next, previous) => {
      if (!previous || next === previous) return;
      const pane = router.panes().find((pane) => pane.toString() === previous);
      const entry = pane && router.entry(pane);
      const split = manager.getSplit(previous);
      if (pane && entry && split) remember(pane, entry, split);
    })
  );

  function destination(content: SplitContent): SavedView | undefined {
    const active = manager.activeSplit();
    if (active) {
      const pane = router.panes().find((pane) => pane.toString() === active.id);
      const entry = pane && router.entry(pane);
      if (pane && entry) remember(pane, entry);
    }
    const viewId = viewIdOfContent(content);
    return viewId ? saved.get(viewId) : undefined;
  }

  const openView: SplitManager['openWithSplit'] = (
    content,
    openOptions = {}
  ) => {
    // Explicit split creation starts at the requested destination, not a remembered detail.
    const remembered = destination(content);
    const restored = openOptions.preferNewSplit ? undefined : remembered;
    const span = Telemetry.span('navigation.view.open');
    span.setAttr('view.id', viewIdOfContent(content) ?? content.type);
    span.setAttr('view.restored', restored !== undefined);
    return span.run(() => {
      try {
        return manager.openWithSplit(
          restored?.content ?? content,
          restored
            ? {
                ...openOptions,
                // Send the full saved location through guards, middleware, and content claims.
                search: openOptions.search ?? {},
                // A remembered shell can contain an entity owned by another pane.
                allowDuplicate: false,
                routeState: restored.routeState,
              }
            : openOptions
        );
      } finally {
        span.end();
      }
    });
  };

  const replaceView: SplitManager['replaceAllSplits'] = (
    content,
    replaceOptions = {}
  ) => {
    const restored = destination(content);
    const span = Telemetry.span('navigation.view.open');
    span.setAttr('view.id', viewIdOfContent(content) ?? content.type);
    span.setAttr('view.restored', restored !== undefined);
    return span.run(() => {
      try {
        return manager.replaceAllSplits(
          restored?.content ?? content,
          restored
            ? {
                ...replaceOptions,
                routeState: restored.routeState,
              }
            : replaceOptions
        );
      } finally {
        span.end();
      }
    });
  };

  return { openView, replaceView };
}
