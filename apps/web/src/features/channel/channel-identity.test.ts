import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { HoverCard } from '@ui/components/HoverCard';
import { err, ok } from 'neverthrow';
import { createComponent, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChannelIdentityDialog,
  ChannelIdentityTitle,
  ChannelTitleHoverCard,
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
  it.each(['hover', 'inline'] as const)(
    'opens a single %s popup from an external Edit channel action',
    async (surface) => {
      const [open, setOpen] = createSignal(false);
      const action = document.createElement('button');
      action.textContent = 'Edit channel';
      action.onclick = () => setOpen(true);
      render(() => [
        action,
        createComponent(
          surface === 'hover' ? ChannelTitleHoverCard : ChannelIdentityTitle,
          {
            channelId: 'design',
            name: 'Design',
            canEdit: true,
            children: 'Design',
            get open() {
              return open();
            },
            onOpenChange: setOpen,
          }
        ),
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Edit channel' }));
      const input = await screen.findByRole('textbox', {
        name: 'Channel name',
      });
      expect(
        screen.getAllByRole('form', { name: 'Edit channel' })
      ).toHaveLength(1);
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.input(input, { target: { value: 'Unsaved design' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(open()).toBe(false);
      expect(testState.saveName).not.toHaveBeenCalled();
      fireEvent.click(action);
      expect(
        (
          await screen.findByRole<HTMLInputElement>('textbox', {
            name: 'Channel name',
          })
        ).value
      ).toBe('Design');
    }
  );
  it('retains an unsaved draft when another rich hover card opens', async () => {
    const [otherOpen, setOtherOpen] = createSignal(false);
    render(() => [
      createComponent(ChannelTitleHoverCard, {
        channelId: 'design',
        name: 'Design',
        canEdit: true,
        children: 'Design',
      }),
      createComponent(HoverCard, {
        get open() {
          return otherOpen();
        },
        onOpenChange: setOtherOpen,
        children: 'Another preview',
        content: 'Another card',
      }),
    ]);
    screen.getByLabelText('Edit channel details').focus();
    const input = await screen.findByRole('textbox', { name: 'Channel name' });
    fireEvent.input(input, { target: { value: 'Unsaved design' } });
    setOtherOpen(true);
    await screen.findByText('Another card');
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Channel name' })
        .value
    ).toBe('Unsaved design');
    expect(testState.saveName).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Channel name' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Design' }));
    const input = await screen.findByRole('textbox', { name: 'Channel name' });
    fireEvent.input(input, { target: { value: 'Mobile design' } });
    expect(testState.saveName).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(testState.saveName).toHaveBeenCalledWith('Mobile design', 'design');
  });

  it('keeps cancellation available when edit permission is lost with a draft open', async () => {
    const [canEdit, setCanEdit] = createSignal(true);
    render(() =>
      createComponent(ChannelTitleHoverCard, {
        channelId: 'design',
        name: 'Design',
        get canEdit() {
          return canEdit();
        },
        children: 'Design',
      })
    );
    screen.getByLabelText('Edit channel details').focus();
    const input = await screen.findByRole('textbox', { name: 'Channel name' });
    fireEvent.input(input, { target: { value: 'Unsaved design' } });
    setCanEdit(false);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('textbox', { name: 'Channel name' })).toBeNull();
    expect(testState.saveName).not.toHaveBeenCalled();
  });
  it.each(['hover', 'dialog'] as const)(
    'binds the %s editor draft and writes to the newly selected channel',
    async (surface) => {
      const [channel, setChannel] = createSignal({
        id: 'design',
        name: 'Design',
      });
      const props = {
        get channelId() {
          return channel().id;
        },
        get name() {
          return channel().name;
        },
        canEdit: true,
        children: 'Channel title',
      };
      render(() =>
        surface === 'hover'
          ? createComponent(ChannelTitleHoverCard, props)
          : createComponent(ChannelIdentityDialog, {
              ...props,
              get channelId() {
                return channel().id;
              },
              get name() {
                return channel().name;
              },
              open: true,
              onClose: vi.fn(),
            })
      );
      if (surface === 'hover')
        screen.getByLabelText('Edit channel details').focus();
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
    }
  );

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
        files: [new File(['image'], 'design.png', { type: 'image/png' })],
      },
    });
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
        files: [new File(['image'], 'design.png', { type: 'image/png' })],
      },
    });
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
