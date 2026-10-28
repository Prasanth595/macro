/**
 * Line-level review notes: what the reviewer wants the agent to change, tied
 * to a line of the current changeset, queued until sent as one prompt.
 *
 * Notes never go to GitHub. They are the reviewer's words for the agent, so
 * `formatNotesForAgent` turns them into the markdown the session composer
 * posts.
 */

import { describeLineRange } from '@app/components/diff-view/model/lines';

/** Which side of the diff a line belongs to, in Pierre's vocabulary. */
export type DiffSide = 'additions' | 'deletions';

/**
 * Where a note goes: the lines the reviewer picked. It ends on `side`; a
 * unified range dragged from deleted lines into added ones starts on the
 * other side, in `startSide`'s numbering.
 */
export type NoteAnchor = {
  /** The file the note is on, by its current path. */
  path: string;
  side: DiffSide;
  startSide?: DiffSide;
  /** First line of the range. */
  lineNumber: number;
  /** Last line, equal to `lineNumber` for a single line. */
  endLineNumber: number;
};

export type ReviewNote = NoteAnchor & {
  id: string;
  text: string;
  /** Set once the note has been posted to the agent. */
  sentAt?: string;
  createdAt: string;
};

/** The note being written: where it goes, and its text so far. */
export type NoteDraft = { range: NoteAnchor; text: string };

export function noteAnchorKey(anchor: NoteAnchor): string {
  const start = anchor.startSide ? `${anchor.startSide}@` : '';
  return `${anchor.path}:${anchor.side}:${start}${anchor.lineNumber}-${anchor.endLineNumber}`;
}

export function queuedNotes(notes: readonly ReviewNote[]): ReviewNote[] {
  return notes.filter((note) => note.sentAt === undefined);
}

/** Queued notes that still have text, in the order the dump will use. */
export function sendableNotes(notes: readonly ReviewNote[]): ReviewNote[] {
  return orderNotes(queuedNotes(notes)).filter(
    (note) => note.text.trim() !== ''
  );
}

/** File then line, so the dock and the dump walk the diff the same way. */
export function orderNotes(notes: readonly ReviewNote[]): ReviewNote[] {
  return [...notes].sort(
    (a, b) => a.path.localeCompare(b.path) || a.lineNumber - b.lineNumber
  );
}

/**
 * The prompt that carries queued notes to the agent: one numbered item per
 * note, each naming the file and line, in file order so the agent walks the
 * diff the way the reviewer did.
 */
export function formatNotesForAgent(notes: readonly ReviewNote[]): string {
  const ordered = orderNotes(notes);
  if (ordered.length === 0) return '';
  if (ordered.length === 1) {
    const note = ordered[0]!;
    return `Review note on \`${note.path}\`, ${describeLineRange(note)}:\n\n${note.text.trim()}`;
  }
  const items = ordered.map(
    (note, index) =>
      `${index + 1}. \`${note.path}\`, ${describeLineRange(note)}: ${note.text.trim()}`
  );
  return `Please address these ${ordered.length} review notes on the current changes:\n\n${items.join('\n')}`;
}
