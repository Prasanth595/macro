import { type Accessor, batch, createSignal } from 'solid-js';
import type {
  EventEditorInitialValues,
  EventEditorSubmitValues,
} from '../../calendar/components/composer/event-form-model';
import type { CalendarEvent } from '../../calendar/types';
import type { CalendarEditorRequest } from '../types';
import type { CalendarEditorAnchor } from './calendar-editor-anchor';

export type CalendarEditorPresentation = 'popover' | 'sidebar';
export interface CalendarEditorPreview {
  title: string;
  color?: string;
  time: EventEditorSubmitValues['time'];
}
export interface CalendarEditorDraft {
  /** Event or selected-slot anchor with a snapshot for recycled grid pages. */
  anchor?: CalendarEditorAnchor;
  event?: CalendarEvent;
  initialValues?: EventEditorInitialValues;
  onCalendarChange?: (calendarId: string, color: string) => void;
  onClose?: () => void;
}

/** Runtime command state stays with the request, not a disposable workspace. */
export function createCalendarEditorRequest(
  options: Pick<
    CalendarEditorDraft,
    'event' | 'initialValues' | 'onCalendarChange' | 'onClose'
  > = {}
): CalendarEditorRequest {
  let consumed = false;
  return {
    id: crypto.randomUUID(),
    event: options.event,
    initialValues: options.initialValues,
    onCalendarChange: options.onCalendarChange,
    onClose: options.onClose,
    consume: () => {
      if (consumed) return false;
      consumed = true;
      return true;
    },
  };
}

export function createCalendarEditor() {
  const [draft, setDraft] = createSignal<CalendarEditorDraft>();
  const [previewAnchor, setPreviewAnchor] = createSignal<HTMLElement>();
  const [previewSource, setPreviewSource] =
    createSignal<Accessor<CalendarEditorPreview | undefined>>();
  const [surface, setSurface] =
    createSignal<CalendarEditorPresentation>('popover');
  let beforeReplace: (() => Promise<boolean>) | undefined;

  const open = (
    next: CalendarEditorDraft = {},
    presentation: CalendarEditorPresentation = 'popover'
  ) => {
    if (draft()) return false;
    batch(() => {
      setSurface(presentation);
      setDraft(next);
    });
    return true;
  };
  const close = () => {
    const current = draft();
    if (!current) return;
    setDraft(undefined);
    current.onClose?.();
  };

  const registerPreview = (
    source: Accessor<CalendarEditorPreview | undefined>
  ) => {
    setPreviewSource(() => source);
    return () => {
      if (previewSource() === source) setPreviewSource(undefined);
    };
  };
  const registerBeforeReplace = (guard: () => Promise<boolean>) => {
    beforeReplace = guard;
    return () => {
      if (beforeReplace === guard) beforeReplace = undefined;
    };
  };
  const replace = async (next: CalendarEditorDraft) => {
    const current = draft();
    if (current && beforeReplace && !(await beforeReplace())) return false;
    if (draft() !== current) return false;
    return batch(() => {
      close();
      return open(next);
    });
  };

  return {
    preview: () => (draft() ? previewSource()?.() : undefined),
    registerPreview,
    previewAnchor,
    setPreviewAnchor,
    draft,
    surface,
    moveToSidebar: () => {
      if (draft()) setSurface('sidebar');
    },
    moveToPopover: () => {
      if (draft()) setSurface('popover');
    },
    open,
    close,
    replace,
    registerBeforeReplace,
  };
}
