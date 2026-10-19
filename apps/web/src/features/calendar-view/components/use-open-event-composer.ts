import type { EventEditorInitialValues } from '@app/features/calendar/components/composer/event-form-model';
import type { CalendarEvent } from '@app/features/calendar/types';
import { useSplitLayout } from '@components/app/split-layout/layout';
import { confirmDialog } from '@ui';
import { getOwner } from 'solid-js';
import { openCalendarView } from '../calendar-navigation';
import { createCalendarCreationRequest } from '../primitives/create-calendar-creation';

/** Values and lifecycle callbacks used to open an event composer. */
export interface OpenEventComposerOptions {
  event?: CalendarEvent;
  initialValues?: EventEditorInitialValues;
  onCalendarChange?: (calendarId: string, color: string) => void;
  onClose?: () => void;
}

/** Creation belongs to Calendar; existing-event editing retains its split host. */
export function useOpenEventComposer() {
  const { popoverSplit } = useSplitLayout();
  const owner = getOwner();

  return (options: OpenEventComposerOptions = {}) => {
    if (!options.event) {
      openCalendarView({
        creationRequest: createCalendarCreationRequest(options.initialValues),
      });
      return;
    }
    let eventSaved = false;
    let formDirty = false;
    let closeConfirmationPending = false;

    return popoverSplit(
      {
        type: 'component',
        id: 'calendar-event-compose',
        params: {
          event: options.event,
          initialValues: options.initialValues,
          onCalendarChange: options.onCalendarChange,
          onDirtyChange: (dirty: boolean) => {
            formDirty = dirty;
          },
          onSaveSuccess: () => {
            eventSaved = true;
          },
        },
      },
      {
        onClose: async (close) => {
          if (closeConfirmationPending) return;

          if (!eventSaved && formDirty) {
            closeConfirmationPending = true;
            try {
              const confirmed = await confirmDialog(
                {
                  title: 'You still have remaining changes',
                  body: 'Closing this event will discard your changes.',
                  confirmLabel: 'Discard',
                  cancelLabel: 'Keep editing',
                  tone: 'danger',
                },
                { owner }
              );
              if (!confirmed) return;
            } finally {
              closeConfirmationPending = false;
            }
          }

          options.onClose?.();
          close();
        },
      }
    );
  };
}
