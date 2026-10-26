import { openCalendarEventSplit } from '@app/features/calendar-view/open-calendar-event';
import {
  CalendarEventPreviewDetails,
  calendarPreviewSchedule,
} from '@core/component/DocumentPreview';
import { fireAndForget } from '@core/util/fireAndForget';
import { Telemetry } from '@macro-inc/observability';
import CalendarIcon from '@phosphor/calendar-blank.svg';
import { Button, Dialog } from '@ui';
import { createSignal, onCleanup, Show } from 'solid-js';
import type { DocumentReference } from './queries/notes-source';
import { resolveReferencePreview } from './queries/reference-preview';

/** A linked occurrence, resolved through the document-link access checks. */
export function MeetingReference(props: {
  link: DocumentReference;
  documentId: string;
  onOpenCalendar?: () => void;
}) {
  const occurrenceKey = () =>
    props.link.occurrenceKey === 'single'
      ? undefined
      : props.link.occurrenceKey;
  const resolved = () => resolveReferencePreview(props.link);
  const event = () => resolved()?.event;
  const [detailsOpen, setDetailsOpen] = createSignal(false);
  const title = () => event()?.title || props.link.eventTitle;
  const schedule = () => {
    const current = event();
    return current ? calendarPreviewSchedule(current) : undefined;
  };
  let active = true;
  onCleanup(() => {
    active = false;
  });
  function open() {
    fireAndForget(
      Telemetry.span('calendar.notes.reference.open', async (span) => {
        span.setAttr('event.id', props.link.eventId);
        span.setAttr('document.id', props.documentId);
        const current = event();
        if (!current?.viewerEventId) {
          span.setAttr(
            'calendar.notes.reference.outcome',
            current ? 'shared_preview' : 'unavailable'
          );
          setDetailsOpen(true);
          return;
        }
        setDetailsOpen(false);
        const opened = await openCalendarEventSplit({
          eventId: current.viewerEventId,
          occurrenceKey: current.occurrenceKey ?? occurrenceKey(),
          time: current.time,
          openInNewSplit: true,
        });
        span.setAttr(
          'calendar.notes.reference.outcome',
          opened ? 'calendar' : 'preview'
        );
        if (!active) return;
        if (opened) props.onOpenCalendar?.();
        else setDetailsOpen(true);
      }),
      'calendar.notes.reference'
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="md"
        fullWidth
        class="justify-start rounded-lg px-0 text-left"
        onClick={open}
        aria-label={`Open meeting ${title()}`}
      >
        <CalendarIcon class="size-4 shrink-0 text-ink-muted" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-xs text-ink">{title()}</span>
          <span class="mt-0.5 block text-xs font-normal text-ink-muted">
            {schedule() ?? 'Linked meeting'}
          </span>
        </span>
      </Button>
      <Show when={detailsOpen()}>
        <Dialog
          open
          onOpenChange={setDetailsOpen}
          position="center"
          class="w-[400px]"
        >
          <Dialog.Title class="px-4 pt-4 text-sm font-medium">
            {title()}
          </Dialog.Title>
          <Dialog.Description class="sr-only">
            Details of the meeting linked to this note.
          </Dialog.Description>
          <Show
            when={event()}
            fallback={
              <p class="p-4 text-sm text-ink-muted">
                This meeting is no longer available to you.
              </p>
            }
          >
            {(current) => (
              <CalendarEventPreviewDetails
                event={current()}
                mentionedEventId={props.link.eventId}
                sharedActions={resolved()?.sharedActions}
              />
            )}
          </Show>
          <div class="flex justify-end p-3">
            <Button variant="ghost" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </div>
        </Dialog>
      </Show>
    </>
  );
}
