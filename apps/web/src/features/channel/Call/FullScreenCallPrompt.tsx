import { makePersistedState } from '@app/lib/persistence';
import { toast } from '@core/component/Toast/Toast';
import { useTutorialCompleted } from '@core/context/user';
import { fireAndForget } from '@core/util/fireAndForget';
import { isPlatform } from '@core/util/platform';
import { useNotificationSettings } from '@notifications/notification-settings';
import PhoneIncoming from '@phosphor/phone-incoming.svg';
import { useIsAuthenticated } from '@queries/auth';
import { invoke } from '@tauri-apps/api/core';
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { z } from 'zod';
import { isNativeCallEnabled } from './native-call-platform';

const DISMISSED_KEY = 'full-screen-call-prompt-dismissed';
const fullScreenIntentState = z.object({ allowed: z.boolean() });

async function canUseFullScreenIntent(): Promise<boolean> {
  const state = await invoke<unknown>(
    'plugin:call-kit|can_use_full_screen_intent'
  ).catch((err) => {
    // Builds before this command can't report it; don't prompt there.
    console.error('[callkit] failed to read full-screen intent access', err);
    return null;
  });
  return fullScreenIntentState.safeParse(state).data?.allowed ?? true;
}

async function openFullScreenIntentSettings(): Promise<void> {
  await invoke('plugin:call-kit|open_full_screen_intent_settings').catch(
    (err) =>
      console.error('[callkit] failed to open full-screen intent settings', err)
  );
}

/**
 * Android 14+ revokes full-screen notifications by default, so a ringing call
 * can't open over the lock screen until the user allows them.
 */
export function FullScreenCallPrompt() {
  if (!isPlatform('android') || !isNativeCallEnabled()) return null;

  const settings = useNotificationSettings();
  const isAuthenticated = useIsAuthenticated();
  const tutorialCompleted = useTutorialCompleted();
  const [blocked, setBlocked] = createSignal(false);
  const [dismissed, setDismissed] = makePersistedState(createSignal(false), {
    storages: {
      restore: () =>
        localStorage.getItem(DISMISSED_KEY) === 'true' ? true : undefined,
      write: (value) => {
        if (value) localStorage.setItem(DISMISSED_KEY, 'true');
      },
    },
  });

  onMount(() =>
    fireAndForget(
      (async () => setBlocked(!(await canUseFullScreenIntent())))(),
      'channel-call'
    )
  );

  // Calls only ring once notifications are on; that prompt comes first.
  const shouldShow = createMemo(
    () =>
      blocked() &&
      !dismissed() &&
      isAuthenticated() &&
      !!tutorialCompleted() &&
      settings.isSupported &&
      settings.isEnabled()
  );

  return (
    <Show when={shouldShow()}>
      <FullScreenCallToastTrigger onHide={() => setDismissed(true)} />
    </Show>
  );
}

function FullScreenCallToastTrigger(props: { onHide: () => void }) {
  onMount(() => {
    const toastId = toast.custom(
      {
        title: 'Show Calls on Your Lock Screen',
        icon: PhoneIncoming,
        color: 'var(--color-accent)',
        content: () => (
          <div class="text-xs text-ink-extra-muted">
            Allow full-screen notifications so incoming calls open even when
            your phone is locked.
          </div>
        ),
        actions: [
          {
            label: 'Hide',
            onClick: () => {
              props.onHide();
              toast.dismiss(toastId);
            },
          },
          {
            label: 'Allow',
            onClick: async () => {
              await openFullScreenIntentSettings();
              toast.dismiss(toastId);
            },
          },
        ],
      },
      { persistent: true }
    );
    onCleanup(() => toast.dismiss(toastId));
  });

  return null;
}
