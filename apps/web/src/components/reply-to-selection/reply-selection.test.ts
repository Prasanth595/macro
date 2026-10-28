import { describe, expect, it } from 'vitest';
import {
  formatReplyQuote,
  isInside,
  normalizeReplySelection,
} from './reply-selection';

describe('normalizeReplySelection', () => {
  it('trims whitespace and nbsp', () => {
    expect(normalizeReplySelection('  hello world  ')).toBe('hello world');
    expect(normalizeReplySelection(' quoted ')).toBe('quoted');
  });

  it('rejects whitespace-only selections', () => {
    expect(normalizeReplySelection('   \n\t  ')).toBeUndefined();
    expect(normalizeReplySelection(' ')).toBeUndefined();
    expect(normalizeReplySelection('')).toBeUndefined();
  });
});

describe('isInside', () => {
  it('requires the node to live in the container', () => {
    const container = document.createElement('div');
    const outside = document.createElement('div');
    const inside = document.createElement('span');
    container.append(inside);
    document.body.append(container, outside);

    expect(isInside(container, inside)).toBe(true);
    expect(isInside(container, outside)).toBe(false);

    container.remove();
    outside.remove();
  });

  it('looks through the shadow roots of hosts in the container', () => {
    const container = document.createElement('div');
    const host = document.createElement('div');
    container.append(host);
    const line = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(line);
    const outsideHost = document.createElement('div');
    const outsideLine = document.createElement('div');
    outsideHost.attachShadow({ mode: 'open' }).append(outsideLine);
    document.body.append(container, outsideHost);

    expect(container.contains(line)).toBe(false);
    expect(isInside(container, line)).toBe(true);
    expect(isInside(container, outsideLine)).toBe(false);

    container.remove();
    outsideHost.remove();
  });
});

describe('formatReplyQuote', () => {
  it('quotes transcript text as it is', () => {
    expect(formatReplyQuote({ text: 'Your review is complete.' })).toBe(
      'Your review is complete.'
    );
  });

  it('leads diff text with its file and lines', () => {
    expect(
      formatReplyQuote({
        text: 'const total = sum(items);\nreturn total;',
        lines: {
          path: 'src/cart.ts',
          side: 'additions',
          lineNumber: 12,
          endLineNumber: 13,
        },
      })
    ).toBe(
      '`src/cart.ts`, lines 12–13 (new)\n\nconst total = sum(items);\nreturn total;'
    );
  });
});
