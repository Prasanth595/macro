import {
  createMemoryHistory,
  createMemoryPaneStore,
  createSplitRouter,
  type Entry,
  type SplitRoutes,
} from '@app/lib/split-router';
import { paneRoute } from '@app/routes/app-route';
import {
  agentsRoute,
  agentsViewRoute,
  appRoute,
  calendarSplitRoute,
  channelDetailRoute,
  channelsSplitRoute,
  driveSplitRoute,
  driveTabRoute,
  homeSplitRoute,
  notFoundRoute,
  searchRoute,
} from '@app/routes/routes';
import type { BlockOrchestrator } from '@core/orchestrator';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSplitLayout,
  type SplitContent,
} from '../split-layout/layoutManager';
import { createAppPanePolicy } from '../split-layout/split-router/app-pane-policy';
import {
  resolveContentLocation,
  splitContentFromLocation,
} from '../split-layout/split-router/legacy-route';
import { createViewSession } from './create-view-session';

vi.mock('../split-layout/componentRegistry', () => ({
  resolveComponent: () => ({ element: () => null, initialMeta: {} }),
}));
vi.mock('@core/constant/allBlocks', () => ({
  isBlockAlias: () => false,
  resolveBlockAlias: (type: string) => type,
}));
vi.mock('@service-storage/websocket', () => ({
  storageWS: { reconnectIfDisconnected: vi.fn() },
  createWebSocketJob: vi.fn(),
}));
vi.mock('@service-connection/websocket', () => ({
  ws: { addEventListener: vi.fn(), send: vi.fn() },
  state: () => 'closed',
  createConnectionBlockWebsocketEffect: vi.fn(),
  createConnectionWebsocketEffect: vi.fn(),
}));

const channels: SplitContent = { type: 'component', id: 'channels' };
const home: SplitContent = { type: 'component', id: 'home' };
const documents: SplitContent = { type: 'component', id: 'documents' };
const routes: SplitRoutes = {
  definitions: [
    {
      ...appRoute,
      children: [
        homeSplitRoute,
        agentsRoute,
        agentsViewRoute,
        calendarSplitRoute,
        { ...channelsSplitRoute, children: [channelDetailRoute] },
        { ...driveSplitRoute, children: [driveTabRoute] },
        searchRoute,
        notFoundRoute,
      ],
    },
  ],
  defaultRoute: () => paneRoute({ id: 'view-home', params: {} }),
};
const disposers: (() => void)[] = [];

function setup(
  url = '/channels/channel-one',
  stacked = false,
  initialAccount: string | null = 'account-one'
) {
  return createRoot((dispose) => {
    disposers.push(dispose);
    const history = createMemoryHistory(url);
    const [accountId, setAccountId] = createSignal<string | undefined>(
      initialAccount ?? undefined
    );
    let manager: ReturnType<typeof createSplitLayout> | undefined;
    const router = createSplitRouter({
      routes,
      history,
      paneStore: createMemoryPaneStore<Entry>(),
      policy: createAppPanePolicy({
        manager: () => manager,
        toContent: splitContentFromLocation,
        defaultLocation: () => ({ route: routes.defaultRoute() }),
        stacked: () => stacked,
      }),
    });
    const orchestrator = {
      isBlockMounted: () => false,
      createBlockInstance: vi.fn(),
    } as unknown as BlockOrchestrator;
    manager = createSplitLayout(orchestrator, {
      router,
      toLocation: (content) => resolveContentLocation(router.routes, content),
      toContent: splitContentFromLocation,
      stacked: () => stacked,
    });
    const session = createViewSession({ router, manager, accountId });
    return { router, manager, session, setAccountId };
  });
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

describe('view session navigation', () => {
  it('restores a nested detail, search, and captured local state after switching views', async () => {
    const { router, manager, session } = setup();
    const pane = router.panes()[0]!;
    await router.updateSearch(pane, 'channels', { tab: ['unread'] });
    const stop = manager
      .activeSplit()!
      .registerEntryStateCaptor('channels.scroll', () => ({ offset: 420 }));

    session.openView(home);
    await router.settled();
    stop();
    session.openView(channels);
    await router.settled();

    expect(router.entry(pane)?.location.route.matches.at(-1)).toMatchObject({
      id: 'channels-channel',
      params: { channelId: 'channel-one' },
    });
    expect(router.entry(pane)?.location.search).toEqual({
      channels: { tab: ['unread'] },
    });
    expect(manager.activeSplit()?.currentEntryState()).toEqual({
      'channels.scroll': { offset: 420 },
    });
    expect(manager.activeSplit()?.canGoBack()).toBe(true);

    const stopSelection = manager
      .activeSplit()!
      .registerEntryStateCaptor('channels.selection', () => ['message-one']);
    session.openView(home);
    await router.settled();
    stopSelection();
    session.openView(channels);
    await router.settled();
    expect(manager.activeSplit()?.currentEntryState()).toEqual({
      'channels.scroll': { offset: 420 },
      'channels.selection': ['message-one'],
    });
  });

  it('remembers a closed detail instead of reviving an older selection', async () => {
    const { router, manager, session } = setup();
    const pane = router.panes()[0]!;
    await router.navigatePane(pane, '/channels/channel-two');
    await router.navigatePane(pane, '/channels');
    session.openView(home);
    await router.settled();
    session.openView(channels);
    await router.settled();

    expect(router.entry(pane)?.location.route.matches.at(-1)?.id).toBe(
      'view-channels'
    );
    expect(manager.activeSplit()?.content().id).toBe('channels');
  });

  it('captures departures outside sidebar navigation and respects explicit deep links', async () => {
    const { router, session } = setup();
    const pane = router.panes()[0]!;
    await router.navigatePane(pane, '/home');
    session.openView(channels);
    await router.settled();
    expect(
      router.entry(pane)?.location.route.matches.at(-1)?.params.channelId
    ).toBe('channel-one');

    await router.navigatePane(pane, '/channels/channel-two');
    await router.navigatePane(pane, '/home');
    session.openView(channels);
    await router.settled();
    expect(
      router.entry(pane)?.location.route.matches.at(-1)?.params.channelId
    ).toBe('channel-two');
  });

  it('starts explicit new splits at the requested view root', async () => {
    const { router, session } = setup();
    session.openView(home);
    await router.settled();
    session.openView(channels, { preferNewSplit: true, allowDuplicate: true });
    await router.settled();

    expect(router.panes()).toHaveLength(2);
    const newPane = router.panes()[1]!;
    expect(router.entry(newPane)?.location.route.matches.at(-1)?.id).toBe(
      'view-channels'
    );
  });

  it('retains a Drive tab and schema-validated route state', async () => {
    const { router, session } = setup('/drive/recent');
    const pane = router.panes()[0]!;
    session.openView(home);
    await router.settled();
    session.openView(documents);
    await router.settled();
    expect(router.entry(pane)?.location.route.matches.at(-1)).toMatchObject({
      id: 'drive-tab',
      params: { tab: 'recent' },
    });

    await router.navigatePane(pane, '/search', {
      state: { sessionId: 'search-session-one' },
    });
    session.openView(home);
    await router.settled();
    session.openView({ type: 'component', id: 'search' });
    await router.settled();
    expect(router.entry(pane)?.state).toEqual({
      sessionId: 'search-session-one',
    });
  });

  it('restores Calendar period and event focus alongside an Agents conversation', async () => {
    const { router, session } = setup('/calendar/month');
    const pane = router.panes()[0]!;
    await router.updateSearch(pane, 'calendar', { eventId: ['event-one'] });
    session.openView({ type: 'component', id: 'agents' });
    await router.settled();
    await router.navigatePane(pane, '/agents/session-one');
    session.openView({ type: 'component', id: 'calendar' });
    await router.settled();
    expect(
      router.entry(pane)?.location.route.matches.at(-1)?.params.period
    ).toBe('dayGridMonth');
    expect(router.entry(pane)?.location.search?.calendar?.eventId).toEqual([
      'event-one',
    ]);
    session.openView({ type: 'component', id: 'agents' });
    await router.settled();
    expect(router.entry(pane)?.location.route.matches.at(-1)).toMatchObject({
      id: 'agents',
      params: { id: 'session-one' },
    });
  });
  it('restores native dock destinations after their original panes are removed', async () => {
    const { router, manager, session } = setup('/channels/channel-one', true);
    const originalEntryId = router.entry(router.panes()[0]!)!.id;
    const stop = manager
      .activeSplit()!
      .registerEntryStateCaptor('channels.selection', () => ['message-one']);
    session.openView(home);
    await router.settled();
    stop();
    session.replaceView(documents);
    await router.settled();
    await router.removeEntries(
      router.panes()[0]!,
      (entry) => entry.id === originalEntryId
    );
    expect(
      router
        .panes()
        .flatMap(
          (pane) => router.history(pane)?.entries.map((entry) => entry.id) ?? []
        )
    ).not.toContain(originalEntryId);

    session.replaceView(channels);
    await router.settled();
    expect(router.panes()).toHaveLength(1);
    const pane = router.panes()[0]!;
    expect(
      router.entry(pane)?.location.route.matches.at(-1)?.params.channelId
    ).toBe('channel-one');
    expect(manager.activeSplit()?.currentEntryState()).toEqual({
      'channels.selection': ['message-one'],
    });
  });

  it('does not share state across accounts or recapture an old account entry', async () => {
    const { router, session, setAccountId } = setup();
    const pane = router.panes()[0]!;
    session.openView(home);
    await router.settled();
    setAccountId('account-two');
    session.openView(channels);
    await router.settled();
    expect(router.entry(pane)?.location.route.matches.at(-1)?.id).toBe(
      'view-channels'
    );

    await router.navigatePane(pane, '/channels/account-two-channel');
    setAccountId('account-three');
    session.openView(home);
    await router.settled();
    session.openView(channels);
    await router.settled();
    expect(router.entry(pane)?.location.route.matches.at(-1)?.id).toBe(
      'view-channels'
    );
  });

  it('starts remembering the initial view when authentication resolves', async () => {
    const { router, session, setAccountId } = setup(
      '/channels/channel-one',
      false,
      null
    );
    const pane = router.panes()[0]!;
    setAccountId('account-one');
    session.openView(home);
    await router.settled();
    session.openView(channels);
    await router.settled();
    expect(
      router.entry(pane)?.location.route.matches.at(-1)?.params.channelId
    ).toBe('channel-one');
  });

  it('retires old entries after sign-out even when the same account signs back in', async () => {
    const { router, session, setAccountId } = setup();
    const pane = router.panes()[0]!;
    setAccountId(undefined);
    setAccountId('account-one');
    session.openView(home);
    await router.settled();
    session.openView(channels);
    await router.settled();
    expect(router.entry(pane)?.location.route.matches.at(-1)?.id).toBe(
      'view-channels'
    );
  });

  it('activates an existing detail owner instead of duplicating the restored entity', async () => {
    const { router, manager, session } = setup();
    const source = router.panes()[0]!;
    const sourceSplit = manager.activeSplit()!;
    session.openView(home);
    await router.settled();
    await router.open('/channels/channel-one', { newPane: true, source });
    const owner = router.panes()[1]!;
    sourceSplit.activate();
    session.openView(channels, { allowDuplicate: true });
    await router.settled();
    expect(router.panes()).toHaveLength(2);
    expect(manager.activeSplit()?.id).toBe(owner);
    expect(router.entry(source)?.location.route.matches.at(-1)?.id).toBe(
      'view-home'
    );
  });

  it('captures the latest context when split focus changes without navigation', async () => {
    const { router, manager, session } = setup();
    const channelsPane = router.panes()[0]!;
    const channelsSplit = manager.activeSplit()!;
    session.openView(home, { preferNewSplit: true });
    await router.settled();
    const homeSplit = manager.activeSplit()!;
    channelsSplit.activate();
    await router.navigatePane(channelsPane, '/channels/channel-two');
    homeSplit.activate();
    session.openView(channels, { allowDuplicate: true });
    await router.settled();
    expect(manager.activeSplit()?.id).toBe(channelsPane);
    expect(
      router.entry(channelsPane)?.location.route.matches.at(-1)?.params
        .channelId
    ).toBe('channel-two');
    expect(router.panes()).toHaveLength(2);
  });

  it('keeps guards authoritative when a restored navigation is refused', async () => {
    const { router, session } = setup();
    const pane = router.panes()[0]!;
    session.openView(home);
    await router.settled();
    router.registerGuard(pane, Number.MAX_SAFE_INTEGER, () => false);
    session.openView(channels);
    await router.settled();
    expect(router.entry(pane)?.location.route.matches.at(-1)?.id).toBe(
      'view-home'
    );
  });
});
