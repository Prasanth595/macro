import { createComponent, createRoot } from 'solid-js';
import { createStore } from 'solid-js/store';
import { describe, expect, it, vi } from 'vitest';
import {
  CalendarCreationProvider,
  useCalendarCreation,
} from '../context/calendar-creation-context';
import {
  createCalendarCreation,
  createCalendarCreationRequest,
} from './create-calendar-creation';
import { createCalendarDraftDismissal } from './create-calendar-draft-dismissal';

describe('calendar creation draft', () => {
  it('keeps the current draft when another timeslot or create action is selected', () => {
    createRoot((dispose) => {
      const creation = createCalendarCreation();
      const draft = { anchor: { x: 100, y: 200, width: 80, height: 30 } };
      expect(creation.open(draft)).toBe(true);
      expect(creation.surface()).toBe('popover');
      expect(
        creation.open({ anchor: { x: 400, y: 500, width: 80, height: 30 } })
      ).toBe(false);
      expect(creation.open()).toBe(false);
      expect(creation.draft()).toBe(draft);
      expect(creation.surface()).toBe('popover');
      dispose();
    });
  });

  it('moves the same draft to the sidebar without closing and cleans up only once', () => {
    createRoot((dispose) => {
      const creation = createCalendarCreation();
      const onClose = vi.fn();
      const draft = {
        anchor: { x: 100, y: 200, width: 80, height: 30 },
        onClose,
      };
      creation.open(draft);
      creation.moveToSidebar();
      expect(creation.draft()).toBe(draft);
      expect(creation.surface()).toBe('sidebar');
      expect(onClose).not.toHaveBeenCalled();
      creation.close();
      creation.close();
      expect(onClose).toHaveBeenCalledOnce();
      expect(creation.draft()).toBeUndefined();
      creation.open();
      expect(creation.surface()).toBe('sidebar');
      dispose();
    });
  });
  it('consumes delivered requests so a dismissed draft does not reopen after remount', () => {
    const onCalendarChange = vi.fn();
    const onClose = vi.fn();
    const [entry] = createStore({
      request: createCalendarCreationRequest({ onCalendarChange, onClose }),
    });
    const request = entry.request;
    const first = createRoot((dispose) => {
      let creation: ReturnType<typeof useCalendarCreation> | undefined;
      createComponent(CalendarCreationProvider, {
        request,
        get children() {
          creation = useCalendarCreation();
          return null;
        },
      });
      return {
        get creation() {
          return creation;
        },
        dispose,
      };
    });
    try {
      expect(first.creation?.draft()).toBeDefined();
      first.creation?.draft()?.onCalendarChange?.('work', '#123456');
      expect(onCalendarChange).toHaveBeenCalledWith('work', '#123456');
      expect(request.consume()).toBe(false);
      first.creation?.close();
      first.creation?.close();
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      first.dispose();
    }
    const remounted = createRoot((dispose) => {
      let creation: ReturnType<typeof useCalendarCreation> | undefined;
      createComponent(CalendarCreationProvider, {
        request,
        get children() {
          creation = useCalendarCreation();
          return null;
        },
      });
      return {
        get creation() {
          return creation;
        },
        dispose,
      };
    });
    try {
      expect(remounted.creation).toBeDefined();
      expect(remounted.creation?.draft()).toBeUndefined();
      expect(request.consume()).toBe(false);
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      remounted.dispose();
    }
  });
});

describe('calendar draft dismissal', () => {
  it('keeps unsaved changes after cancellation and permits a later explicit discard', async () => {
    const confirmDiscard = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const dismiss = createCalendarDraftDismissal({
      dirty: () => true,
      pending: () => false,
      confirmDiscard,
    });
    expect(await dismiss()).toBe(false);
    expect(await dismiss()).toBe(true);
    expect(confirmDiscard).toHaveBeenCalledTimes(2);
  });

  it('blocks concurrent confirmations and dismissal while saving', async () => {
    let resolve: (confirmed: boolean) => void = () => {};
    let pending = false;
    const confirmDiscard = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        })
    );
    const dismiss = createCalendarDraftDismissal({
      dirty: () => true,
      pending: () => pending,
      confirmDiscard,
    });
    const decision = dismiss();
    expect(await dismiss()).toBe(false);
    expect(confirmDiscard).toHaveBeenCalledOnce();
    pending = true;
    resolve(true);
    expect(await decision).toBe(false);
    expect(await dismiss()).toBe(false);
    expect(confirmDiscard).toHaveBeenCalledOnce();
  });

  it('dismisses an untouched draft without confirmation', async () => {
    const confirmDiscard = vi.fn();
    const dismiss = createCalendarDraftDismissal({
      dirty: () => false,
      pending: () => false,
      confirmDiscard,
    });
    expect(await dismiss()).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });
});
