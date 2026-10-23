import { MarkdownTextarea } from '@core/component/LexicalMarkdown/component/core/MarkdownTextarea';
import { createMemo, createUniqueId, onCleanup, Show } from 'solid-js';
import { EventDateTimeRangeFields } from '../../calendar/components/composer/EventDateTimeRangeFields';
import {
  EventComposerCalendarPill,
  EventComposerGuestsPill,
  EventComposerLocationPill,
} from '../../calendar/components/composer/EventPropertyPills';
import { EventTitleInput } from '../../calendar/components/composer/EventTitleInput';
import { guestEmail } from '../../calendar/components/composer/event-form-model';
import type { InputDisplay } from '../context/capabilities';
import { calendarTimeAssumption } from '../core/calendar-time-assumption';
import type { UniversalInputController } from '../primitives/universal-input';
import {
  composerRecipientOptions,
  composerRecipients,
} from '../queries/composer-recipients';

/** Reuse the calendar composer's date/time menus and editable property pills. */
export function CalendarDraft(props: {
  state: UniversalInputController;
  actions: InputDisplay;
}) {
  const s = props.state;
  const a = props.actions;
  const hintId = createUniqueId();
  onCleanup(() => a.captureCalendarEditor?.(undefined));
  const calendars = createMemo(() =>
    a.calendars().map((calendar) => ({
      id: calendar.id,
      label: `${calendar.name} · ${calendar.emailAddress}`,
      color: 'var(--color-accent)',
    }))
  );
  const guests = createMemo(() =>
    composerRecipients(s.fields().guests, a.people())
  );
  const options = createMemo(() =>
    composerRecipientOptions(a.people()).filter(
      (person) => person.kind !== 'custom'
    )
  );
  const assumption = () =>
    s.draft().edited.calendar.includes('start')
      ? undefined
      : calendarTimeAssumption(s.draft().text, s.fields().start);
  const changeStart = (start: string) => {
    const duration =
      new Date(s.fields().end).getTime() - new Date(s.fields().start).getTime();
    s.edit('start', start);
    if (duration > 0 && Number.isFinite(new Date(start).getTime())) {
      const end = new Date(new Date(start).getTime() + duration);
      const local = new Date(end.getTime() - end.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      s.edit('end', local);
    }
  };
  return (
    <div class="space-y-4">
      <EventDateTimeRangeFields
        start={s.fields().start}
        end={s.fields().end}
        allDay={false}
        onStartChange={changeStart}
        onEndChange={(end) => s.edit('end', end)}
        startDisabled={s.sending()}
        endDisabled={s.sending()}
        describedBy={assumption() ? hintId : undefined}
      />
      <Show when={assumption()}>
        {(hint) => (
          <p
            id={hintId}
            role="note"
            class="rounded-md bg-accent/8 px-2.5 py-2 text-xs text-ink"
          >
            {hint()}
          </p>
        )}
      </Show>
      <p class="text-xs text-ink-muted" aria-label="Time zone">
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
      <EventTitleInput
        value={s.fields().title}
        onChange={(title) => s.edit('title', title)}
        disabled={s.sending()}
      />
      <MarkdownTextarea
        type="calendar"
        value={s.fields().body}
        editable={() => !s.sending()}
        onChange={(value) => {
          if (value !== s.fields().body) s.edit('body', value);
        }}
        captureEditor={(editor) => a.captureCalendarEditor?.(editor)}
        resolveAppLink={a.resolveAppLink}
        placeholder="Add description..."
        portalScope="local"
        floatingFormatMenu
        domRef={(element) => element.setAttribute('aria-label', 'Description')}
        class="h-auto min-h-12 [&>[contenteditable]]:min-h-12"
      />
      <div class="flex flex-wrap items-center gap-2">
        <EventComposerCalendarPill
          options={calendars()}
          value={calendars().find(
            (calendar) => calendar.id === a.selectedCalendar(s.fields())?.id
          )}
          onChange={(id) => s.edit('calendarId', id)}
          disabled={s.sending()}
        />
        <EventComposerGuestsPill
          options={options}
          selected={guests()}
          onChange={(selected) =>
            s.edit('guests', selected.map(guestEmail).join(', '))
          }
          disabled={s.sending()}
        />
        <EventComposerLocationPill
          value={s.fields().location}
          onChange={(value) => s.edit('location', value)}
          disabled={s.sending()}
        />
      </div>
    </div>
  );
}
