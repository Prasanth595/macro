import { Dialog } from '@kobalte/core/dialog';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecipientSelector } from './RecipientSelector';

vi.mock('@core/context/user', () => ({
  useUserId: () => () => undefined,
  useEmail: () => () => undefined,
}));
vi.mock('@core/user/dmActivity', () => ({
  useAugmentUserWithDmActivity: () => (user: unknown) => user,
}));

beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('lets Escape dismiss its dialog when the recipient menu and search are empty', async () => {
  const [open, setOpen] = createSignal(true);
  render(() => (
    <Dialog open={open()} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Content>
          <Dialog.Title>Share database</Dialog.Title>
          <RecipientSelector
            options={() => []}
            selectedOptions={[]}
            setSelectedOptions={() => {}}
            focusOnMount
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  ));
  const input = screen.getByRole('combobox');
  await waitFor(() => expect(document.activeElement).toBe(input));
  fireEvent.keyDown(input, { key: 'Escape', bubbles: true });
  expect(open()).toBe(false);
});
