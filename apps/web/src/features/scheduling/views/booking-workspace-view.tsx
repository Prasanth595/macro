import { SearchBar, ViewShell, ViewSidebar } from '@app/components/view-shell';
import PageIcon from '@phosphor/browser.svg';
import CalendarIcon from '@phosphor/calendar-blank.svg';
import ChartIcon from '@phosphor/chart-bar.svg';
import CheckIcon from '@phosphor/check.svg';
import ClockIcon from '@phosphor/clock.svg';
import InfoIcon from '@phosphor/info.svg';
import LinkIcon from '@phosphor/link.svg';
import PlusIcon from '@phosphor/plus.svg';
import UserIcon from '@phosphor/user.svg';
import UsersIcon from '@phosphor/users.svg';
import { Button, cn, pressHandlers } from '@ui';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  mapArray,
  on,
  Show,
} from 'solid-js';
import type { BookingLinksState } from '../booking-links-search';
import { AvailabilityTopBar } from '../components/availability-topbar';
import { Field, TextInput } from '../components/fields';
import { OwnerBadge } from '../components/owner-badge';
import { useScheduling } from '../context/scheduling-context';
import { reportDate, shiftReportDate } from '../core/insights';
import { createSchedulingOwner } from '../primitives/create-scheduling-owner';
import { OwnerSettingsSection } from './owner-settings-section';

const TABS = [
  {
    value: 'links' as const,
    label: 'Booking links',
    icon: LinkIcon,
    description:
      'Create a link, set your availability, and let people book time with you.',
  },
  {
    value: 'availability' as const,
    label: 'Availability',
    icon: ClockIcon,
    description:
      'Set your working hours and make exceptions for specific dates.',
  },
  {
    value: 'bookings' as const,
    label: 'Bookings',
    icon: CalendarIcon,
    description: 'Upcoming and past meetings booked through your links.',
  },
  {
    value: 'insights' as const,
    label: 'Insights',
    icon: ChartIcon,
    description: 'Understand how your booking links are being used.',
  },
  {
    value: 'page' as const,
    label: 'Booking page',
    icon: PageIcon,
    description:
      'Customize your public booking page, preview it, and share its link.',
  },
];

export function BookingWorkspaceView(props: {
  search: BookingLinksState;
  onSearchChange: (patch: Partial<BookingLinksState>) => void;
}) {
  const capabilities = useScheduling();
  const search = props.search;
  const setSearch = props.onSearchChange;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = reportDate(new Date(), zone);
  const [from, setFrom] = createSignal(shiftReportDate(today, -30));
  const [to, setTo] = createSignal(shiftReportDate(today, 30));
  const [query, setQuery] = createSignal('');
  const scopes = createMemo(() => {
    const available = capabilities.scopes();
    return [
      ...available.filter((scope) => !scope.teamId),
      ...available.filter((scope) => scope.teamId),
    ];
  });
  const selectedOwnerId = () =>
    scopes().some((scope) => scope.id === search.owner)
      ? search.owner
      : scopes()[0]?.id;
  const owners = createMemo(
    mapArray(
      () => scopes().map((scope) => scope.id),
      (id) =>
        createSchedulingOwner(
          capabilities,
          () => scopes().find((scope) => scope.id === id)!,
          () => ({
            from: new Date(`${from()}T00:00:00`).toISOString(),
            to: new Date(`${shiftReportDate(to(), 1)}T00:00:00`).toISOString(),
          }),
          () => search.tab === 'bookings' && selectedOwnerId() === id
        )
    )
  );
  const owner = () =>
    owners().find((item) => item.scope().id === selectedOwnerId()) ??
    owners()[0];
  const tab = () => TABS.find((item) => item.value === search.tab) ?? TABS[0];
  const editingSchedule = () =>
    search.tab === 'availability' && !!owner()?.schedule();
  const isSaving = () => owners().some((item) => item.source.saving());
  const discardEditors = () => {
    for (const current of owners()) current.discardEditors();
  };
  // Route history bypasses the UI setters. Dispose drafts when navigation
  // changes their owner or tab, before they can reopen under a stale scope.
  createEffect(
    on(
      [selectedOwnerId, () => search.tab],
      (selection, previous) => {
        if (
          previous &&
          (selection[0] !== previous[0] || selection[1] !== previous[1])
        )
          discardEditors();
      },
      { defer: true }
    )
  );
  const selectTab = (value: string) => {
    if (isSaving()) return;
    const next = TABS.find((item) => item.value === value);
    if (!next || next.value === search.tab) return;
    discardEditors();
    setSearch({ tab: next.value });
  };
  const selectOwner = (id: string) => {
    if (
      id === selectedOwnerId() ||
      isSaving() ||
      !scopes().some((scope) => scope.id === id)
    )
      return;
    discardEditors();
    setSearch({ owner: id });
  };
  const create = (opener: HTMLElement) => {
    const current = owner();
    if (!current) return;
    if (search.tab === 'availability') current.createSchedule(opener);
    else {
      setSearch({ tab: 'links' });
      void current.action(() => current.createEvent(opener));
    }
  };
  return (
    <ViewShell.Root
      asidePreferenceKey="booking-links"
      resizable
      main={{ preferredWidth: 720 }}
    >
      <ViewShell.Aside>
        <ViewSidebar.Root aria-label="Scheduling navigation">
          <ViewSidebar.Header>
            <div class="flex min-w-0 items-center gap-1">
              <ViewSidebar.CloseButton />
              <ViewSidebar.Title>Scheduling</ViewSidebar.Title>
            </div>
          </ViewSidebar.Header>
          <ViewSidebar.Content>
            <ViewSidebar.Nav
              aria-label="Booking calendar owner"
              class="max-h-[calc(4*var(--sidebar-row-height)+3*var(--sidebar-row-gap))] overflow-y-auto overscroll-none touch:max-h-[calc(11rem+3*var(--sidebar-row-gap))]"
            >
              <For each={scopes()}>
                {(scope) => (
                  <ViewSidebar.Item
                    active={selectedOwnerId() === scope.id}
                    aria-current={
                      selectedOwnerId() === scope.id ? 'true' : undefined
                    }
                    title={scope.teamId ? scope.name : 'Personal'}
                    disabled={isSaving()}
                    {...pressHandlers(() => selectOwner(scope.id))}
                  >
                    <ViewSidebar.Icon>
                      <Show
                        when={selectedOwnerId() === scope.id}
                        fallback={
                          <Show
                            when={scope.teamId}
                            fallback={<UserIcon class="size-4" />}
                          >
                            <UsersIcon class="size-4" />
                          </Show>
                        }
                      >
                        <CheckIcon class="size-4 text-accent" />
                      </Show>
                    </ViewSidebar.Icon>
                    <span class="truncate">
                      {scope.teamId ? scope.name : 'Personal'}
                    </span>
                  </ViewSidebar.Item>
                )}
              </For>
            </ViewSidebar.Nav>
            <ViewSidebar.Nav aria-label="Booking tabs">
              <For each={TABS}>
                {(item) => (
                  <ViewSidebar.Item
                    active={search.tab === item.value}
                    disabled={isSaving()}
                    onClick={() => selectTab(item.value)}
                  >
                    <ViewSidebar.Icon>
                      <item.icon />
                    </ViewSidebar.Icon>
                    {item.label}
                  </ViewSidebar.Item>
                )}
              </For>
            </ViewSidebar.Nav>
          </ViewSidebar.Content>
        </ViewSidebar.Root>
      </ViewShell.Aside>
      <ViewShell.Main>
        <ViewShell.TopBar class="touch:flex touch:px-(--mobile-chrome-gutter)">
          <Show
            when={search.tab === 'availability'}
            fallback={
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <div class="flex min-w-0 items-center gap-1">
                  <h1 class="min-w-0 truncate pl-2 text-sm font-semibold">
                    {tab().label}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    label={`About ${tab().label.toLowerCase()}`}
                    tooltip={tab().description}
                  >
                    <InfoIcon class="size-4 text-ink-muted" />
                  </Button>
                </div>
                <Show when={owner()}>
                  {(current) => (
                    <div class="hidden min-w-0 sm:block">
                      <OwnerBadge scope={current().scope()} />
                    </div>
                  )}
                </Show>
              </div>
            }
          >
            <AvailabilityTopBar
              editing={editingSchedule()}
              creating={
                !owner()
                  ?.source.profile()
                  ?.schedules.some(
                    (schedule) => schedule.id === owner()?.schedule()?.id
                  )
              }
              disabled={isSaving() || !owner()?.source.profile()}
              canCreate={!!owner()?.scope().canEdit}
              onBack={() => owner()?.closeScheduleEditor()}
              onCreate={create}
            />
          </Show>
        </ViewShell.TopBar>
        <Show when={search.tab === 'links' || search.tab === 'bookings'}>
          <ViewShell.Header>
            <div
              class={cn('flex min-w-0 gap-3', {
                'items-center': search.tab === 'links',
                'flex-wrap items-end': search.tab === 'bookings',
              })}
            >
              <Show when={search.tab === 'links'}>
                <SearchBar
                  label="Search booking links"
                  placeholder="Search booking links…"
                  value={query()}
                  onValueChange={setQuery}
                  class="max-w-md flex-1"
                />
                <Show when={owner()?.scope().canEdit}>
                  <div class="ml-auto shrink-0">
                    <Button
                      label="New booking link"
                      tooltip="New booking link"
                      variant="strong"
                      size="md"
                      disabled={
                        !owner()?.source.profile() || owner()?.source.saving()
                      }
                      onClick={(event) => create(event.currentTarget)}
                    >
                      <PlusIcon class="size-4" />
                      <span>New</span>
                    </Button>
                  </div>
                </Show>
              </Show>
              <Show when={search.tab === 'bookings'}>
                <Field label="From">
                  <TextInput
                    type="date"
                    value={from()}
                    max={to()}
                    onChange={(event) =>
                      event.currentTarget.value &&
                      event.currentTarget.value <= to() &&
                      setFrom(event.currentTarget.value)
                    }
                  />
                </Field>
                <Field label="Through">
                  <TextInput
                    type="date"
                    value={to()}
                    min={from()}
                    onChange={(event) =>
                      event.currentTarget.value &&
                      event.currentTarget.value >= from() &&
                      setTo(event.currentTarget.value)
                    }
                  />
                </Field>
              </Show>
            </div>
          </ViewShell.Header>
        </Show>
        <ViewShell.Content
          class={cn('px-4', {
            'flex min-h-0 flex-col overflow-hidden':
              editingSchedule() || search.tab === 'page',
            'overflow-auto pb-8': !editingSchedule() && search.tab !== 'page',
            'pb-4': search.tab === 'page',
          })}
        >
          <For each={owners()}>
            {(current) => (
              <div
                class="min-w-0"
                classList={{
                  'max-w-5xl': search.tab === 'bookings',
                  'flex min-h-0 flex-1 flex-col':
                    editingSchedule() || search.tab === 'page',
                }}
                hidden={owner() !== current}
              >
                <Show when={current.source.loading()}>
                  <p role="status" class="py-8 text-sm text-ink-muted">
                    Loading booking links…
                  </p>
                </Show>
                <Show when={current.error() || current.source.error()}>
                  <div
                    role="alert"
                    class="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-failure-bg p-4 text-sm text-failure"
                  >
                    <p class="min-w-0 flex-1">
                      {current.error() || current.source.error()}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={current.source.reload}
                    >
                      Try again
                    </Button>
                  </div>
                </Show>
                <Show when={!current.scope().canEdit}>
                  <p class="mb-4 rounded-lg bg-surface-2 p-3 text-sm text-ink-muted">
                    Only team owners and admins can edit {current.scope().name}{' '}
                    scheduling.
                  </p>
                </Show>
                <Show when={search.tab === 'links' && owner() === current}>
                  <OwnerSettingsSection
                    kind="links"
                    owner={current}
                    search={query()}
                  />
                </Show>
                <Show when={search.tab === 'availability'}>
                  <OwnerSettingsSection
                    kind="availability"
                    owner={current}
                    scheduleTopBarOwned
                  />
                </Show>
                <Show when={search.tab === 'bookings'}>
                  <OwnerSettingsSection kind="bookings" owner={current} />
                </Show>
                <Show when={search.tab === 'insights' && owner() === current}>
                  <OwnerSettingsSection kind="insights" owner={current} />
                </Show>
                <Show when={search.tab === 'page' && owner() === current}>
                  <OwnerSettingsSection kind="page" owner={current} />
                </Show>
              </div>
            )}
          </For>
        </ViewShell.Content>
      </ViewShell.Main>
    </ViewShell.Root>
  );
}
