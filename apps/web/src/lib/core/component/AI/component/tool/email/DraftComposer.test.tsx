import { useCompose } from '@app/features/email-compose/context/compose-context';
import type { SendEmail } from '@service-cognition/generated/tools/types';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  replyInboxId: undefined as string | undefined,
  execute: vi.fn(),
  edit: vi.fn(),
}));

vi.mock('@queries/email/link', () => ({
  useEmailLinksQuery: () => ({
    isPending: false,
    data: {
      links: [
        { id: 'primary', email_address: 'primary@example.com' },
        { id: 'secondary', email_address: 'secondary@example.com' },
      ],
    },
  }),
  findPrimaryEmailLinkId: () => 'primary',
  useMessageInboxId: () => () => mocks.replyInboxId,
  useEmailSignature: () => () => undefined,
}));
vi.mock('@core/context/user', () => ({ useUserId: () => () => 'macro|self' }));
vi.mock('@app/lib/analytics/posthog', () => ({
  useFeatureFlag: () => () => ({ enabled: false }),
}));
vi.mock('@core/component/Toast/Toast', () => ({ toast: { failure: vi.fn() } }));
vi.mock('@core/mobile/isMobile', () => ({ isMobile: () => false }));
vi.mock('@core/mobile/isTouchDevice', () => ({ isTouchDevice: () => false }));
vi.mock('@core/util/interceptMailtoLinks', () => ({
  interceptMailtoLinks: vi.fn(),
}));
vi.mock('@core/util/upload', () => ({
  forceDssRuleset: {},
  uploadFile: vi.fn(),
}));
vi.mock('@queries/storage/document-metadata', () => ({
  fetchDocumentMetadata: vi.fn(),
}));
vi.mock('@tanstack/solid-query', () => ({ useQueryClient: () => ({}) }));
vi.mock('@ui', () => ({ ComposerSurface: () => null, cn: () => '' }));
vi.mock('@app/features/email-compose/editor-adapter', () => ({
  createComposeBodyActions: () => ({}),
}));
vi.mock('@app/features/email-compose/components/signature-preview', () => ({
  SignaturePreview: () => null,
}));
vi.mock('@app/features/email-compose/views/compose-toolbar', () => ({
  EmailComposeToolbar: () => null,
}));
vi.mock('@app/features/email-compose/primitives/prepare-email-body', () => ({
  prepareEmailBody: () => ({ bodyHtml: 'Reply body', bodyText: 'Reply body' }),
}));
vi.mock('@app/features/email-compose/views/compose-layout', () => ({
  ComposeLayout: () => {
    const compose = useCompose();
    return (
      <>
        <output aria-label="From">{compose.fromAddress?.()}</output>
        <button onClick={() => compose.onSelectInbox?.('secondary')}>
          Choose secondary
        </button>
        <button onClick={() => compose.setSubject('Edited reply')}>
          Edit subject
        </button>
        <button onClick={() => compose.onSend()}>Send</button>
      </>
    );
  },
}));

import { EmailDraftComposer } from './DraftComposer';

function showDraft(from?: string) {
  const draft: SendEmail = {
    to: [{ email: 'recipient@example.com' }],
    subject: 'Reply',
    body: 'Reply body',
    replyingToId: 'received-in-secondary',
    from,
  };
  render(() => (
    <EmailDraftComposer
      initialData={draft}
      debugName="sending-inbox-test"
      sink={{
        canAct: () => true,
        lockedNotice: () => undefined,
        onExecute: mocks.execute,
        onEdit: mocks.edit,
        onReject: async () => true,
      }}
    />
  ));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.replyInboxId = undefined;
  mocks.execute.mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it.each([undefined, '   '])(
  'leaves an implicit sender to the backend when the reply inbox is unavailable (from: %j)',
  async (from) => {
    showDraft(from);
    expect(screen.getByLabelText('From').textContent).toBe(
      'primary@example.com'
    );
    await fireEvent.click(screen.getByText('Send'));
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ from: undefined })
    );
  }
);

it('does not persist the fallback sender when editing before the reply inbox resolves', async () => {
  vi.useFakeTimers();
  showDraft();
  await fireEvent.click(screen.getByText('Edit subject'));
  vi.runAllTimers();
  expect(mocks.edit).toHaveBeenCalledWith(
    expect.objectContaining({ subject: 'Edited reply', from: undefined })
  );
});

it('leaves a resolved implicit reply sender to the backend', async () => {
  mocks.replyInboxId = 'secondary';
  showDraft();
  expect(screen.getByLabelText('From').textContent).toBe(
    'secondary@example.com'
  );
  await fireEvent.click(screen.getByText('Send'));
  expect(mocks.execute).toHaveBeenCalledWith(
    expect.objectContaining({ from: undefined })
  );
});

it('preserves the sender named in the draft', async () => {
  showDraft('secondary@example.com');
  await fireEvent.click(screen.getByText('Send'));
  expect(mocks.execute).toHaveBeenCalledWith(
    expect.objectContaining({ from: 'secondary@example.com' })
  );
});

it.each([undefined, 'primary@example.com'])(
  'sends from the user-selected inbox before the reply inbox resolves (draft sender: %j)',
  async (from) => {
    showDraft(from);
    await fireEvent.click(screen.getByText('Choose secondary'));
    expect(screen.getByLabelText('From').textContent).toBe(
      'secondary@example.com'
    );
    await fireEvent.click(screen.getByText('Send'));
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'secondary@example.com' })
    );
  }
);
