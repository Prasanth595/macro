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

describe('channel team drafts', () => {
  it('keeps conversion and auto-join local until Save', async () => {
    const saveTeam = vi.fn().mockResolvedValue(ok(undefined));
    const savePicture = vi.fn();
    const saveName = vi.fn();
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName },
        teamControls: () => ({
          settings: { isTeamChannel: false, autoJoinTeam: false },
          canManage: true,
          canConvert: true,
          save: saveTeam,
        }),
        onClose,
      });
    });
    state.changeTeamChannel(true);
    state.changeAutoJoinTeam(true);
    expect(state.teamSettings()).toEqual({
      isTeamChannel: true,
      autoJoinTeam: true,
    });
    expect(state.teamChanges()).toEqual({
      convertToTeam: true,
      autoJoinTeam: true,
    });
    expect(state.dirty()).toBe(true);
    expect(state.canSave()).toBe(true);
    expect(saveTeam).not.toHaveBeenCalled();
    await state.save();
    expect(saveTeam).toHaveBeenCalledExactlyOnceWith({
      convertToTeam: true,
      autoJoinTeam: true,
    });
    expect(savePicture).not.toHaveBeenCalled();
    expect(saveName).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('discards a team draft on Cancel without writing', () => {
    const saveTeam = vi.fn();
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName: vi.fn() },
        teamControls: () => ({
          settings: { isTeamChannel: false, autoJoinTeam: false },
          canManage: true,
          canConvert: true,
          save: saveTeam,
        }),
        onClose,
      });
    });
    state.changeTeamChannel(true);
    state.changeAutoJoinTeam(true);
    state.close();
    dispose();
    expect(onClose).toHaveBeenCalledOnce();
    expect(saveTeam).not.toHaveBeenCalled();
  });

  it('restores unchanged settings when a draft conversion is toggled off', async () => {
    const saveTeam = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName: vi.fn() },
        teamControls: () => ({
          settings: { isTeamChannel: false, autoJoinTeam: false },
          canManage: true,
          canConvert: true,
          save: saveTeam,
        }),
        onClose: vi.fn(),
      });
    });
    state.changeTeamChannel(true);
    state.changeAutoJoinTeam(true);
    state.changeTeamChannel(false);
    expect(state.teamSettings()).toEqual({
      isTeamChannel: false,
      autoJoinTeam: false,
    });
    expect(state.teamChanges()).toBeUndefined();
    expect(state.dirty()).toBe(false);
    expect(state.canSave()).toBe(false);
    await state.save();
    expect(saveTeam).not.toHaveBeenCalled();
  });

  it('does not revert an existing team channel and saves only an auto-join draft', async () => {
    const saveTeam = vi.fn().mockResolvedValue(ok(undefined));
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName: vi.fn() },
        teamControls: () => ({
          settings: { isTeamChannel: true, autoJoinTeam: false },
          canManage: true,
          canConvert: true,
          save: saveTeam,
        }),
        onClose: vi.fn(),
      });
    });
    state.changeTeamChannel(false);
    expect(state.teamSettings()).toEqual({
      isTeamChannel: true,
      autoJoinTeam: false,
    });
    expect(state.dirty()).toBe(false);
    state.changeAutoJoinTeam(true);
    expect(state.teamChanges()).toEqual({
      convertToTeam: false,
      autoJoinTeam: true,
    });
    expect(saveTeam).not.toHaveBeenCalled();
    await state.save();
    expect(saveTeam).toHaveBeenCalledExactlyOnceWith({
      convertToTeam: false,
      autoJoinTeam: true,
    });
  });

  it('blocks conversion without a team and team writes for a member role', async () => {
    const saveTeam = vi.fn();
    const [controls, setControls] = createSignal({
      settings: { isTeamChannel: false, autoJoinTeam: false },
      canManage: true,
      canConvert: false,
      save: saveTeam,
    });
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName: vi.fn() },
        teamControls: controls,
        onClose: vi.fn(),
      });
    });
    state.changeTeamChannel(true);
    expect(state.teamChanges()).toBeUndefined();
    expect(state.canSave()).toBe(false);
    setControls({
      settings: { isTeamChannel: true, autoJoinTeam: false },
      canManage: false,
      canConvert: false,
      save: saveTeam,
    });
    state.changeAutoJoinTeam(true);
    expect(state.teamChanges()).toBeUndefined();
    await state.save();
    expect(saveTeam).not.toHaveBeenCalled();
  });

  it('blocks a drafted team write when team access or permission disappears', async () => {
    const saveTeam = vi.fn();
    const [controls, setControls] = createSignal<
      | {
          settings: { isTeamChannel: boolean; autoJoinTeam: boolean };
          canManage: boolean;
          canConvert: boolean;
          save: typeof saveTeam;
        }
      | undefined
    >({
      settings: { isTeamChannel: false, autoJoinTeam: false },
      canManage: true,
      canConvert: true,
      save: saveTeam,
    });
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName: vi.fn() },
        teamControls: controls,
        onClose: vi.fn(),
      });
    });
    state.changeTeamChannel(true);
    setControls(undefined);
    expect(state.canSave()).toBe(false);
    await state.save();
    expect(saveTeam).not.toHaveBeenCalled();
    setControls({
      settings: { isTeamChannel: false, autoJoinTeam: false },
      canManage: false,
      canConvert: false,
      save: saveTeam,
    });
    expect(state.canSave()).toBe(false);
    await state.save();
    expect(saveTeam).not.toHaveBeenCalled();
    state.changeName('Preserved name');
    const file = new File(['image'], 'design.png', { type: 'image/png' });
    state.changePicture(file);
    state.discardTeamChanges();
    expect(state.teamChanges()).toBeUndefined();
    expect(state.name()).toBe('Preserved name');
    expect(state.picture()).toBe(file);
    expect(state.canSave()).toBe(true);
    expect(saveTeam).not.toHaveBeenCalled();
  });

  it('rechecks team permission after an identity write before saving the team draft', async () => {
    const [canManage, setCanManage] = createSignal(true);
    const saveName = vi.fn(async () => {
      setCanManage(false);
      return ok(undefined);
    });
    const saveTeam = vi.fn();
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName },
        teamControls: () => ({
          settings: { isTeamChannel: false, autoJoinTeam: false },
          canManage: canManage(),
          canConvert: true,
          save: saveTeam,
        }),
        onClose,
      });
    });
    state.changeName('New design');
    state.changeTeamChannel(true);
    await state.save();
    expect(saveName).toHaveBeenCalledOnce();
    expect(saveTeam).not.toHaveBeenCalled();
    expect(state.error()).toContain('permission');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('retries only the team write after identity succeeds and the team save fails', async () => {
    const savePicture = vi.fn().mockResolvedValue(ok(undefined));
    const saveName = vi.fn().mockResolvedValue(ok(undefined));
    const saveTeam = vi
      .fn()
      .mockResolvedValueOnce(err({ kind: 'team' }))
      .mockResolvedValueOnce(ok(undefined));
    const onClose = vi.fn();
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName },
        teamControls: () => ({
          settings: { isTeamChannel: false, autoJoinTeam: false },
          canManage: true,
          canConvert: true,
          save: saveTeam,
        }),
        onClose,
      });
    });
    state.changePicture(null);
    state.changeName(' New design ');
    state.changeTeamChannel(true);
    state.changeAutoJoinTeam(true);
    await state.save();
    expect(savePicture).toHaveBeenCalledExactlyOnceWith(null);
    expect(saveName).toHaveBeenCalledExactlyOnceWith('New design');
    expect(saveTeam).toHaveBeenCalledExactlyOnceWith({
      convertToTeam: true,
      autoJoinTeam: true,
    });
    expect(state.error()).toContain('Some changes were saved');
    expect(state.dirty()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await state.save();
    expect(savePicture).toHaveBeenCalledOnce();
    expect(saveName).toHaveBeenCalledOnce();
    expect(saveTeam).toHaveBeenCalledTimes(2);
    expect(saveTeam).toHaveBeenNthCalledWith(2, {
      convertToTeam: true,
      autoJoinTeam: true,
    });
    expect(state.dirty()).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('finishes captured team writes after disposal without closing another editor', async () => {
    let finishPicture!: (
      result: Result<void, ChannelIdentitySaveError>
    ) => void;
    const savePicture = vi.fn(
      () =>
        new Promise<Result<void, ChannelIdentitySaveError>>((resolve) => {
          finishPicture = resolve;
        })
    );
    const saveTeam = vi.fn().mockResolvedValue(ok(undefined));
    const oldClose = vi.fn();
    const newClose = vi.fn();
    let disposeOld!: () => void;
    const oldState = createRoot((cleanup) => {
      disposeOld = cleanup;
      return createChannelIdentityEditor({
        name: 'Design',
        canEdit: () => true,
        writer: { savePicture, saveName: vi.fn() },
        teamControls: () => ({
          settings: { isTeamChannel: false, autoJoinTeam: false },
          canManage: true,
          canConvert: true,
          save: saveTeam,
        }),
        onClose: oldClose,
      });
    });
    oldState.changePicture(null);
    oldState.changeTeamChannel(true);
    oldState.changeAutoJoinTeam(true);
    const saving = oldState.save();
    disposeOld();
    const newState = createRoot((cleanup) => {
      dispose = cleanup;
      return createChannelIdentityEditor({
        name: 'Other channel',
        canEdit: () => true,
        writer: { savePicture: vi.fn(), saveName: vi.fn() },
        onClose: newClose,
      });
    });
    finishPicture(ok(undefined));
    await saving;
    expect(saveTeam).toHaveBeenCalledExactlyOnceWith({
      convertToTeam: true,
      autoJoinTeam: true,
    });
    expect(oldClose).not.toHaveBeenCalled();
    expect(newClose).not.toHaveBeenCalled();
    expect(newState.name()).toBe('Other channel');
  });
});
