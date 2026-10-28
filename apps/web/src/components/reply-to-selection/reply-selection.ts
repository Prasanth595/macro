/**
 * Whether a native text selection is a quote-reply candidate: non-empty,
 * non-collapsed, and fully inside the reply container. Text in the diffs
 * drawn inside the container counts too, though Pierre renders them in
 * shadow roots, and a quote from one diff names its file and lines.
 */

import {
  describeLineRange,
  type LineRange,
} from '@app/components/diff-view/model/lines';
import {
  diffShadowRoots,
  selectedDiffLines,
} from '@app/components/diff-view/pierre/selected-lines';

export type ReplyableSelection = {
  text: string;
  /** Set when the text was selected within one file's diff. */
  lines?: LineRange;
};

export function normalizeReplySelection(text: string): string | undefined {
  const trimmed = text.replace(/ /g, ' ').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** `contains`, looking through the shadow roots between `node` and `container`. */
export function isInside(
  container: Node | null | undefined,
  node: Node
): boolean {
  if (!container) return false;
  let current: Node | undefined = node;
  while (current) {
    if (container.contains(current)) return true;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : undefined;
  }
  return false;
}

export function readReplyableSelection(
  container: Element | null | undefined
): ReplyableSelection | undefined {
  if (!container) return undefined;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;
  const [range] = selection.getComposedRanges({
    shadowRoots: diffShadowRoots(container),
  });
  if (!range || range.collapsed) return undefined;
  if (
    !isInside(container, range.startContainer) ||
    !isInside(container, range.endContainer)
  ) {
    return undefined;
  }
  const text = normalizeReplySelection(selection.toString());
  if (!text) return undefined;
  return { text, lines: selectedDiffLines(range) };
}

/** The quote the composer receives: diff text leads with its file and lines. */
export function formatReplyQuote(selection: ReplyableSelection): string {
  const { text, lines } = selection;
  if (!lines) return text;
  return `\`${lines.path}\`, ${describeLineRange(lines)}\n\n${text}`;
}
