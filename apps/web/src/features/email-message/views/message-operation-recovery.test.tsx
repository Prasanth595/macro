import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import type { MessageOperation } from '../core/message-operation';
import { MessageOperationRecovery } from './message-operation-recovery';

afterEach(cleanup);

it.each([
  'PENDING',
  'SYNCHRONIZED',
  'SUBMITTING',
  'CONFIRMING',
  'SENT',
  'DELETED',
] as const)('renders nothing for routine %s progress', (state) => {
  render(() => (
    <MessageOperationRecovery
      source={{
        operation: () => ({ state, revision: '1' }),
        resolve: vi.fn(async () => {}),
      }}
    />
  ));
  expect(screen.queryByRole('status')).toBeNull();
});

it.each<[MessageOperation, string]>([
  [
    { state: 'CONFLICT', issue: 'DRAFT_CONFLICT', revision: '1' },
    'This draft changed in your mailbox',
  ],
  [
    { state: 'UNCERTAIN', issue: 'SEND_UNKNOWN', revision: '1' },
    'Delivery could not be confirmed',
  ],
  [
    { state: 'UNCERTAIN', issue: 'CREATION_UNKNOWN', revision: '1' },
    'A draft or attachment write could not be confirmed',
  ],
  [
    { state: 'FAILED', issue: 'SEND_REJECTED', revision: '1' },
    'Your mail provider rejected this send',
  ],
  [
    { state: 'FAILED', issue: 'INVALID_CONTENT', revision: '1' },
    'Your mail provider could not save this draft',
  ],
  [
    { state: 'CANCELLED', issue: 'ACCESS_REVOKED', revision: '1' },
    'Access to this inbox has changed',
  ],
  [
    { state: 'PENDING', issue: 'ACCEPTING_REMOTE', revision: '1' },
    'Loading the mailbox version',
  ],
  [
    { state: 'SUBMITTING', issue: 'MOVE_PENDING', revision: '1' },
    'Finishing the inbox change',
  ],
])('keeps %o visible', (operation, text) => {
  render(() => (
    <MessageOperationRecovery
      source={{ operation: () => operation, resolve: vi.fn(async () => {}) }}
    />
  ));
  expect(screen.getByRole('status').textContent).toContain(text);
});

it('prompts for a reload once the mailbox version is synchronized', () => {
  render(() => (
    <MessageOperationRecovery
      source={{
        operation: () => ({ state: 'SYNCHRONIZED', revision: '2' }),
        needsReload: () => true,
        resolve: vi.fn(async () => {}),
      }}
      onReloadDraft={() => {}}
    />
  ));
  expect(screen.getByRole('button', { name: 'Reload draft' })).toBeTruthy();
});

it('hides the card once a resend is accepted', async () => {
  const [operation, setOperation] = createSignal<MessageOperation>({
    state: 'FAILED',
    issue: 'SEND_REJECTED',
    revision: '3',
  });
  const resolve = vi.fn(async () => {
    setOperation({ state: 'SUBMITTING', revision: '4' });
  });
  render(() => <MessageOperationRecovery source={{ operation, resolve }} />);
  await fireEvent.click(screen.getByRole('button', { name: 'Retry send' }));
  expect(resolve).toHaveBeenCalledOnce();
  expect(screen.queryByRole('status')).toBeNull();
});

it('keeps an action error visible after the operation settles', async () => {
  const [operation, setOperation] = createSignal<MessageOperation>({
    state: 'UNCERTAIN',
    issue: 'CREATION_UNKNOWN',
    revision: '5',
  });
  let failAttempt!: (error: Error) => void;
  const attempt = new Promise<void>((_, reject) => {
    failAttempt = reject;
  });
  const resolve = vi.fn(() => {
    setOperation({ state: 'SYNCHRONIZED', revision: '6' });
    return attempt;
  });
  render(() => <MessageOperationRecovery source={{ operation, resolve }} />);
  await fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  failAttempt(new Error('refresh failed'));
  await expect(attempt).rejects.toThrow('refresh failed');
  expect(screen.getByRole('alert').textContent).toContain(
    'The operation could not be completed'
  );
});

it('requires deliberate acknowledgement before retrying an uncertain send', async () => {
  const operation: MessageOperation = {
    state: 'UNCERTAIN',
    issue: 'SEND_UNKNOWN',
    revision: '9223372036854775000',
  };
  const resolve = vi.fn(async () => {});
  render(() => (
    <MessageOperationRecovery
      source={{ operation: () => operation, resolve }}
    />
  ));
  await fireEvent.click(screen.getByRole('button', { name: 'Retry send' }));
  expect(resolve).not.toHaveBeenCalled();
  const confirm = screen.getByRole('button', {
    name: 'Confirm',
  }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  await fireEvent.click(screen.getByRole('checkbox'));
  await fireEvent.click(confirm);
  expect(resolve).toHaveBeenCalledExactlyOnceWith(
    operation,
    'retry_send',
    true
  );
});

it('resolves the conflict version the user reviewed even if a newer version arrives', async () => {
  const reviewed: MessageOperation = {
    state: 'CONFLICT',
    issue: 'DRAFT_CONFLICT',
    revision: '5',
    remoteVersion: 'first',
  };
  const [operation, setOperation] = createSignal(reviewed);
  const resolve = vi.fn(async () => {});
  render(() => <MessageOperationRecovery source={{ operation, resolve }} />);
  await fireEvent.click(
    screen.getByRole('button', { name: 'Keep Macro version' })
  );
  setOperation({ ...reviewed, revision: '6', remoteVersion: 'second' });
  await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(resolve).toHaveBeenCalledExactlyOnceWith(
    reviewed,
    'keep_local',
    false
  );
});

it('can recheck without ever invoking resend', async () => {
  const operation: MessageOperation = {
    state: 'UNCERTAIN',
    issue: 'SEND_UNKNOWN',
    revision: '8',
  };
  const resolve = vi.fn(async () => {});
  render(() => (
    <MessageOperationRecovery
      source={{ operation: () => operation, resolve }}
    />
  ));
  await fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(resolve).toHaveBeenCalledExactlyOnceWith(operation, 'recheck', false);
});
