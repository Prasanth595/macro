import { toast } from '@core/component/Toast/Toast';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { showTaskCreatedToast } from './taskCreatedToast';

vi.mock('@core/component/Toast/Toast', () => ({
  toast: { success: vi.fn(), failure: vi.fn() },
}));

const writeText = vi.fn();
const openWithSplit = vi.fn();
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard'
);
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});
afterEach(() => {
  vi.resetAllMocks();
  if (originalClipboard)
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it('announces the task while the clipboard write is still pending', async () => {
  writeText.mockReturnValue(new Promise<void>(() => {}));

  void showTaskCreatedToast('task-1', undefined, openWithSplit);
  await settle();

  expect(toast.success).toHaveBeenCalledTimes(1);
});

it('opens the created task from the toast and copies its link', async () => {
  writeText.mockResolvedValue(undefined);

  void showTaskCreatedToast('task-1', undefined, openWithSplit);
  await settle();

  expect(writeText).toHaveBeenCalledWith(
    expect.stringMatching(/\/task\/task-1$/)
  );
  const [, options] = vi.mocked(toast.success).mock.calls[0];
  options?.actions?.find((action) => action.label === 'Open')?.onClick();
  expect(openWithSplit).toHaveBeenCalledWith(
    { type: 'task', id: 'task-1' },
    { referredFrom: null }
  );
});

it('keeps the task toast when the clipboard denies the write', async () => {
  writeText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

  void showTaskCreatedToast('task-1', undefined, openWithSplit);
  await settle();

  expect(toast.success).toHaveBeenCalledTimes(1);
  expect(toast.failure).not.toHaveBeenCalled();
});
