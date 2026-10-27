export type CalendarSyncIssue = {
  kind: 'invalid-event' | 'unconfirmed-reply' | 'unavailable';
  title: string;
  description: string;
};

/** Keep persisted provider diagnostics out of user-facing calendar messages. */
export function calendarSyncIssue(error: string): CalendarSyncIssue {
  if (
    error.startsWith('An automatic invitation reply could not be confirmed.')
  ) {
    return {
      kind: 'unconfirmed-reply',
      title: 'Check invitation reply',
      description:
        'An automatic reply could not be confirmed. Check the invitation in Outlook before replying again.',
    };
  }

  if (
    error.includes('snapshot could not be fully normalized') ||
    error.includes('returned an invalid normalized event')
  ) {
    return {
      kind: 'invalid-event',
      title: 'Check event details',
      description:
        'An event has dates or details Macro cannot read. Review it in your calendar app.',
    };
  }

  return {
    kind: 'unavailable',
    title: 'Calendar sync paused',
    description:
      'Some events may be missing or out of date. Macro will keep trying to sync this calendar.',
  };
}
