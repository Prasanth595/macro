import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { err, ok } from 'neverthrow';
import { createComponent, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChannelIdentityDialog,
  ChannelIdentityTitle,
} from './channel-identity';

const testState = vi.hoisted(() => ({
  touch: false,
  saveName: vi.fn(),
  savePicture: vi.fn(),
  failure: vi.fn(),
}));

vi.mock('@core/mobile/isTouchDevice', () => ({
  isTouchDevice: () => testState.touch,
}));
// The touch entry works on tablets too; the phone drawer is covered in the browser.
vi.mock('@core/mobile/isMobile', () => ({ isMobile: () => false }));
vi.mock('@core/util/create', () => ({ createStaticFile: vi.fn() }));
vi.mock('@core/component/Toast/Toast', () => ({
  toast: { failure: testState.failure },
}));
vi.mock('@queries/channel/picture', () => ({
  useChannelPicture: () => ({
    pictureId: () => undefined,
    largeUrl: () => undefined,
    isLoading: () => false,
  }),
  useChannelPictureFileName: () => () => undefined,
}));
vi.mock('./queries/channel-identity', () => ({
  createChannelIdentityTeamControls: () => () => undefined,
  createChannelIdentityWriter: (options: { channelId: string }) => ({
    saveName: (name: string) => testState.saveName(name, options.channelId),
    savePicture: (file: File | null) =>
      testState.savePicture(file, options.channelId),
  }),
}));

beforeEach(() => {
  testState.touch = false;
  testState.failure.mockReset();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  testState.saveName.mockReset().mockResolvedValue(ok(undefined));
  testState.savePicture.mockReset().mockResolvedValue(ok(undefined));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('channel title editing', () => {
  it.each([false, true])(
    'opens one dialog from an external Edit channel action on touch=%s',
    async (touch) => {
      testState.touch = touch;
      const [open, setOpen] = createSignal(false);
      const action = document.createElement('button');
      action.textContent = 'Edit channel';
      action.onclick = () => setOpen(true);
      render(() => [
        action,
        createComponent(ChannelIdentityTitle, {
          channelId: 'design',
          name: 'Design',
          canEdit: true,
          children: 'Design',
          get open() {
            return open();
          },
          onOpenChange: setOpen,
        }),
      ]);
      action.focus();
      fireEvent.click(action);
      await vi.dynamicImportSettled();
      const input = await screen.findByRole('textbox', {
        name: 'Channel name',
      });
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(
        screen.getAllByRole('form', { name: 'Edit channel' })
      ).toHaveLength(1);
      fireEvent.input(input, { target: { value: 'Unsaved design' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(open()).toBe(false);
      expect(document.activeElement).toBe(action);
      expect(testState.saveName).not.toHaveBeenCalled();
      fireEvent.click(action);
      expect(
        (
          await screen.findByRole<HTMLInputElement>('textbox', {
            name: 'Channel name',
          })
        ).value
      ).toBe('Design');
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    }
  );

  it.each([false, true])(
    'opens on click, not hover or focus, and restores title focus on touch=%s',
    async (touch) => {
      testState.touch = touch;
      render(() =>
        createComponent(ChannelIdentityTitle, {
          channelId: 'design',
          name: 'Design',
          canEdit: true,
          children: 'Design',
        })
      );
      const title = screen.getByRole('button', {
        name: 'Edit channel details',
      });
      fireEvent.mouseEnter(title);
      title.focus();
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(title);
      expect(await screen.findByRole('dialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(title);
    }
  );

  it('leaves a non-editable title as text without opening a dialog', () => {
    render(() =>
      createComponent(ChannelIdentityTitle, {
        channelId: 'design',
        name: 'Design',
        canEdit: false,
        children: 'Design',
      })
    );
    expect(screen.getByText('Design')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Edit channel details' })
    ).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the same draft editor from an inline title on touch', async () => {
    testState.touch = true;
    render(() =>
      createComponent(ChannelIdentityTitle, {
        channelId: 'design',
        name: 'Design',
        canEdit: true,
        children: 'Design',
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit channel details' })
    );
    const input = await screen.findByRole('textbox', { name: 'Channel name' });
    fireEvent.input(input, { target: { value: 'Mobile design' } });
    expect(testState.saveName).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(testState.saveName).toHaveBeenCalledWith('Mobile design', 'design');
  });

  it('keeps cancellation available when edit permission is lost with a draft open', async () => {
    const [canEdit, setCanEdit] = createSignal(true);
    render(() =>
      createComponent(ChannelIdentityTitle, {
        channelId: 'design',
        name: 'Design',
        get canEdit() {
          return canEdit();
        },
        children: 'Design',
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit channel details' })
    );
    const input = await screen.findByRole('textbox', { name: 'Channel name' });
    fireEvent.input(input, { target: { value: 'Unsaved design' } });
    setCanEdit(false);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('textbox', { name: 'Channel name' })).toBeNull();
    expect(testState.saveName).not.toHaveBeenCalled();
  });
  it('binds the dialog draft and writes to the newly selected channel', async () => {
    const [channel, setChannel] = createSignal({
      id: 'design',
      name: 'Design',
    });
    render(() =>
      createComponent(ChannelIdentityDialog, {
        get channelId() {
          return channel().id;
        },
        get name() {
          return channel().name;
        },
        canEdit: true,
        open: true,
        onClose: vi.fn(),
      })
    );
    const firstInput = await screen.findByRole('textbox', {
      name: 'Channel name',
    });
    fireEvent.input(firstInput, { target: { value: 'Unsubmitted design' } });
    setChannel({ id: 'marketing', name: 'Marketing' });
    const input = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'Channel name',
    });
    expect(input.value).toBe('Marketing');
    expect(testState.saveName).not.toHaveBeenCalled();
    fireEvent.input(input, { target: { value: 'Renamed marketing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(testState.saveName).toHaveBeenCalledWith(
      'Renamed marketing',
      'marketing'
    );
  });

  it('completes both submitted fields for the old channel after switching channels', async () => {
    const pending = Promise.withResolvers<unknown>();
    testState.savePicture.mockImplementationOnce(() => pending.promise);
    const onClose = vi.fn();
    const [channel, setChannel] = createSignal({
      id: 'design',
      name: 'Design',
    });
    render(() =>
      createComponent(ChannelIdentityDialog, {
        get channelId() {
          return channel().id;
        },
        get name() {
          return channel().name;
        },
        canEdit: true,
        open: true,
        onClose,
      })
    );
    const input = await screen.findByRole('textbox', { name: 'Channel name' });
    fireEvent.input(input, { target: { value: 'Renamed design' } });
    fireEvent.change(screen.getByLabelText('Choose channel picture'), {
      target: {
        files: [new File(['image'], 'design.gif', { type: 'image/gif' })],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    setChannel({ id: 'marketing', name: 'Marketing' });
    pending.resolve(ok(undefined));
    await pending.promise;
    expect(testState.saveName).toHaveBeenCalledWith('Renamed design', 'design');
    await testState.saveName.mock.results[0].value;
    expect(onClose).not.toHaveBeenCalled();
    expect(
      (
        await screen.findByRole<HTMLInputElement>('textbox', {
          name: 'Channel name',
        })
      ).value
    ).toBe('Marketing');
  });

  it('reports a background save failure without affecting the new channel editor', async () => {
    const pending = Promise.withResolvers<unknown>();
    const reported = Promise.withResolvers<void>();
    testState.savePicture.mockImplementationOnce(() => pending.promise);
    testState.failure.mockImplementation(() => reported.resolve());
    const [channel, setChannel] = createSignal({
      id: 'design',
      name: 'Design',
    });
    render(() =>
      createComponent(ChannelIdentityDialog, {
        get channelId() {
          return channel().id;
        },
        get name() {
          return channel().name;
        },
        canEdit: true,
        open: true,
        onClose: vi.fn(),
      })
    );
    await screen.findByRole('textbox', { name: 'Channel name' });
    fireEvent.change(screen.getByLabelText('Choose channel picture'), {
      target: {
        files: [new File(['image'], 'design.gif', { type: 'image/gif' })],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    setChannel({ id: 'marketing', name: 'Marketing' });
    pending.resolve(err({ kind: 'picture' }));
    await reported.promise;
    expect(testState.failure).toHaveBeenCalledOnce();
    expect(
      (
        await screen.findByRole<HTMLInputElement>('textbox', {
          name: 'Channel name',
        })
      ).value
    ).toBe('Marketing');
  });

  it('does not close a new channel editor when the previous channel save finishes', async () => {
    const pending = Promise.withResolvers<unknown>();
    testState.saveName.mockImplementationOnce(() => pending.promise);
    const onClose = vi.fn();
    const [channel, setChannel] = createSignal({
      id: 'design',
      name: 'Design',
    });
    render(() =>
      createComponent(ChannelIdentityDialog, {
        get channelId() {
          return channel().id;
        },
        get name() {
          return channel().name;
        },
        canEdit: true,
        open: true,
        onClose,
      })
    );
    const firstInput = await screen.findByRole('textbox', {
      name: 'Channel name',
    });
    fireEvent.input(firstInput, { target: { value: 'Renamed design' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    setChannel({ id: 'marketing', name: 'Marketing' });
    pending.resolve(ok(undefined));
    await pending.promise;
    expect(onClose).not.toHaveBeenCalled();
    expect(
      (
        await screen.findByRole<HTMLInputElement>('textbox', {
          name: 'Channel name',
        })
      ).value
    ).toBe('Marketing');
  });
});
