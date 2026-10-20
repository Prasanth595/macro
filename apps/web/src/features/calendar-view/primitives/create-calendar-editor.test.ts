import { createComponent, createRoot } from 'solid-js';
import { createStore } from 'solid-js/store';
import { describe, expect, it, vi } from 'vitest';
import {
  CalendarEditorProvider,
  useCalendarEditor,
} from '../context/calendar-editor-context';
import { createCalendarDraftDismissal } from './create-calendar-draft-dismissal';
import {
  createCalendarEditor,
  createCalendarEditorRequest,
} from './create-calendar-editor';

describe('calendar composer draft', () => {
  it('keeps the current draft for duplicate open commands', () => {
    createRoot((dispose) => {
      const composer = createCalendarEditor();
      const draft = { anchor: { x: 100, y: 200, width: 80, height: 30 } };
      expect(composer.open(draft)).toBe(true);
      expect(composer.surface()).toBe('popover');
      expect(
        composer.open({ anchor: { x: 400, y: 500, width: 80, height: 30 } })
      ).toBe(false);
      expect(composer.open()).toBe(false);
      expect(composer.draft()).toBe(draft);
      expect(composer.surface()).toBe('popover');
      dispose();
    });
  });

  it('moves the same draft to the sidebar without closing and cleans up only once', () => {
    createRoot((dispose) => {
      const composer = createCalendarEditor();
      const onClose = vi.fn();
      const draft = {
        anchor: { x: 100, y: 200, width: 80, height: 30 },
        onClose,
      };
      composer.open(draft);
      composer.moveToSidebar();
      expect(composer.draft()).toBe(draft);
      expect(composer.surface()).toBe('sidebar');
      expect(onClose).not.toHaveBeenCalled();
      composer.close();
      composer.close();
      expect(onClose).toHaveBeenCalledOnce();
      expect(composer.draft()).toBeUndefined();
      composer.open();
      expect(composer.surface()).toBe('sidebar');
      dispose();
    });
  });
  it('replaces an untouched draft and closes its selection once', async () => {
    const composer = createCalendarEditor();
    const onClose = vi.fn();
    const confirmDiscard = vi.fn();
    composer.open({ onClose });
    composer.registerBeforeReplace(
      createCalendarDraftDismissal({
        dirty: () => false,
        pending: () => false,
        confirmDiscard,
      })
    );
    const next = { anchor: { x: 200, y: 300, width: 80, height: 30 } };
    expect(await composer.replace(next)).toBe(true);
    expect(composer.draft()).toBe(next);
    expect(composer.surface()).toBe('popover');
    expect(onClose).toHaveBeenCalledOnce();
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('keeps a dirty draft after Keep editing and replaces it after Discard', async () => {
    const composer = createCalendarEditor();
    const onClose = vi.fn();
    const current = { onClose };
    composer.open(current);
    const confirmDiscard = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    composer.registerBeforeReplace(
      createCalendarDraftDismissal({
        dirty: () => true,
        pending: () => false,
        confirmDiscard,
      })
    );
    const next = { anchor: { x: 200, y: 300, width: 80, height: 30 } };
    expect(await composer.replace(next)).toBe(false);
    expect(composer.draft()).toBe(current);
    expect(onClose).not.toHaveBeenCalled();
    expect(await composer.replace(next)).toBe(true);
    expect(composer.draft()).toBe(next);
    expect(onClose).toHaveBeenCalledOnce();
    expect(confirmDiscard).toHaveBeenCalledTimes(2);
  });

  it('blocks replacement while saving even when the draft is untouched', async () => {
    const composer = createCalendarEditor();
    const current = {};
    composer.open(current);
    const confirmDiscard = vi.fn();
    composer.registerBeforeReplace(
      createCalendarDraftDismissal({
        dirty: () => false,
        pending: () => true,
        confirmDiscard,
      })
    );
    expect(await composer.replace({})).toBe(false);
    expect(composer.draft()).toBe(current);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('does not apply an old confirmation to a newer draft', async () => {
    const composer = createCalendarEditor();
    composer.open();
    let resolve: (confirmed: boolean) => void = () => {};
    composer.registerBeforeReplace(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        })
    );
    const decision = composer.replace({});
    composer.close();
    const newer = { anchor: { x: 200, y: 300, width: 80, height: 30 } };
    composer.open(newer);
    resolve(true);
    expect(await decision).toBe(false);
    expect(composer.draft()).toBe(newer);
  });
  it('keeps the newer dismissal guard when the old form cleans up', async () => {
    const composer = createCalendarEditor();
    composer.open();
    const unregister = composer.registerBeforeReplace(async () => true);
    composer.registerBeforeReplace(async () => false);
    unregister();
    expect(await composer.replace({})).toBe(false);
  });
  it('consumes delivered requests so a dismissed draft does not reopen after remount', () => {
    const onCalendarChange = vi.fn();
    const onClose = vi.fn();
    const [entry] = createStore({
      request: createCalendarEditorRequest({ onCalendarChange, onClose }),
    });
    const request = entry.request;
    const first = createRoot((dispose) => {
      let composer: ReturnType<typeof useCalendarEditor> | undefined;
      createComponent(CalendarEditorProvider, {
        request,
        get children() {
          composer = useCalendarEditor();
          return null;
        },
      });
      return {
        get composer() {
          return composer;
        },
        dispose,
      };
    });
    try {
      expect(first.composer?.draft()).toBeDefined();
      first.composer?.draft()?.onCalendarChange?.('work', '#123456');
      expect(onCalendarChange).toHaveBeenCalledWith('work', '#123456');
      expect(request.consume()).toBe(false);
      first.composer?.close();
      first.composer?.close();
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      first.dispose();
    }
    const remounted = createRoot((dispose) => {
      let composer: ReturnType<typeof useCalendarEditor> | undefined;
      createComponent(CalendarEditorProvider, {
        request,
        get children() {
          composer = useCalendarEditor();
          return null;
        },
      });
      return {
        get composer() {
          return composer;
        },
        dispose,
      };
    });
    try {
      expect(remounted.composer).toBeDefined();
      expect(remounted.composer?.draft()).toBeUndefined();
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
