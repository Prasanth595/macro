import { cleanup, render, screen } from '@solidjs/testing-library';
import { createRoot, getOwner } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImperativeDialogHost, openDialog } from './ImperativeDialog';

afterEach(cleanup);

describe('keyed imperative dialogs', () => {
  it('closes safely after an unidentifiable trigger is removed', async () => {
    vi.useFakeTimers();
    try {
      const trigger = document.createElement('button');
      document.body.append(trigger);
      trigger.focus();
      render(() => <ImperativeDialogHost />);
      const handle = openDialog(() => <div role="dialog">Edit</div>, {});
      trigger.remove();
      handle.close();
      await handle.closed;
      await vi.runAllTimersAsync();
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses simultaneous openers and permits reopening after dismissal', async () => {
    render(() => <ImperativeDialogHost />);
    const Dialog = () => <div role="dialog">Share</div>;
    const first = openDialog(Dialog, {}, { key: 'share:document:one' });
    const duplicate = openDialog(Dialog, {}, { key: 'share:document:one' });
    expect(duplicate).toBe(first);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    first.close();
    expect(await duplicate.closed).toEqual({
      id: first.id,
      reason: 'programmatic',
    });
    const reopened = openDialog(Dialog, {}, { key: 'share:document:one' });
    expect(reopened.id).not.toBe(first.id);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('closes a reused dialog when its original component is disposed', async () => {
    render(() => <ImperativeDialogHost />);
    const Dialog = () => <div role="dialog">Share</div>;
    const { handle, dispose } = createRoot((dispose) => ({
      handle: openDialog(
        Dialog,
        {},
        { owner: getOwner(), key: 'share:document:two' }
      ),
      dispose,
    }));
    expect(openDialog(Dialog, {}, { key: 'share:document:two' })).toBe(handle);
    dispose();
    expect(await handle.closed).toEqual({
      id: handle.id,
      reason: 'owner-disposed',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
