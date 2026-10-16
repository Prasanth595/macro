import { err, ok, type Result } from 'neverthrow';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChannelIdentitySaveError } from '../core/channel-identity';
import { createChannelIdentityEditor } from './create-channel-identity-editor';

let dispose: () => void;
afterEach(() => dispose?.());

describe('channel identity drafts', () => {
  it('keeps name, image selection, and clearing local until Save; Cancel does not write', () => {
    const savePicture = vi.fn();
    const saveName = vi.fn();
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName },
        onClose,
      });
    });
    const file = new File(['image'], 'design.png', { type: 'image/png' });
    state.changeName('New design');
    state.changePicture(file);
    expect(state.picture()).toBe(file);
    state.changePicture(null);
    expect(state.picture()).toBeNull();
    expect(state.dirty()).toBe(true);
    state.close();
    expect(onClose).toHaveBeenCalledOnce();
    expect(savePicture).not.toHaveBeenCalled();
    expect(saveName).not.toHaveBeenCalled();
  });

  it('validates images and names without replacing a valid draft image', async () => {
    const savePicture = vi.fn();
    const saveName = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName },
        onClose: vi.fn(),
      });
    });
    const file = new File(['image'], 'design.png', { type: 'image/png' });
    state.changePicture(file);
    state.changePicture(
      new File(['not an image'], 'notes.txt', { type: 'text/plain' })
    );
    expect(state.error()).toContain('PNG');
    expect(state.picture()).toBe(file);
    state.changePicture(new File([], 'empty.png', { type: 'image/png' }));
    expect(state.error()).toContain('PNG');
    state.changePicture(
      new File([new Uint8Array(16_000_001)], 'large.png', { type: 'image/png' })
    );
    expect(state.error()).toContain('16 MB');
    state.changeName('   ');
    expect(state.canSave()).toBe(false);
    await state.save();
    expect(savePicture).not.toHaveBeenCalled();
    expect(saveName).not.toHaveBeenCalled();
  });

  it('trims the name, writes changed fields, and closes only after success', async () => {
    const savePicture = vi.fn().mockResolvedValue(ok(undefined));
    const saveName = vi.fn().mockResolvedValue(ok(undefined));
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName },
        onClose,
      });
    });
    state.changeName(' New design ');
    state.changePicture(null);
    await state.save();
    expect(savePicture).toHaveBeenCalledWith(null);
    expect(saveName).toHaveBeenCalledWith('New design');
    expect(state.dirty()).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('retains failed image drafts and does not rename when the image save fails', async () => {
    const savePicture = vi
      .fn()
      .mockResolvedValueOnce(err({ kind: 'picture' }))
      .mockResolvedValueOnce(ok(undefined));
    const saveName = vi.fn().mockResolvedValue(ok(undefined));
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName },
        onClose,
      });
    });
    const file = new File(['image'], 'design.png', { type: 'image/png' });
    state.changeName('New design');
    state.changePicture(file);
    await state.save();
    expect(state.picture()).toBe(file);
    expect(state.error()).toContain('picture');
    expect(saveName).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await state.save();
    expect(savePicture).toHaveBeenNthCalledWith(2, file);
    expect(saveName).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not upload the image again after a partial save and retries the name', async () => {
    const savePicture = vi.fn().mockResolvedValue(ok(undefined));
    const saveName = vi
      .fn()
      .mockResolvedValueOnce(err({ kind: 'name' }))
      .mockResolvedValueOnce(ok(undefined));
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName },
        onClose,
      });
    });
    state.changePicture(
      new File(['image'], 'design.png', { type: 'image/png' })
    );
    state.changeName('New design');
    await state.save();
    expect(state.error()).toContain('picture was saved');
    expect(state.name()).toBe('New design');
    expect(onClose).not.toHaveBeenCalled();
    await state.save();
    expect(savePicture).toHaveBeenCalledOnce();
    expect(saveName).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks duplicate saves, draft changes, and dismissal while saving', async () => {
    let finish!: (result: Result<void, ChannelIdentitySaveError>) => void;
    const saveName = vi.fn(
      () =>
        new Promise<Result<void, ChannelIdentitySaveError>>((resolve) => {
          finish = resolve;
        })
    );
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName },
        onClose,
      });
    });
    state.changeName('New design');
    const saving = state.save();
    await state.save();
    state.changeName('Another name');
    state.changePicture(null);
    state.close();
    expect(state.name()).toBe('New design');
    expect(state.picture()).toBeUndefined();
    expect(saveName).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    finish(ok(undefined));
    await saving;
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('rechecks edit permission and ignores completions after disposal', async () => {
    const [canEdit, setCanEdit] = createSignal(true);
    let finish!: (result: Result<void, ChannelIdentitySaveError>) => void;
    const saveName = vi.fn(
      () =>
        new Promise<Result<void, ChannelIdentitySaveError>>((resolve) => {
          finish = resolve;
        })
    );
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit,
        writer: { savePicture: vi.fn(), saveName },
        onClose,
      });
    });
    state.changeName('New design');
    setCanEdit(false);
    await state.save();
    expect(saveName).not.toHaveBeenCalled();
    setCanEdit(true);
    const saving = state.save();
    dispose();
    finish(ok(undefined));
    await saving;
    expect(onClose).not.toHaveBeenCalled();
  });
});
