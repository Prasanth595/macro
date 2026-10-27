import { useKeyedPersistentToasts } from '@core/component/Toast/useKeyedPersistentToasts';
import WarningIcon from '@icon/system/regular/warning.svg';
import { Show } from 'solid-js';
import type { CalendarSyncIssue } from '../utils/calendar-sync-issue';

export type CalendarSyncWarning = {
  id: string;
  name: string;
  emailAddress: string;
  issue: CalendarSyncIssue;
};

/** Persistent, dismissible sync notices using the app's shared toast surface. */
export function CalendarSyncNotifications(props: {
  warnings: readonly CalendarSyncWarning[];
  loaded: boolean;
}) {
  useKeyedPersistentToasts({
    items: () => props.warnings,
    itemsLoaded: () => props.loaded,
    // Diagnostics can contain a different trace on every retry. Only a change
    // in the user-facing problem should replace a notice or undo dismissal.
    key: (warning) => `${warning.id}:${warning.issue.kind}`,
    toast: (warning) => ({
      title: warning.issue.title,
      icon: WarningIcon,
      color: 'var(--color-alert)',
      content: () => {
        const current = () =>
          props.warnings.find((item) => item.id === warning.id) ?? warning;
        return (
          <div class="flex flex-col gap-1">
            <div>
              <span class="font-medium text-ink">{current().name}</span>
              <Show when={current().name !== current().emailAddress}>
                <span class="block text-ink-extra-muted">
                  {current().emailAddress}
                </span>
              </Show>
            </div>
            <p>{current().issue.description}</p>
          </div>
        );
      },
    }),
  });

  return null;
}
