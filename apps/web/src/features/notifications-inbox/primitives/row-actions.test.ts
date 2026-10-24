import type { UnifiedNotification } from '@notifications/types';
import { describe, expect, it, vi } from 'vitest';
import type {
  InboxRowActions,
  NotificationInboxRow,
} from '../context/notifications-inbox-context';
import { createRowActions, rowAction } from './row-actions';

const accessRequest = {
  id: 'n-1',
  entity_type: 'document',
  entity_id: 'doc-a',
  notification_metadata: {
    tag: 'entity_access_requested',
    content: {
      requestId: 'req-1',
      revision: 3,
      accessLevel: 'edit',
      entityName: 'Plan',
    },
  },
} as unknown as UnifiedNotification;

const row = (
  type: NotificationInboxRow['type'],
  notifications: UnifiedNotification[]
): NotificationInboxRow => ({
  id: `document:doc-a#${type}`,
  type,
  revision: 'rev',
  latestAt: 1,
  unseen: true,
  count: notifications.length,
  content: {
    entity: { type: 'document', id: 'doc-a', name: 'Plan' } as never,
    notifications,
  },
});

function setup(actions: Partial<InboxRowActions> = {}) {
  const complete = vi.fn(async () => {});
  const notices = { succeeded: vi.fn(), failed: vi.fn() };
  const rowActions = createRowActions({
    actions: {
      resolveAccessRequest: vi.fn(async () => {}),
      answerJoinRequest: vi.fn(async () => {}),
      ...actions,
    },
    complete,
    notices,
  });
  return { rowActions, complete, notices };
}

describe('rowAction', () => {
  it('asks for an answer only on an access request row', () => {
    expect(rowAction(row('access_requested', [accessRequest]))).toEqual({
      kind: 'access_request',
      entityType: 'document',
      entityId: 'doc-a',
      requestId: 'req-1',
      revision: 3,
      level: 'edit',
    });
    expect(rowAction(row('task', [accessRequest]))).toBeUndefined();
  });
});

describe('createRowActions', () => {
  it('approves at the requested level, then completes the row', async () => {
    const resolveAccessRequest = vi.fn(async () => {});
    const { rowActions, complete, notices } = setup({ resolveAccessRequest });
    const target = row('access_requested', [accessRequest]);

    await rowActions.run(target, 'approve');

    expect(resolveAccessRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-1', level: 'edit' }),
      true
    );
    expect(notices.succeeded).toHaveBeenCalledWith('approve');
    expect(complete).toHaveBeenCalledWith(target);
    expect(rowActions.pending(target.id)).toBeUndefined();
  });

  it('leaves the row when the answer fails', async () => {
    const { rowActions, complete, notices } = setup({
      resolveAccessRequest: vi.fn(async () => {
        throw new Error('stale revision');
      }),
    });
    const target = row('access_requested', [accessRequest]);

    await rowActions.run(target, 'deny');

    expect(notices.failed).toHaveBeenCalledWith('deny');
    expect(complete).not.toHaveBeenCalled();
    expect(rowActions.pending(target.id)).toBeUndefined();
  });

  it('runs one answer per row at a time', async () => {
    let finish!: () => void;
    const resolveAccessRequest = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve))
    );
    const { rowActions } = setup({ resolveAccessRequest });
    const target = row('access_requested', [accessRequest]);

    const first = rowActions.run(target, 'approve');
    expect(rowActions.pending(target.id)).toBe('approve');
    await rowActions.run(target, 'deny');
    finish();
    await first;

    expect(resolveAccessRequest).toHaveBeenCalledOnce();
  });
});
