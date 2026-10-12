import {
  SettingsButton as Button,
  SettingsPage,
  SettingsSection,
} from '@app/features/settings/primitives';
import { Tabs } from '@kobalte/core/tabs';
import Plus from '@phosphor/plus.svg';
import { createMemo, createSignal, For, mapArray, Show } from 'solid-js';
import { Field, TextInput } from '../components/fields';
import { OwnerBadge } from '../components/owner-badge';
import { useScheduling } from '../context/scheduling-context';
import { reportDate, shiftReportDate } from '../core/insights';
import {
  createSchedulingOwner,
  type SchedulingOwner,
} from '../primitives/create-scheduling-owner';
import { OwnerSettingsSection } from './owner-settings-section';

function CreateAction(props: {
  owners: SchedulingOwner[];
  kind: 'event' | 'schedule';
}) {
  let trigger: HTMLButtonElement | undefined;
  const label = () =>
    props.kind === 'event' ? 'New booking link' : 'New schedule';
  const editable = () => props.owners.filter((owner) => owner.scope().canEdit);
  const disabled = (owner: SchedulingOwner) =>
    !owner.source.profile() ||
    owner.source.saving() ||
    owner.creating() ||
    !!(props.kind === 'event' ? owner.event() : owner.schedule());
  const create = (owner: SchedulingOwner) => {
    if (props.kind === 'event')
      void owner.action(() => owner.createEvent(trigger));
    else owner.createSchedule(trigger);
  };
  return (
    <Show when={editable()[0]}>
      {(owner) => (
        <Button
          ref={trigger}
          variant="strong"
          size="sm"
          disabled={disabled(owner())}
          onClick={() => create(owner())}
        >
          <Plus class="size-4" />
          {label()}
        </Button>
      )}
    </Show>
  );
}

export function SchedulingSettingsView() {
  const capabilities = useScheduling();
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = reportDate(new Date(), browserZone);
  const [bookingFrom, setBookingFrom] = createSignal(
    shiftReportDate(today, -30)
  );
  const [bookingTo, setBookingTo] = createSignal(shiftReportDate(today, 30));
  const [search, setSearch] = createSignal('');
  const [selectedOwner, setSelectedOwner] = createSignal<string>();
  const [sectionTab, setSectionTab] = createSignal('links');
  const activeOwnerId = () =>
    selectedOwner() &&
    capabilities.scopes().some((s) => s.id === selectedOwner())
      ? selectedOwner()
      : capabilities.scopes()[0]?.id;
  // Key by ID so profile updates and refreshed team metadata keep drafts mounted.
  const owners = createMemo(
    mapArray(
      () => capabilities.scopes().map((scope) => scope.id),
      (id) => {
        const scope = () =>
          capabilities.scopes().find((item) => item.id === id)!;
        return createSchedulingOwner(capabilities, scope, () => ({
          from: new Date(`${bookingFrom()}T00:00:00`).toISOString(),
          to: new Date(
            `${shiftReportDate(bookingTo(), 1)}T00:00:00`
          ).toISOString(),
        }));
      }
    )
  );
  const activeOwners = () =>
    owners().filter((owner) => owner.scope().id === activeOwnerId());
  const matching = (owner: SchedulingOwner) =>
    owner.source
      .profile()
      ?.eventTypes.some((event) =>
        `${event.title} ${event.slug} ${owner.scope().name} ${owner.scope().teamId ? 'team' : 'personal'}`
          .toLowerCase()
          .includes(search().trim().toLowerCase())
      );
  const section = (kind: 'availability' | 'page' | 'bookings' | 'insights') => (
    <div class="flex flex-col gap-8">
      <For each={owners()}>
        {(owner) => (
          <div hidden={owner.scope().id !== activeOwnerId()}>
            <Show
              when={
                owner.scope().id === activeOwnerId() ||
                (kind === 'availability' && owner.schedule())
              }
            >
              <OwnerSettingsSection kind={kind} owner={owner} />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
  return (
    <SettingsPage
      title="Booking links"
      description="Choose whose booking links to manage, then set up how and when people can meet."
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Booking link owner"
            class="flex flex-wrap gap-2"
          >
            <For each={owners()}>
              {(owner) => (
                <button
                  type="button"
                  aria-pressed={activeOwnerId() === owner.scope().id}
                  class="rounded-lg border px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  classList={{
                    'border-ink bg-ink text-panel':
                      activeOwnerId() === owner.scope().id,
                    'border-edge-muted text-ink-muted hover:bg-hover':
                      activeOwnerId() !== owner.scope().id,
                  }}
                  onClick={() => {
                    setSelectedOwner(owner.scope().id);
                    setSearch('');
                  }}
                >
                  {owner.scope().teamId
                    ? `Team · ${owner.scope().name}`
                    : 'Personal'}
                </button>
              )}
            </For>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={capabilities.openTeamSettings}
          >
            Manage teams
          </Button>
        </div>
        <p class="text-sm text-ink-muted">
          {activeOwners()[0]?.scope().teamId
            ? 'Team links bring guests together with selected team members. Each host’s personal availability still applies.'
            : 'Personal links book time with you. Your default availability also applies when you host team meetings.'}
        </p>
      </div>
      <Tabs value={sectionTab()} onChange={setSectionTab}>
        <Tabs.List
          aria-label="Booking link settings"
          class="flex gap-5 overflow-x-auto border-b border-edge-muted"
        >
          <For
            each={[
              { value: 'links', label: 'Links' },
              { value: 'availability', label: 'Availability' },
              { value: 'page', label: 'Booking page' },
              { value: 'bookings', label: 'Bookings' },
              { value: 'insights', label: 'Insights' },
            ]}
          >
            {(tab) => (
              <Tabs.Trigger
                value={tab.value}
                class="shrink-0 border-b-2 border-transparent py-3 text-sm text-ink-muted outline-none data-selected:border-ink data-selected:text-ink focus-visible:ring-2 focus-visible:ring-ink"
              >
                {tab.label}
              </Tabs.Trigger>
            )}
          </For>
        </Tabs.List>
        <For each={activeOwners()}>
          {(owner) => (
            <>
              <Show when={owner.source.loading()}>
                <p role="status" class="text-sm text-ink-muted">
                  Loading {owner.scope().name} scheduling…
                </p>
              </Show>
              <Show when={owner.source.error() || owner.error()}>
                <div
                  role="alert"
                  class="flex flex-wrap items-center gap-3 rounded-xl border border-edge-muted p-4"
                >
                  <OwnerBadge scope={owner.scope()} />
                  <p class="flex-1 text-sm text-failure">
                    {owner.error() || owner.source.error()}
                  </p>
                  <Show when={owner.source.error()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={owner.source.reload}
                    >
                      Try again
                    </Button>
                  </Show>
                </div>
              </Show>
              <Show when={!owner.scope().canEdit}>
                <p class="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <OwnerBadge scope={owner.scope()} />
                  Only team owners and admins can edit these settings.
                </p>
              </Show>
            </>
          )}
        </For>
        <Tabs.Content
          value="links"
          class="pt-6"
          forceMount={owners().some((owner) => !!owner.event())}
          hidden={sectionTab() !== 'links'}
        >
          <SettingsSection
            title="Booking links"
            description="Reusable links guests can use to choose a time."
            actions={<CreateAction owners={activeOwners()} kind="event" />}
          >
            <div class="max-w-sm">
              <TextInput
                type="search"
                aria-label="Search booking links"
                placeholder="Search booking links…"
                value={search()}
                onInput={(event) => setSearch(event.currentTarget.value)}
              />
            </div>
            <For each={owners()}>
              {(owner) => (
                <div hidden={owner.scope().id !== activeOwnerId()}>
                  <Show
                    when={
                      owner.event() ||
                      (owner.scope().id === activeOwnerId() && matching(owner))
                    }
                  >
                    <OwnerSettingsSection
                      kind="links"
                      owner={owner}
                      search={search()}
                    />
                  </Show>
                </div>
              )}
            </For>
            <Show
              when={
                !activeOwners().some(
                  (owner) => owner.event() || matching(owner)
                ) && !activeOwners().some((owner) => owner.source.loading())
              }
            >
              <p class="py-6 text-center text-sm text-ink-muted">
                {search()
                  ? 'No matching booking links.'
                  : 'Create your first booking link to let people book time with you.'}
              </p>
            </Show>
          </SettingsSection>
        </Tabs.Content>
        <Tabs.Content
          value="availability"
          class="pt-6"
          forceMount={owners().some((owner) => !!owner.schedule())}
          hidden={sectionTab() !== 'availability'}
        >
          <SettingsSection
            title="Availability"
            description="Set weekly hours, date exceptions, and your default schedule."
            actions={<CreateAction owners={activeOwners()} kind="schedule" />}
          >
            {section('availability')}
          </SettingsSection>
        </Tabs.Content>
        <Tabs.Content value="page" class="pt-6">
          <SettingsSection
            title="Booking page"
            description="Customize the page that brings these booking links together."
          >
            {section('page')}
          </SettingsSection>
        </Tabs.Content>
        <Tabs.Content value="bookings" class="pt-6">
          <SettingsSection
            title="Bookings"
            description="Review and manage meetings booked through your links."
          >
            <div class="flex flex-wrap items-end gap-4">
              <Field
                label="From"
                hint={`Dates in ${browserZone.replaceAll('_', ' ')}`}
              >
                <TextInput
                  type="date"
                  value={bookingFrom()}
                  max={bookingTo()}
                  onChange={(event) => {
                    if (
                      event.currentTarget.value &&
                      event.currentTarget.value <= bookingTo()
                    )
                      setBookingFrom(event.currentTarget.value);
                  }}
                />
              </Field>
              <Field label="Through">
                <TextInput
                  type="date"
                  value={bookingTo()}
                  min={bookingFrom()}
                  onChange={(event) => {
                    if (
                      event.currentTarget.value &&
                      event.currentTarget.value >= bookingFrom()
                    )
                      setBookingTo(event.currentTarget.value);
                  }}
                />
              </Field>
            </div>
            {section('bookings')}
          </SettingsSection>
        </Tabs.Content>
        <Tabs.Content value="insights" class="pt-6">
          <SettingsSection
            title="Insights"
            description="Booking activity and trends for the selected owner."
          >
            {section('insights')}
          </SettingsSection>
        </Tabs.Content>
      </Tabs>
    </SettingsPage>
  );
}
