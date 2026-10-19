import { createAssertedContextProvider } from '@core/context/createContext';
import { createEffect, on, type ParentProps } from 'solid-js';
import { createCalendarEditor } from '../primitives/create-calendar-editor';
import type { CalendarViewTarget } from '../types';

export const [CalendarEditorProvider, useCalendarEditor] =
  createAssertedContextProvider(
    'CalendarEditor',
    (props: ParentProps<{ request?: CalendarViewTarget['editorRequest'] }>) => {
      const composer = createCalendarEditor();
      createEffect(
        on(
          () => props.request?.id,
          (id) => {
            const request = props.request;
            if (!id || !request || !request.consume()) return;
            if (
              !composer.open({
                event: request.event,
                initialValues: request.initialValues,
                onCalendarChange: request.onCalendarChange,
                onClose: request.onClose,
              })
            )
              composer.moveToSidebar();
          }
        )
      );
      return composer;
    }
  );
