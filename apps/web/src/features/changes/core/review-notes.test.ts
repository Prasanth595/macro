import { describe, expect, it } from 'vitest';
import {
  formatNotesForAgent,
  queuedNotes,
  type ReviewNote,
  sendableNotes,
} from './review-notes';

function note(overrides: Partial<ReviewNote> = {}): ReviewNote {
  return {
    id: 'n1',
    path: 'a.ts',
    side: 'additions',
    lineNumber: 10,
    endLineNumber: 10,
    text: 'Rename this',
    createdAt: '2026-09-15T00:00:00Z',
    ...overrides,
  };
}

describe('queuedNotes', () => {
  it('drops sent notes', () => {
    expect(
      queuedNotes([note(), note({ id: 'n2', sentAt: 't' })]).map((n) => n.id)
    ).toEqual(['n1']);
  });
});

describe('sendableNotes', () => {
  it('drops sent and empty notes and orders by file then line', () => {
    expect(
      sendableNotes([
        note({ id: 'b', path: 'b.ts', text: 'Keep' }),
        note({ id: 'empty', text: '   ' }),
        note({ id: 'sent', sentAt: 't' }),
        note({ id: 'a', lineNumber: 3, endLineNumber: 3 }),
      ]).map((n) => n.id)
    ).toEqual(['a', 'b']);
  });
});

describe('formatNotesForAgent', () => {
  it('is empty without notes', () => {
    expect(formatNotesForAgent([])).toBe('');
  });

  it('writes one note as prose with its location', () => {
    expect(formatNotesForAgent([note()])).toBe(
      'Review note on `a.ts`, line 10 (new):\n\nRename this'
    );
  });

  it('numbers several notes in file and line order, naming ranges and sides', () => {
    const text = formatNotesForAgent([
      note({ id: 'b', path: 'b.ts', side: 'deletions', text: 'Keep this' }),
      note({
        id: 'a',
        lineNumber: 3,
        endLineNumber: 6,
        text: '  Extract a helper  ',
      }),
    ]);
    expect(text).toBe(
      [
        'Please address these 2 review notes on the current changes:',
        '',
        '1. `a.ts`, lines 3–6 (new): Extract a helper',
        '2. `b.ts`, line 10 (old): Keep this',
      ].join('\n')
    );
  });
});
