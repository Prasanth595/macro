import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposeProvider } from '../context/compose-context';
import { createComposeContext } from '../tests/capabilities';
import { mountEmailComposer } from '../tests/composer';
import { ComposeSubject } from './compose-subject';

vi.mock('@ui', async () => ({
  cn: (await import('@ui/utils/classname')).cn,
}));

afterEach(cleanup);

function renderSubject(initialInboxId: 'gmail' | 'outlook', subject: string) {
  const context = createComposeContext();
  context.accounts.inboxes = () => [
    {
      id: 'gmail',
      email_address: 'me@gmail.test',
      provider: 'GMAIL',
      settings: {},
    },
    {
      id: 'outlook',
      email_address: 'me@outlook.test',
      provider: 'OUTLOOK',
      settings: {},
    },
  ];
  const root = mountEmailComposer(context, undefined, {
    initialInboxId,
    initialSubject: subject,
  });
  render(() => (
    <ComposeProvider
      value={{
        ...root.state.context,
        bodyActions: {
          recipientAdded: vi.fn(),
          readDroppedFiles: vi.fn(),
          insertFiles: vi.fn(),
        },
        isMobile: () => false,
        scheduleEnabled: true,
      }}
    >
      <ComposeSubject />
    </ComposeProvider>
  ));
  const input = screen.getByPlaceholderText('Subject') as HTMLInputElement;
  return { root, input };
}

function overLimitHint(input: HTMLInputElement) {
  if (input.getAttribute('aria-invalid') !== 'true') return undefined;
  const id = input.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent?.trim() : undefined;
}

describe('ComposeSubject provider subject limit', () => {
  it('flags an Outlook subject over 255 characters without cutting it', () => {
    const subject = 'a'.repeat(300);
    const { root, input } = renderSubject('outlook', subject);
    try {
      expect(overLimitHint(input)).toBeTruthy();
      expect(input.value).toBe(subject);
      expect(root.state.context.subject()).toBe(subject);
    } finally {
      root.dispose();
    }
  });

  it('accepts an Outlook subject of exactly 255 characters', () => {
    const { root, input } = renderSubject('outlook', 'a'.repeat(255));
    try {
      expect(overLimitHint(input)).toBeUndefined();
    } finally {
      root.dispose();
    }
  });

  it('leaves a long Gmail subject alone', () => {
    const { root, input } = renderSubject('gmail', 'a'.repeat(300));
    try {
      expect(overLimitHint(input)).toBeUndefined();
    } finally {
      root.dispose();
    }
  });

  it('flags a long subject once the sender switches from Gmail to Outlook', async () => {
    const { root, input } = renderSubject('gmail', 'a'.repeat(300));
    try {
      root.state.context.onSelectInbox?.('outlook');
      await waitFor(() =>
        expect(root.state.context.selectedInboxId?.()).toBe('outlook')
      );
      expect(overLimitHint(input)).toBeTruthy();
    } finally {
      root.dispose();
    }
  });
});
