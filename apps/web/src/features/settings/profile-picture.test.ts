import { err, ok } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';
import { createProfilePictureWriter } from './queries/profile-picture';

vi.mock('@macro-inc/observability', () => ({
  Telemetry: {
    span: async (
      _name: string,
      work: (span: { setAttr: () => void; error: () => void }) => unknown
    ) => work({ setAttr: vi.fn(), error: vi.fn() }),
  },
}));

describe('profile picture persistence', () => {
  it('reuses an uploaded file after a failed profile update and publishes only successful changes', async () => {
    const upload = vi.fn().mockResolvedValue('picture-id');
    const update = vi
      .fn()
      .mockResolvedValueOnce(err('unavailable'))
      .mockResolvedValue(ok({}));
    const onSaved = vi.fn();
    const writer = createProfilePictureWriter({
      userId: 'user-1',
      isCurrentUser: () => true,
      upload,
      pictureUrl: (id) => `https://static.example/${id}`,
      update,
      onSaved,
    });
    const file = new File(['image'], 'portrait.png', { type: 'image/png' });
    expect((await writer(file)).isErr()).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
    expect((await writer(file)).isOk()).toBe(true);
    expect(upload).toHaveBeenCalledExactlyOnceWith(file);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      'https://static.example/picture-id'
    );
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(
      'https://static.example/picture-id'
    );
  });

  it('clears through the profile API without uploading and updates the cache only after success', async () => {
    const upload = vi.fn();
    const update = vi.fn().mockResolvedValue(ok({}));
    const onSaved = vi.fn();
    const writer = createProfilePictureWriter({
      userId: 'user-1',
      isCurrentUser: () => true,
      upload,
      pictureUrl: (id) => id,
      update,
      onSaved,
    });
    expect((await writer(null)).isOk()).toBe(true);
    expect(upload).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledExactlyOnceWith('');
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('does not update another account after the user changes during upload', async () => {
    let current = true;
    const uploaded = Promise.withResolvers<string>();
    const upload = vi.fn(() => uploaded.promise);
    const update = vi.fn();
    const onSaved = vi.fn();
    const writer = createProfilePictureWriter({
      userId: 'user-1',
      isCurrentUser: () => current,
      upload,
      pictureUrl: (id) => id,
      update,
      onSaved,
    });
    const saving = writer(
      new File(['image'], 'portrait.png', { type: 'image/png' })
    );
    current = false;
    uploaded.resolve('picture-id');
    expect((await saving).isErr()).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect((await writer(null)).isErr()).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not publish a previous account picture when the account changes during the update', async () => {
    let current = true;
    const response = Promise.withResolvers<ReturnType<typeof ok>>();
    const onSaved = vi.fn();
    const writer = createProfilePictureWriter({
      userId: 'user-1',
      isCurrentUser: () => current,
      upload: vi.fn(),
      pictureUrl: (id) => id,
      update: () => response.promise,
      onSaved,
    });
    const saving = writer(null);
    current = false;
    response.resolve(ok(undefined));
    await saving;
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('rejects unsupported and oversized files without side effects', async () => {
    const upload = vi.fn();
    const update = vi.fn();
    const onSaved = vi.fn();
    const writer = createProfilePictureWriter({
      userId: 'user-1',
      isCurrentUser: () => true,
      upload,
      pictureUrl: (id) => id,
      update,
      onSaved,
    });
    expect(
      (
        await writer(new File(['text'], 'notes.txt', { type: 'text/plain' }))
      ).isErr()
    ).toBe(true);
    const large = new File([new Uint8Array(16_000_001)], 'large.png', {
      type: 'image/png',
    });
    expect((await writer(large)).isErr()).toBe(true);
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('retains failures as Results when the upload or update throws', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('offline'));
    const update = vi.fn().mockRejectedValue(new Error('offline'));
    const onSaved = vi.fn();
    const writer = createProfilePictureWriter({
      userId: 'user-1',
      isCurrentUser: () => true,
      upload,
      pictureUrl: (id) => id,
      update,
      onSaved,
    });
    expect(
      (
        await writer(new File(['image'], 'portrait.png', { type: 'image/png' }))
      ).isErr()
    ).toBe(true);
    expect((await writer(null)).isErr()).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
