import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { message } from '../../email-message/tests/messages';
import type {
  EmailInbox,
  SaveEmailDraft,
} from '../context/compose-capabilities';
import { createComposeContext } from '../tests/capabilities';
import { mountEmailComposer } from '../tests/composer';
import { mountReplyComposer } from '../tests/reply';

vi.mock('@app/lib/analytics', () => ({
  analytics: { track: vi.fn(), posthog: { captureException: vi.fn() } },
}));
vi.mock('@queries/client', () => ({
  queryClient: {
    getQueryData: () => ({ authenticated: true, id: 'owner' }),
  },
}));

let localDrafts: typeof import('@queries/email/local-drafts');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
  localDrafts = await import('@queries/email/local-drafts');
});
afterEach(async () => {
  await localDrafts.localDraftStore.close();
  vi.unstubAllGlobals();
});

const outlook: EmailInbox = {
  id: 'inbox',
  email_address: 'teo@outlook.example',
  provider: 'OUTLOOK',
  settings: {},
};
const gmail: EmailInbox = {
  id: 'inbox',
  email_address: 'teo@gmail.example',
  provider: 'GMAIL',
  settings: {},
};

/** Production keeps working copies in IndexedDB; only the network is faked. */
function createDeviceContext(source: EmailInbox, destination: EmailInbox) {
  const context = createComposeContext();
  const inboxes = [source, { ...destination, id: 'other' }];
  context.accounts.inboxes = () => inboxes;
  context.drafts.saveLocalDraft = (input) =>
    localDrafts.saveLocalDraft({
      ...input,
      senderEmail: inboxes.find((inbox) => inbox.id === input.inboxId)
        ?.email_address,
    });
  const moved = Promise.withResolvers<
    { saved: SaveEmailDraft } | { failed: string; reason?: string }
  >();
  context.drafts.saveDraft = vi.fn(async (input) => {
    if (input.inboxId === 'other') moved.resolve({ saved: input });
    return {
      draftId: input.draft.db_id ?? 'draft',
      threadId: input.draft.thread_db_id ?? 'thread',
      inboxId: input.inboxId ?? 'inbox',
    };
  });
  context.notices.feedback.failure = vi.fn((failed: string, options) => {
    moved.resolve({ failed, reason: options?.subtext });
  });
  return { context, moved: moved.promise };
}

const directions = [
  ['Outlook', 'Gmail', outlook, gmail],
  ['Gmail', 'Outlook', gmail, outlook],
] as const;

it.each(directions)(
  'keeps saving a draft locally after its sender moves it from %s to %s',
  async (_from, _to, source, destination) => {
    const { context, moved } = createDeviceContext(source, destination);
    const root = mountEmailComposer(context, undefined, {
      draft: message('draft', {
        is_draft: true,
        link_id: 'inbox',
        from: { email: source.email_address },
      }),
    });
    try {
      root.edit('Before the move');
      await root.state.flushLocal();
      root.state.context.onSelectInbox?.('other');
      expect(await moved).toEqual({
        saved: expect.objectContaining({
          inboxId: 'other',
          draft: expect.objectContaining({ db_id: 'moved-draft' }),
        }),
      });
      root.edit('After the move');
      await root.state.flushLocal();
      expect(root.state.localSaveState()).toBe('saved');
      expect(await localDrafts.readLocalDraft('moved-draft')).toMatchObject({
        inboxId: 'other',
        content: { body_text: 'After the move' },
      });
      expect(await localDrafts.readLocalDraft('draft')).toBeUndefined();
    } finally {
      root.dispose();
    }
  }
);

it.each(directions)(
  'keeps saving a reply locally after its sender moves it from %s to %s',
  async (_from, _to, source, destination) => {
    const { context, moved } = createDeviceContext(source, destination);
    const reply = mountReplyComposer(context, undefined, {
      draft: message('draft', {
        is_draft: true,
        link_id: 'inbox',
        replying_to_id: 'parent',
        from: { email: source.email_address },
      }),
    });
    try {
      reply.edit('Before the move');
      await reply.flushLocal();
      reply.persistDraftOnSenderSwitch('other');
      expect(await moved).toEqual({
        saved: expect.objectContaining({
          inboxId: 'other',
          draft: expect.objectContaining({ db_id: 'moved-draft' }),
        }),
      });
      reply.edit('After the move');
      await reply.flushLocal();
      expect(reply.localSaveState()).toBe('saved');
      expect(await localDrafts.readLocalDraft('moved-draft')).toMatchObject({
        inboxId: 'other',
        content: { body_text: 'After the move' },
      });
      expect(await localDrafts.readLocalDraft('draft')).toBeUndefined();
    } finally {
      reply.dispose();
    }
  }
);
