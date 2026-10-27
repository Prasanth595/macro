/** @vitest-environment jsdom */
import { cleanup, render } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calendarSyncIssue } from '../utils/calendar-sync-issue';

const mocks = vi.hoisted(() => ({ custom: vi.fn(() => 1), dismiss: vi.fn() }));
vi.mock('@core/component/Toast/Toast', () => ({ toast: mocks }));

import {
  CalendarSyncNotifications,
  type CalendarSyncWarning,
} from './CalendarSyncNotifications';

const warning: CalendarSyncWarning = {
  id: 'calendar-1',
  name: 'Community events',
  emailAddress: 'calendar@example.test',
  issue: calendarSyncIssue(
    'Google Calendar snapshot could not be fully normalized'
  ),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CalendarSyncNotifications', () => {
  it('does not resurrect stale failures when the host that confirmed recovery closes', () => {
    const [healthyHost, setHealthyHost] = createSignal(true);
    render(() => (
      <>
        <Show when={healthyHost()}>
          <CalendarSyncNotifications
            viewerId="viewer-one"
            warnings={[]}
            loaded
          />
        </Show>
        <CalendarSyncNotifications
          viewerId="viewer-one"
          warnings={[warning]}
          loaded={false}
        />
      </>
    ));
    expect(mocks.custom).not.toHaveBeenCalled();
    setHealthyHost(false);
    expect(mocks.custom).not.toHaveBeenCalled();
  });

  it('can show cached warnings after an initially unanswered query', () => {
    const [warnings, setWarnings] = createSignal<CalendarSyncWarning[]>([]);
    render(() => (
      <CalendarSyncNotifications
        viewerId="viewer-one"
        warnings={warnings()}
        loaded={false}
      />
    ));
    expect(mocks.custom).not.toHaveBeenCalled();
    setWarnings([warning]);
    expect(mocks.custom).toHaveBeenCalledTimes(1);
  });
});
