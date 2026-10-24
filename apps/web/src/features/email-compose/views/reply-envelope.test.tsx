import { cleanup, render, screen } from '@solidjs/testing-library';
import { type ComponentProps, createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmailInbox } from '../context/compose-capabilities';
import type { EmailFormRecipients } from '../core/email-recipient';
import { createReplyRecipientFields } from '../primitives/reply-recipient-fields';
import { ReplyEnvelope } from './reply-envelope';

vi.mock('@ui', async () => ({
  cn: (await import('@ui/utils/classname')).cn,
  Button: (props: ComponentProps<'button'>) => <button {...props} />,
}));
vi.mock('@core/component/RecipientSelector', () => ({
  RecipientSelector: () => null,
}));
vi.mock('../components/from-inbox-selector', () => ({
  FromInboxSelector: () => null,
}));

const inboxes: EmailInbox[] = [
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

const disposers: (() => void)[] = [];
afterEach(() => {
  cleanup();
  disposers.splice(0).forEach((dispose) => dispose());
});

function renderEnvelope(options: {
  inboxId: 'gmail' | 'outlook';
  subject: string;
  mobile: boolean;
}) {
  const fields = createRoot((dispose) => {
    disposers.push(dispose);
    const [values, setValues] = createSignal<EmailFormRecipients>({
      to: [],
      cc: [],
      bcc: [],
    });
    return {
      values,
      fields: createReplyRecipientFields({
        values,
        container: () => undefined,
        disabled: () => false,
        onChange: () => {},
        setValues: (field, recipients) =>
          setValues((prev) => ({ ...prev, [field]: recipients })),
      }),
    };
  });
  render(() => (
    <ReplyEnvelope
      fields={fields.fields}
      values={fields.values}
      options={() => []}
      inboxes={() => inboxes}
      activeInboxId={() => options.inboxId}
      senderEmail={() => undefined}
      onSenderChange={() => {}}
      subject={() => options.subject}
      onSubjectChange={() => {}}
      showSubject
      mobile={() => options.mobile}
      portalScope={() => undefined}
      replyType={() => 'forward'}
      disabled={() => false}
    />
  ));
  return screen.getByPlaceholderText(
    options.mobile ? 'Subject:' : 'Subject'
  ) as HTMLInputElement;
}

function overLimitHint(input: HTMLInputElement) {
  if (input.getAttribute('aria-invalid') !== 'true') return undefined;
  const id = input.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent?.trim() : undefined;
}

describe.each([false, true])(
  'ReplyEnvelope subject limit (mobile=%s)',
  (mobile) => {
    it('flags an Outlook subject over 255 characters without cutting it', () => {
      const subject = 'a'.repeat(300);
      const input = renderEnvelope({ inboxId: 'outlook', subject, mobile });
      expect(overLimitHint(input)).toBeTruthy();
      expect(input.value).toBe(subject);
    });

    it('accepts an Outlook subject of exactly 255 characters', () => {
      const input = renderEnvelope({
        inboxId: 'outlook',
        subject: 'a'.repeat(255),
        mobile,
      });
      expect(overLimitHint(input)).toBeUndefined();
    });

    it('leaves a long Gmail subject alone', () => {
      const input = renderEnvelope({
        inboxId: 'gmail',
        subject: 'a'.repeat(300),
        mobile,
      });
      expect(overLimitHint(input)).toBeUndefined();
    });
  }
);
