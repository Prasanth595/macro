import {
  ContextMenuContent,
  ContextMenuTrigger,
  MENU_ITEM_CLASS,
  MenuGroup,
} from '@core/component/ContextMenu';
import { ContextMenu } from '@kobalte/core/context-menu';
import External from '@phosphor/arrow-square-out.svg';
import Calendar from '@phosphor/calendar-blank.svg';
import Check from '@phosphor/check.svg';
import Clock from '@phosphor/clock.svg';
import Dots from '@phosphor/dots-three.svg';
import Info from '@phosphor/info.svg';
import MapPin from '@phosphor/map-pin.svg';
import Timer from '@phosphor/timer.svg';
import Users from '@phosphor/users.svg';
import X from '@phosphor/x.svg';
import { propertyPillClasses } from '@property/extractors/property-pill-classes';
import { Badge, Button, cn, Dropdown } from '@ui';
import { buttonClasses } from '@ui/components/Button';
import { onCleanup, Show } from 'solid-js';
import {
  bookingIsPast,
  bookingMeetingUrl,
  bookingTimeRange,
  canManageBooking,
} from '../core/booking-list';
import type { Booking } from '../core/types';
import { BookingStatus } from './booking-status';

export function BookingCard(props: {
  booking: Booking;
  timeZone: string;
  canEdit: boolean;
  busyId: string;
  hostNames: string;
  onView: (
    booking: Booking,
    opener?: HTMLElement,
    confirmCancel?: boolean
  ) => void;
  onApprove: (id: string) => void;
  onManage: (id: string) => void;
}) {
  let opener: HTMLButtonElement | undefined;
  let pendingDetails: boolean | undefined;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const finishMenuClose = (event: Event) => {
    if (pendingDetails === undefined) return;
    event.preventDefault();
    const confirmCancel = pendingDetails;
    pendingDetails = undefined;
    // Release the menu's modal lock before opening a dialog or touch drawer.
    queueMicrotask(() => {
      if (!disposed) props.onView(props.booking, opener, confirmCancel);
    });
  };
  const past = () => bookingIsPast(props.booking, Date.now());
  const manageable = () =>
    canManageBooking(props.booking, props.canEdit, Date.now());
  const join = () =>
    props.booking.status === 'confirmed' && !past()
      ? bookingMeetingUrl(props.booking.location)
      : undefined;
  const duration = () =>
    Math.round(
      (Date.parse(props.booking.endsAt) - Date.parse(props.booking.startsAt)) /
        60000
    );
  const date = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: props.timeZone,
      ...options,
    }).format(new Date(props.booking.startsAt));
  function MenuItems(menu: { context?: boolean }) {
    const Item = menu.context ? ContextMenu.Item : Dropdown.Item;
    const Group = menu.context ? MenuGroup : Dropdown.Group;
    return (
      <>
        <Group>
          <Item
            class={menu.context ? MENU_ITEM_CLASS : undefined}
            onSelect={() => {
              pendingDetails = false;
            }}
          >
            <Info class="size-4" /> Details
          </Item>
          <Show when={join()}>
            {(url) => (
              <Item
                class={menu.context ? MENU_ITEM_CLASS : undefined}
                onSelect={() => {
                  window.open(url(), '_blank', 'noopener,noreferrer');
                }}
              >
                <External class="size-4" /> Join meeting
              </Item>
            )}
          </Show>
        </Group>
        <Show when={manageable()}>
          <Group>
            <Show when={!past()}>
              <Show when={props.booking.status === 'pending'}>
                <Item
                  class={menu.context ? MENU_ITEM_CLASS : undefined}
                  disabled={!!props.busyId}
                  onSelect={() => props.onApprove(props.booking.id)}
                >
                  <Check class="size-4" /> Confirm
                </Item>
              </Show>
              <Item
                class={menu.context ? MENU_ITEM_CLASS : undefined}
                disabled={!!props.busyId}
                onSelect={() => props.onManage(props.booking.id)}
              >
                <Calendar class="size-4" /> Reschedule
              </Item>
            </Show>
            <Item
              class={cn(menu.context && MENU_ITEM_CLASS, 'text-failure')}
              disabled={!!props.busyId}
              onSelect={() => {
                pendingDetails = true;
              }}
            >
              <X class="size-4" />{' '}
              {props.booking.status === 'pending' ? 'Decline' : 'Cancel'}
            </Item>
          </Group>
        </Show>
      </>
    );
  }
  const location = () => {
    const url = bookingMeetingUrl(props.booking.location);
    return url ? new URL(url).hostname : props.booking.location;
  };
  return (
    <ContextMenu>
      <ContextMenuTrigger
        as="article"
        class="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_auto] gap-x-3 gap-y-4 rounded-xl border border-edge-frame bg-panel p-4 transition-colors hover:bg-list-hover focus-within:border-edge-focus @min-[36rem]/bookings:grid-cols-[128px_minmax(0,1fr)_auto] @min-[36rem]/bookings:gap-x-4"
        classList={{ 'opacity-50': props.booking.status === 'cancelled' }}
      >
        <div class="col-span-3 grid min-w-0 grid-cols-subgrid items-start">
          <button
            ref={opener}
            type="button"
            data-booking-opener={props.booking.id}
            aria-label={`${props.booking.title} with ${props.booking.name}, ${date({ dateStyle: 'full' })}`}
            onClick={(event) =>
              props.onView(props.booking, event.currentTarget)
            }
            class="col-span-2 grid min-w-0 grid-cols-subgrid items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div class="pt-0.5">
              <p class="text-xs font-medium text-ink-muted">
                {date({ weekday: 'long' })}
              </p>
              <p class="mt-1 text-lg font-semibold tabular-nums">
                {date({ month: 'short', day: 'numeric' })}
              </p>
              <p class="mt-1 text-xs text-ink-muted">
                {date({ year: 'numeric' })}
              </p>
              <div class="mt-3 flex min-w-0 flex-col items-start gap-2">
                <span class="flex min-w-0 items-start gap-1 text-xs text-ink-muted">
                  <Clock aria-hidden="true" class="mt-0.5 size-3 shrink-0" />
                  <span class="min-w-0 break-words">
                    {bookingTimeRange(props.booking, props.timeZone)}
                  </span>
                </span>
                <Badge
                  variant="outline"
                  size="md"
                  class={propertyPillClasses({
                    variant: 'outline',
                    size: 'md',
                    readOnly: true,
                  })}
                >
                  <Timer aria-hidden="true" class="size-3" />
                  {duration()}m
                </Badge>
              </div>
            </div>
            <div class="flex min-w-0 flex-col gap-3">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <h3 class="min-w-0 break-words text-base font-medium">
                  {props.booking.title}
                </h3>
                <BookingStatus booking={props.booking} />
                <Show when={(props.booking.rescheduleCount ?? 0) > 0}>
                  <span class="text-xs text-ink-muted">Rescheduled</span>
                </Show>
              </div>
              <div class="min-w-0 text-sm">
                <p class="font-medium">{props.booking.name}</p>
                <p class="mt-0.5 break-all text-ink-muted">
                  {props.booking.email}
                </p>
              </div>
            </div>
          </button>
          <Dropdown>
            <Dropdown.Trigger
              variant="ghost"
              size="icon-sm"
              label={`Options for ${props.booking.name}`}
              tooltipDisabled
            >
              <Dots class="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Content
              class="min-w-40"
              onCloseAutoFocus={finishMenuClose}
            >
              <MenuItems />
            </Dropdown.Content>
          </Dropdown>
        </div>
        <div class="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted @min-[36rem]/bookings:basis-0">
            <Show when={props.hostNames}>
              <span class="flex min-w-0 items-center gap-1.5">
                <Users aria-hidden="true" class="size-3.5 shrink-0" />
                <span class="min-w-0 break-words">{props.hostNames}</span>
              </span>
            </Show>
            <Show when={location()}>
              <span class="flex min-w-0 items-center gap-1.5">
                <MapPin aria-hidden="true" class="size-3.5 shrink-0" />
                <span class="min-w-0 break-words">{location()}</span>
              </span>
            </Show>
          </div>
          <Show when={join()}>
            {(url) => (
              <a
                href={url()}
                target="_blank"
                rel="noopener noreferrer"
                class={buttonClasses({
                  variant: 'outline',
                  size: 'md',
                  class: 'ml-auto',
                })}
              >
                <External aria-hidden="true" class="size-3.5" />
                Join meeting
              </a>
            )}
          </Show>
          <Show
            when={manageable() && !past() && props.booking.status === 'pending'}
          >
            <Button
              variant="strong"
              size="sm"
              class="ml-auto"
              disabled={!!props.busyId}
              onClick={() => props.onApprove(props.booking.id)}
            >
              Confirm
            </Button>
          </Show>
        </div>
        <Show when={props.busyId === props.booking.id}>
          <span role="status" class="col-span-3 text-xs text-ink-muted">
            Updating booking…
          </span>
        </Show>
      </ContextMenuTrigger>
      <ContextMenu.Portal>
        <ContextMenuContent class="min-w-40" onCloseAutoFocus={finishMenuClose}>
          <MenuItems context />
        </ContextMenuContent>
      </ContextMenu.Portal>
    </ContextMenu>
  );
}
