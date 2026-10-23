/**
 * @vitest-environment jsdom
 */

import type { Link as EmailLink } from '@service-email/generated/schemas';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toastCustom: vi.fn(),
  toastDismiss: vi.fn(),
  startAddInbox: vi.fn(),
}));

const [userId, setUserId] = createSignal<string | undefined>('macro|self');
const [links, setLinks] = createSignal<EmailLink[]>([]);

vi.mock('@core/component/Toast/Toast', () => ({
  toast: {
    custom: mocks.toastCustom,
    dismiss: mocks.toastDismiss,
  },
}));

vi.mock('@core/mobile/isMobile', () => ({ isMobile: () => false }));

vi.mock('@app/features/calendar/hooks/use-calendar-ui-flag', () => ({
  useCalendarUiFlag: () => () => true,
  useCalendarPromptAllowed: () => () => true,
}));

vi.mock('@core/context/user', () => ({ useUserId: () => userId }));

vi.mock('@core/email-link', () => ({
  useAddInboxFlow: () => mocks.startAddInbox,
}));

vi.mock('@queries/email/link', () => ({
  useEmailLinksQuery: () => ({
    isSuccess: true,
    get data() {
      return { links: links() };
    },
  }),
}));

import { CalendarPermissionPrompt } from './CalendarPermissionPrompt';

const PERSIST_KEY = 'macro:calendar-prompt:dismissed';

type ToastConfig = {
  title: string;
  content: () => string;
  actions: { label: string; onClick: () => void }[];
};

const link = (id: string, overrides: Partial<EmailLink> = {}): EmailLink =>
  ({
    id,
    provider: 'GMAIL',
    macro_id: 'macro|self',
    email_address: `${id}@example.com`,
    needs_calendar_permission: true,
    needs_reauth: false,
    calendar_disabled: false,
    has_calendar_data: false,
    is_primary: false,
    ...overrides,
  }) as unknown as EmailLink;

function promptedText(): string[] {
  return mocks.toastCustom.mock.calls.map(([config]) =>
    (config as ToastConfig).content()
  );
}

function renderPrompt(): () => void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(() => <CalendarPermissionPrompt />, container);
  return () => {
    dispose();
    container.remove();
  };
}

beforeEach(() => {
  let nextToastId = 1;
  mocks.toastCustom.mockImplementation(() => nextToastId++);
  mocks.startAddInbox.mockResolvedValue(undefined);
  localStorage.clear();
  setUserId('macro|self');
  setLinks([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CalendarPermissionPrompt', () => {
  it('asks only for the viewer’s own inbox, never for one another user delegated', () => {
    setLinks([
      link('own'),
      link('delegated', { macro_id: 'macro|someone-else' }),
    ]);
    const cleanup = renderPrompt();

    expect(promptedText()).toEqual([
      'Macro can now sync your calendar. Grant calendar access for own@example.com to turn it on.',
    ]);

    const config = mocks.toastCustom.mock.calls[0]?.[0] as ToastConfig;
    config.actions.find((action) => action.label === 'Grant access')?.onClick();
    expect(mocks.startAddInbox).toHaveBeenCalledWith({
      scopes: 'calendar',
      provider: 'GMAIL',
      reconnectLinkId: 'own',
      emailAddress: 'own@example.com',
    });
    cleanup();
  });

  it('stays quiet when the only inbox missing calendar is delegated', () => {
    setLinks([
      link('own', { needs_calendar_permission: false }),
      link('delegated', { macro_id: 'macro|someone-else' }),
    ]);
    const cleanup = renderPrompt();

    expect(mocks.toastCustom).not.toHaveBeenCalled();
    cleanup();
  });

  it('keeps a closed prompt closed while the viewer is still loading', () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(['own']));
    setUserId(undefined);
    setLinks([link('own')]);
    const cleanup = renderPrompt();

    setUserId('macro|self');

    expect(mocks.toastCustom).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(PERSIST_KEY) ?? '[]')).toEqual([
      'own',
    ]);
    cleanup();
  });
});
