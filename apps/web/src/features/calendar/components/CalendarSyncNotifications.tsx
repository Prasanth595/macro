import { useKeyedPersistentToasts } from '@core/component/Toast/useKeyedPersistentToasts';
import WarningIcon from '@icon/system/regular/warning.svg';
import { createSharedRoot } from '@solid-primitives/rootless';
import {
  type Accessor,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import type { CalendarSyncIssue } from '../utils/calendar-sync-issue';

export type CalendarSyncWarning = {
  id: string;
  name: string;
  emailAddress: string;
  issue: CalendarSyncIssue;
};

type WarningSource = {
  warnings: Accessor<readonly CalendarSyncWarning[]>;
  loaded: Accessor<boolean>;
};

// Home previews and Calendar splits can coexist. Own their global notices once,
// keeping dismissals until the last calendar host leaves.
const useCalendarSyncNotices = createSharedRoot(() => {
  const [sources, setSources] = createSignal<readonly WarningSource[]>([]);
  const warnings = createMemo(() => [
    ...new Map(
      sources().flatMap((source) =>
        source.warnings().map((warning) => [warning.id, warning] as const)
      )
    ).values(),
  ]);
  useKeyedPersistentToasts({
    items: warnings,
    itemsLoaded: () => sources().every((source) => source.loaded()),
    // Diagnostics can contain a different trace on every retry. Only a change
    // in the user-facing problem should replace a notice or undo dismissal.
    key: (warning) => `${warning.id}:${warning.issue.kind}`,
    toast: (warning) => ({
      title: warning.issue.title,
      icon: WarningIcon,
      color: 'var(--color-alert)',
      content: () => {
        const current = () =>
          warnings().find((item) => item.id === warning.id) ?? warning;
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

  return (source: WarningSource) => {
    setSources((current) => [...current, source]);
    return () =>
      setSources((current) => current.filter((item) => item !== source));
  };
});

/** Persistent, dismissible sync notices using the app's shared toast surface. */
export function CalendarSyncNotifications(props: {
  warnings: readonly CalendarSyncWarning[];
  loaded: boolean;
}) {
  const register = useCalendarSyncNotices();
  onMount(() => {
    const unregister = register({
      warnings: () => props.warnings,
      loaded: () => props.loaded,
    });
    onCleanup(unregister);
  });
  return null;
}
