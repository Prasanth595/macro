import { createRoot, createSignal } from 'solid-js';
import { expect, it } from 'vitest';
import { message } from '../../email-message/tests/messages';
import type { SenderInbox } from '../core/email-sender';
import { createEmailFormState } from './email-form-state';

const primary: SenderInbox = { id: 'inbox', email_address: 'base@example.com' };
const loaded: SenderInbox = {
  ...primary,
  sendAs: [{ email_address: 'resident@example.com' }],
};
const parent = message('parent', {
  link_id: 'inbox',
  from: { email: 'customer@example.com' },
  to: [{ email: 'resident@example.com' }],
  cc: [{ email: 'BASE@example.com' }],
});

it('late aliases update the default without writing a draft or keeping self in reply-all', () =>
  createRoot((dispose) => {
    try {
      const [inboxes, setInboxes] = createSignal<SenderInbox[]>([primary]);
      const form = createEmailFormState(
        { viewerEmail: () => 'base@example.com', inboxes },
        { type: 'replying_to', messageId: 'parent' },
        {
          getMessageById: () => parent,
          getDraftForMessageReply: () => undefined,
        }
      );
      setInboxes([loaded]);
      expect(form.senderEmail()).toBe('resident@example.com');
      expect(form.recipients().to.map((item) => item.data.email)).toEqual([
        'customer@example.com',
      ]);
      expect(form.recipients().cc).toEqual([]);
      expect(form.editRevision()).toBe(0);
    } finally {
      dispose();
    }
  }));

it('a manual primary choice wins over late aliases and refetches', () =>
  createRoot((dispose) => {
    try {
      const [inboxes, setInboxes] = createSignal<SenderInbox[]>([primary]);
      const form = createEmailFormState(
        { viewerEmail: () => 'base@example.com', inboxes },
        { type: 'replying_to', messageId: 'parent' },
        {
          getMessageById: () => parent,
          getDraftForMessageReply: () => undefined,
        }
      );
      form.setSelectedInbox('inbox', 'base@example.com');
      setInboxes([loaded]);
      expect(form.senderEmail()).toBe('base@example.com');
      form.setSelectedInbox('inbox', 'resident@example.com');
      setInboxes([primary]);
      expect(form.senderEmail()).toBe('resident@example.com');
    } finally {
      dispose();
    }
  }));

it.each(['base@example.com', 'resident@example.com'])(
  'restores the saved sender %s without reselecting from recipients',
  (email) =>
    createRoot((dispose) => {
      try {
        const draft = message('draft', {
          ...parent,
          db_id: 'draft',
          is_draft: true,
          from: { email },
        });
        const form = createEmailFormState(
          { viewerEmail: () => 'base@example.com', inboxes: () => [loaded] },
          { type: 'replying_to', messageId: 'parent' },
          {
            getMessageById: () => parent,
            getDraftForMessageReply: () => draft,
          }
        );
        expect(form.senderEmail()).toBe(email);
      } finally {
        dispose();
      }
    })
);

it('does not pick an alias belonging only to another connected inbox', () =>
  createRoot((dispose) => {
    try {
      const form = createEmailFormState(
        {
          viewerEmail: () => 'base@example.com',
          inboxes: () => [primary, { ...loaded, id: 'other' }],
        },
        { type: 'replying_to', messageId: 'parent' },
        {
          getMessageById: () => parent,
          getDraftForMessageReply: () => undefined,
        }
      );
      expect(form.senderEmail()).toBe('base@example.com');
    } finally {
      dispose();
    }
  }));
