import type {
  PlatformNotificationData,
  PlatformNotificationHandle,
} from '@notifications';
import { Channel, invoke } from '@tauri-apps/api/core';

type NotificationEvent = 'click' | 'dismissed';

export async function showLinuxNotification(
  data: PlatformNotificationData
): Promise<PlatformNotificationHandle> {
  const clicks: (() => void)[] = [];
  const dismissals: (() => void)[] = [];
  let finished: NotificationEvent | undefined;
  const events = new Channel<NotificationEvent>((event) => {
    if (finished) return;
    finished = event;
    const callbacks = event === 'click' ? clicks : dismissals;
    for (const callback of callbacks) callback();
    clicks.length = 0;
    dismissals.length = 0;
  });
  let id: string;
  try {
    id = await invoke<string>('send_linux_notification', {
      title: data.title,
      body: data.options?.body,
      icon: data.options?.icon,
      onEvent: events,
    });
  } catch (error) {
    if (error === 'Command send_linux_notification not found') {
      throw new Error('Update Macro to receive desktop notifications.', {
        cause: error,
      });
    }
    throw error;
  }

  let closing = false;
  async function close() {
    if (finished || closing) return;
    closing = true;
    try {
      await invoke('close_linux_notification', { id });
    } catch (error) {
      closing = false;
      console.error('Failed to close Linux notification', error);
    }
  }

  return {
    onClick(callback) {
      // The daemon can deliver a click before the command returns, or before
      // the caller has registered its navigation callback. Replay it once.
      if (finished === 'click') callback();
      else if (!finished) clicks.push(callback);
    },
    onDismiss(callback) {
      if (finished === 'dismissed') callback();
      else if (!finished) dismissals.push(callback);
    },
    close() {
      void close();
    },
  };
}
