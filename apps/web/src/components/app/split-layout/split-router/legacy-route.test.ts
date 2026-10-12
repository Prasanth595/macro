import {
  createRoutesManifest,
  decodePane,
  formatPanePath,
  type SplitRoutes,
} from '@app/lib/split-router';
import {
  appRoute,
  bookingLinksRoute,
  homeSplitRoute,
  legacyContentRoute,
  notFoundRoute,
} from '@app/routes/routes';
import { describe, expect, it, vi } from 'vitest';
import {
  splitContentFromLocation,
  splitLocationFromContent,
  upgradeLegacyPath,
} from './legacy-route';

vi.mock('@components/app/split-layout/componentRegistry', () => ({
  resolveComponent: vi.fn(() => ({ type: 'mock-component' })),
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

const routes = createRoutesManifest({
  definitions: [
    {
      ...appRoute,
      children: [
        homeSplitRoute,
        bookingLinksRoute,
        legacyContentRoute,
        notFoundRoute,
      ],
    },
  ],
  defaultRoute: () => ({ matches: [{ id: 'view-home', params: {} }] }),
} satisfies SplitRoutes);

describe('upgradeLegacyPath', () => {
  it('sends the retired Getting Started path to Home', () => {
    expect(upgradeLegacyPath(routes, '/getting-started')).toBe('/home');
  });
});

describe('Scheduling workspace routing', () => {
  it('round-trips the Scheduling URL through the existing workspace component', () => {
    const content = { type: 'component' as const, id: 'booking-links' };
    const location = splitLocationFromContent(routes, content);
    expect(formatPanePath(routes, location.route)).toBe('/scheduling');
    const decoded = decodePane(routes, ['scheduling']);
    expect(decoded).toEqual(location.route);
    expect(splitContentFromLocation({ route: decoded! })).toEqual(content);
    expect(decodePane(routes, ['calendar', 'booking-links'])).not.toEqual(
      location.route
    );
  });
});
