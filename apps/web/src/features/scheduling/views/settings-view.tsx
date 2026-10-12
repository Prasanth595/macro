import {
  SettingsButton as Button,
  SettingsPage,
  SettingsSection,
} from '@app/features/settings/primitives';
import ArrowRight from '@phosphor/arrow-right.svg';
import { createMemo, For, mapArray, Show } from 'solid-js';
import { useScheduling } from '../context/scheduling-context';
import { createSchedulingOwner } from '../primitives/create-scheduling-owner';
import { OwnerSettingsSection } from './owner-settings-section';

/** Account-level configuration only; day-to-day management lives in Calendar. */
export function SchedulingSettingsView(props: {
  onOpenWorkspace?: () => void;
}) {
  const capabilities = useScheduling();
  const owners = createMemo(
    mapArray(
      () => capabilities.scopes().map((scope) => scope.id),
      (id) =>
        createSchedulingOwner(
          capabilities,
          () => capabilities.scopes().find((scope) => scope.id === id)!,
          () => ({
            from: new Date().toISOString(),
            to: new Date().toISOString(),
          }),
          () => false
        )
    )
  );
  return (
    <SettingsPage
      title="Booking links"
      description="Customize the booking page guests see when you share a link."
    >
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-edge-muted p-4">
        <div>
          <h2 class="text-sm font-medium">Manage booking links in Calendar</h2>
          <p class="mt-1 text-sm text-ink-muted">
            Create links, set availability, and manage bookings in your
            dedicated workspace.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!props.onOpenWorkspace}
          onClick={props.onOpenWorkspace}
        >
          Open booking links
          <ArrowRight class="size-4" />
        </Button>
      </div>
      <SettingsSection
        title="Booking page"
        description="Your display name and introduction appear on your public booking page."
      >
        <For each={owners()}>
          {(owner) => (
            <>
              <Show when={owner.source.loading()}>
                <p role="status" class="text-sm text-ink-muted">
                  Loading {owner.scope().name} booking settings…
                </p>
              </Show>
              <Show when={owner.source.error() || owner.error()}>
                <div
                  role="alert"
                  class="flex items-center gap-3 text-sm text-failure"
                >
                  <p>{owner.source.error() || owner.error()}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={owner.source.reload}
                  >
                    Try again
                  </Button>
                </div>
              </Show>
              <Show when={!owner.scope().canEdit}>
                <p class="text-sm text-ink-muted">
                  Only team owners and admins can edit {owner.scope().name}{' '}
                  booking settings.
                </p>
              </Show>
              <OwnerSettingsSection kind="page" owner={owner} />
            </>
          )}
        </For>
      </SettingsSection>
    </SettingsPage>
  );
}
