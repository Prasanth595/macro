import { describe, expect, it } from 'vitest';
import { describeLineRange } from './lines';

describe('describeLineRange', () => {
  it('names a single line and a range on each side', () => {
    expect(
      describeLineRange({
        side: 'additions',
        lineNumber: 10,
        endLineNumber: 10,
      })
    ).toBe('line 10 (new)');
    expect(
      describeLineRange({ side: 'deletions', lineNumber: 3, endLineNumber: 6 })
    ).toBe('lines 3–6 (old)');
  });

  it('names both sides of a range dragged from deleted lines into added ones', () => {
    expect(
      describeLineRange({
        side: 'additions',
        startSide: 'deletions',
        lineNumber: 87,
        endLineNumber: 91,
      })
    ).toBe('line 87 (old) to line 91 (new)');
  });
});
