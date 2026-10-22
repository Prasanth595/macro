import { onCleanup } from 'solid-js';
import type { EmailComposeFeedback } from '../context/compose-capabilities';

/**
 * One warning per local-save failure episode, shared by both composers.
 * Closing the composer dismisses it; if the edit it writes once more on close
 * also fails, that failure shows a new warning after the composer is gone.
 */
export function createDraftSaveNotice(
  feedback: EmailComposeFeedback['feedback']
) {
  let failed = false;
  let notice: number | undefined;
  const clear = () => {
    if (notice !== undefined) feedback.dismiss(notice);
    notice = undefined;
    failed = false;
  };
  onCleanup(clear);
  return {
    onLocalError(error: unknown) {
      if (failed) return;
      failed = true;
      notice = feedback.failure('Draft could not be saved on this device', {
        subtext: String(error),
        persistent: true,
      });
    },
    onLocalSaved: clear,
  };
}
