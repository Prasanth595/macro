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
  viewerId: Accessor<string | undefined>;
  enabled: Accessor<boolean>;
  warnings: Accessor<readonly CalendarSyncWarning[]>;
  loaded: Accessor<boolean>;
};

// Home previews and Calendar splits can coexist. Own their global notices once,
// keeping dismissals until the last calendar host leaves.
const useCalendarSyncNotices = createSharedRoot(() => {
  const [sources, setSources] = createSignal<readonly WarningSource[]>([]);
  const activeSources = createMemo(() => {
    const active = sources().filter(
      (source) => source.enabled() && source.viewerId() !== undefined
    );
    const viewerId = active[0]?.viewerId();
    return active.filter((source) => source.viewerId() === viewerId);
  });
  const observation = createMemo<{
    viewerId: string | undefined;
    warnings: CalendarSyncWarning[];
  }>((previous) => {
    const active = activeSources();
    const viewerId = active[0]?.viewerId();
    if (viewerId === undefined) return { viewerId, warnings: [] };
    const confirmed = active.filter((source) => source.loaded());
    // Query handoffs can drop placeholder data on error. Keep observations in
    // this shared owner so another loading host can take over the same notice.
    if (confirmed.length === 0 && previous && previous.viewerId === viewerId) {
      return previous;
    }
    const byId = new Map<string, CalendarSyncWarning>();
    for (const source of confirmed.length > 0 ? confirmed : active) {
      for (const warning of source.warnings()) byId.set(warning.id, warning);
    }
    // An unanswered empty source is not an observation of a healthy calendar.
    const hasObservation = confirmed.length > 0 || byId.size > 0;
    return {
      viewerId: hasObservation ? viewerId : undefined,
      warnings: [...byId.values()],
    };
  });
  const warnings = () => observation().warnings;
  useKeyedPersistentToasts({
    items: warnings,
    itemsLoaded: () => activeSources().some((source) => source.loaded()),
    // Diagnostics can contain a different trace on every retry. Only a change
    // in the user-facing problem should replace a notice or undo dismissal.
    key: (warning) =>
      `${observation().viewerId}:${warning.id}:${warning.issue.kind}`,
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
  viewerId: string | undefined;
  enabled?: boolean;
  warnings: readonly CalendarSyncWarning[];
  loaded: boolean;
}) {
  const register = useCalendarSyncNotices();
  onMount(() => {
    const unregister = register({
      viewerId: () => props.viewerId,
      enabled: () => props.enabled !== false,
      warnings: () => props.warnings,
      loaded: () => props.loaded,
    });
    onCleanup(unregister);
  });
  return null;
}
