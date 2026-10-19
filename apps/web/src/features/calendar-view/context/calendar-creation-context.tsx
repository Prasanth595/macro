import { createAssertedContextProvider } from '@core/context/createContext';
import { createEffect, on, type ParentProps } from 'solid-js';
import { createCalendarCreation } from '../primitives/create-calendar-creation';
import type { CalendarViewTarget } from '../types';

export const [CalendarCreationProvider, useCalendarCreation] =
  createAssertedContextProvider(
    'CalendarCreation',
    (
      props: ParentProps<{ request?: CalendarViewTarget['creationRequest'] }>
    ) => {
      const creation = createCalendarCreation();
      createEffect(
        on(
          () => props.request?.id,
          (id) => {
            if (!id) return;
            if (!creation.open({ initialValues: props.request?.initialValues }))
              creation.moveToSidebar();
          }
        )
      );
      return creation;
    }
  );
