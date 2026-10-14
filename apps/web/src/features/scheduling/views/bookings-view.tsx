import { SearchBar } from '@app/components/view-shell';
import { Show } from 'solid-js';
import { BookingDetailsDialog } from '../components/booking-details-dialog';
import { BookingsPanel } from '../components/bookings-panel';
import type { Booking, EventType, SchedulingMember } from '../core/types';
import { createBookingsView } from '../primitives/create-bookings-view';

export function BookingsView(props: {
  bookings: Booking[];
  events: EventType[];
  members: SchedulingMember[];
  canManageBookings: boolean;
  busyId: string;
  currentUserId: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  loading?: boolean;
  error?: string;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
  onManage: (id: string) => void;
  onAttendance: (id: string, attendance: Booking['attendance']) => void;
}) {
  const state = createBookingsView({
    bookings: () => props.bookings,
    events: () => props.events,
    search: () => props.search,
    onSearchChange: (value) => props.onSearchChange?.(value),
  });
  let panel: HTMLDivElement | undefined;
  return (
    <div
      ref={panel}
      tabindex="-1"
      class="min-w-0 outline-none"
      aria-label="Bookings list"
    >
      <Show when={props.search === undefined}>
        <SearchBar
          label="Search bookings"
          placeholder="Search bookings…"
          value={state.search()}
          onValueChange={state.setSearch}
          class="mb-5 max-w-md"
        />
      </Show>
      <BookingsPanel
        members={props.members}
        groups={state.groups()}
        tabs={state.tabs()}
        tab={state.tab()}
        search={state.search()}
        eventId={state.eventId()}
        eventOptions={state.eventOptions()}
        timeZone={state.timeZone()}
        count={state.visible().length}
        loading={props.loading}
        error={props.error}
        canManageBookings={props.canManageBookings}
        currentUserId={props.currentUserId}
        busyId={props.busyId}
        onTab={state.setTab}
        onEvent={state.setEventId}
        onTimeZone={state.setTimeZone}
        onClear={state.clearFilters}
        onView={state.openDetails}
        onApprove={props.onApprove}
        onManage={props.onManage}
      />
      <Show when={state.selection()} keyed>
        {(selection) => (
          <Show when={state.selected()}>
            {(booking) => (
              <BookingDetailsDialog
                booking={booking()}
                event={props.events.find(
                  (event) => event.id === booking().eventTypeId
                )}
                members={props.members}
                timeZone={state.timeZone()}
                currentUserId={props.currentUserId}
                canManageBookings={props.canManageBookings}
                busyId={props.busyId}
                error={props.error}
                confirmCancel={selection.confirmCancel}
                onClose={state.closeDetails}
                onRestoreFocus={() => {
                  if (!panel?.isConnected) return;
                  const row = panel?.querySelector<HTMLButtonElement>(
                    `[data-booking-opener="${CSS.escape(selection.id)}"]`
                  );
                  const target =
                    row ??
                    (selection.opener?.isConnected ? selection.opener : panel);
                  if (target?.isConnected)
                    target.focus({ preventScroll: true });
                }}
                onApprove={props.onApprove}
                onCancel={props.onCancel}
                onManage={props.onManage}
                onAttendance={props.onAttendance}
              />
            )}
          </Show>
        )}
      </Show>
    </div>
  );
}
