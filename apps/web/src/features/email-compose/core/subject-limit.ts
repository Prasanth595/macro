import { subjectLimitChars } from './constants';

/** Why the sending provider can't keep this subject as typed, if it can't. */
export function subjectLimitHint(
  subject: string,
  provider?: 'GMAIL' | 'OUTLOOK'
): string | undefined {
  const limit = subjectLimitChars(provider);
  if (limit === undefined || subject.length <= limit) return undefined;
  return `Subject is ${subject.length} characters. Outlook allows ${limit}.`;
}
