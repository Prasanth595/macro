import type { Accessor } from 'solid-js';

/** One discard decision at a time; an in-flight save cannot be dismissed. */
export function createCalendarDraftDismissal(options: {
  dirty: Accessor<boolean>;
  pending: Accessor<boolean>;
  confirmDiscard: () => Promise<boolean>;
}) {
  let confirming = false;
  return async () => {
    if (options.pending() || confirming) return false;
    if (!options.dirty()) return true;
    confirming = true;
    try {
      const confirmed = await options.confirmDiscard();
      return confirmed && !options.pending();
    } finally {
      confirming = false;
    }
  };
}
