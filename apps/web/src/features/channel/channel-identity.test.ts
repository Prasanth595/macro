import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { HoverCard } from '@ui/components/HoverCard';
import { ok } from 'neverthrow';
import { createComponent, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChannelIdentityTitle,
  ChannelTitleHoverCard,
} from './channel-identity';

const testState = vi.hoisted(() => ({
  touch: false,
  saveName: vi.fn(),
  savePicture: vi.fn(),
}));

vi.mock('@core/mobile/isTouchDevice', () => ({
  isTouchDevice: () => testState.touch,
}));
// The touch entry works on tablets too; the phone drawer is covered in the browser.
vi.mock('@core/mobile/isMobile', () => ({ isMobile: () => false }));
vi.mock('@core/util/create', () => ({ createStaticFile: vi.fn() }));
vi.mock('@queries/channel/picture', () => ({
  useChannelPicture: () => ({
    pictureId: () => undefined,
    largeUrl: () => undefined,
    isLoading: () => false,
  }),
  useChannelPictureFileName: () => () => undefined,
}));
vi.mock('./queries/channel-identity', () => ({
  createChannelIdentityWriter: () => ({
    saveName: testState.saveName,
    savePicture: testState.savePicture,
  }),
}));

beforeEach(() => {
  testState.touch = false;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  testState.saveName.mockReset().mockResolvedValue(ok(undefined));
  testState.savePicture.mockReset().mockResolvedValue(ok(undefined));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('channel title editing', () => {
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
    expect(testState.saveName).toHaveBeenCalledWith('Mobile design');
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
});
