import { Popover } from '@kobalte/core/popover';
import Clock from '@phosphor/clock.svg';
import Copy from '@phosphor/copy.svg';
import Globe from '@phosphor/globe.svg';
import Info from '@phosphor/info.svg';
import { Button } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { unwrap } from 'solid-js/store';
import type {
  AvailabilitySchedule,
  SchedulingProfile,
  SchedulingScope,
} from '../core/types';
import { WEEKDAYS } from '../core/types';
import { OwnerBadge } from './owner-badge';

export function AvailabilityPanel(props: {
  profile: SchedulingProfile;
  owner?: SchedulingScope;
  canEdit: boolean;
  saving: boolean;
  onEdit: (schedule: AvailabilitySchedule) => void;
  onDefault: (schedule: AvailabilitySchedule) => void;
  onDelete: (schedule: AvailabilitySchedule) => void;
}) {
  const [remove, setRemove] = createSignal<string>();
  const defaultId = () =>
    props.profile.defaultScheduleId ?? props.profile.schedules[0]?.id;
  const usedBy = (id: string) =>
    props.profile.eventTypes.filter((e) => e.scheduleId === id);
  return (
    <div class="grid min-w-0 gap-4 sm:grid-cols-2">
      <For
        each={props.profile.schedules}
        fallback={
          <div class="col-span-full flex flex-col items-center gap-3 rounded-xl border border-dashed border-edge px-6 py-12 text-center">
            <Clock class="size-7 text-ink-muted" />
            <Show when={props.owner}>
              {(owner) => <OwnerBadge scope={owner()} />}
            </Show>
            <h2 class="font-semibold">Set your working hours</h2>
            <p class="text-sm text-ink-muted">
              Create a schedule to start accepting bookings.
            </p>
          </div>
        }
      >
        {(schedule) => (
          <article class="min-w-0 rounded-xl border border-edge-muted bg-surface-1 p-5">
            <div class="flex min-w-0 flex-col gap-4">
              <button
                type="button"
                class="min-w-0 text-left"
                disabled={!props.canEdit || props.saving}
                onClick={() => props.onEdit(schedule)}
              >
                <div class="flex flex-wrap items-center gap-3">
                  <h2 class="font-semibold">{schedule.name}</h2>
                  <Show when={props.owner}>
                    {(owner) => <OwnerBadge scope={owner()} />}
                  </Show>
                  <Show when={defaultId() === schedule.id}>
                    <span class="rounded-md bg-active px-2 py-0.5 text-xs text-ink-muted">
                      Default
                    </span>
                  </Show>
                </div>
                <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
                  <span class="inline-flex items-center gap-1.5">
                    <Clock class="size-4" />
                    {schedule.weekly
                      .filter((day) => day.windows.length)
                      .map((day) => WEEKDAYS[day.day].slice(0, 3))
                      .join(', ') || 'No available days'}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <Globe class="size-4" />
                    {schedule.timeZone.replaceAll('_', ' ')}
                  </span>
                </div>
                <p class="mt-2 text-xs text-ink-muted">
                  {usedBy(schedule.id).length} booking links ·{' '}
                  {schedule.overrides.length} date overrides
                </p>
              </button>
              <div class="flex flex-wrap items-center gap-1 border-t border-edge-muted pt-3">
                <ScheduleDetails
                  schedule={schedule}
                  canEdit={props.canEdit}
                  saving={props.saving}
                  onCopy={props.onEdit}
                />
                <Show when={props.canEdit}>
                  <Button
                    variant="outline"
                    onClick={() => props.onEdit(schedule)}
                    size="sm"
                    disabled={props.saving}
                  >
                    Edit
                  </Button>
                  <Show when={defaultId() !== schedule.id}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={props.saving}
                      onClick={() => props.onDefault(schedule)}
                    >
                      Set as default
                    </Button>
                  </Show>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={props.saving}
                    onClick={() => setRemove(schedule.id)}
                  >
                    Delete
                  </Button>
                </Show>
              </div>
            </div>
            <Show when={props.canEdit && remove() === schedule.id}>
              <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-edge-muted pt-4">
                <p class="flex-1 text-sm">
                  {usedBy(schedule.id).length
                    ? `Move ${usedBy(schedule.id)
                        .map((e) => e.title)
                        .join(
                          ', '
                        )} to another schedule before deleting this one.`
                    : `Delete “${schedule.name}”?`}
                </p>
                <Button variant="ghost" onClick={() => setRemove(undefined)}>
                  Keep schedule
                </Button>
                <Show when={!usedBy(schedule.id).length}>
                  <Button
                    variant="outline"
                    disabled={props.saving}
                    onClick={() => props.onDelete(schedule)}
                  >
                    Delete schedule
                  </Button>
                </Show>
              </div>
            </Show>
          </article>
        )}
      </For>
    </div>
  );
}

function ScheduleDetails(props: {
  schedule: AvailabilitySchedule;
  canEdit: boolean;
  saving: boolean;
  onCopy: (schedule: AvailabilitySchedule) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [trigger, setTrigger] = createSignal<HTMLButtonElement>();
  return (
    <Popover
      open={open()}
      onOpenChange={setOpen}
      placement="bottom-start"
      gutter={8}
      modal={false}
    >
      <Popover.Trigger
        as={Button}
        ref={setTrigger}
        variant="ghost"
        size="sm"
        label={`Details for ${props.schedule.name}`}
      >
        <Info class="size-3.5" />
        Details
      </Popover.Trigger>
      <Popover.Portal
        mount={trigger()?.closest<HTMLElement>('.portal-scope') ?? undefined}
      >
        <Popover.Content class="menu-surface z-action-menu w-80 max-w-[min(20rem,var(--kb-popper-content-available-width),calc(100vw-2rem))] p-4 text-xs outline-none">
          <Popover.Title class="text-sm font-semibold">
            {props.schedule.name}
          </Popover.Title>
          <Popover.Description class="mt-1 text-ink-muted">
            {props.schedule.timeZone.replaceAll('_', ' ')}
          </Popover.Description>
          <dl class="mt-4 flex flex-col gap-2">
            <For
              each={[...props.schedule.weekly].sort(
                (a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)
              )}
            >
              {(day) => (
                <div class="flex justify-between gap-4">
                  <dt>{WEEKDAYS[day.day]}</dt>
                  <dd class="text-right">
                    {day.windows
                      .map((window) => `${window.start}–${window.end}`)
                      .join(', ') || 'Unavailable'}
                  </dd>
                </div>
              )}
            </For>
          </dl>
          <Show when={props.schedule.overrides.length}>
            <div class="mt-3 max-h-40 overflow-y-auto border-t border-edge-muted pt-3">
              <p class="mb-2 font-medium">Date overrides</p>
              <For
                each={[...props.schedule.overrides].sort((a, b) =>
                  a.date.localeCompare(b.date)
                )}
              >
                {(override) => (
                  <p class="mb-1 flex justify-between gap-3">
                    <span>{override.date}</span>
                    <span class="text-right text-ink-muted">
                      {override.windows
                        .map((window) => `${window.start}–${window.end}`)
                        .join(', ') || 'Unavailable all day'}
                    </span>
                  </p>
                )}
              </For>
            </div>
          </Show>
          <Show when={props.canEdit}>
            <Button
              class="mt-4 w-full"
              variant="outline"
              size="sm"
              disabled={props.saving}
              onClick={() => {
                setOpen(false);
                props.onCopy({
                  ...structuredClone(unwrap(props.schedule)),
                  id: crypto.randomUUID(),
                  name: `${props.schedule.name.slice(0, 93)} (copy)`,
                });
              }}
            >
              <Copy class="size-3.5" />
              Copy schedule
            </Button>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
