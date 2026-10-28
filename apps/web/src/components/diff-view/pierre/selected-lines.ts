/**
 * The file lines a text selection covers in a Pierre diff. Pierre draws each
 * file inside a shadow root, so a selection there is only reachable through
 * those roots; the wrapper a diff renders into names its file in
 * `data-diff-path`.
 */

import { DIFFS_TAG_NAME } from '@pierre/diffs';
import type { DiffSide, LineRange } from '../model/lines';

/** The shadow roots of the diffs drawn inside `container`. */
export function diffShadowRoots(container: ParentNode): ShadowRoot[] {
  return [...container.querySelectorAll(DIFFS_TAG_NAME)].flatMap((host) =>
    host.shadowRoot ? [host.shadowRoot] : []
  );
}

type SelectedLine = { root: Node; side: DiffSide; lineNumber: number };

/** The node a boundary sits in, or the child it sits before (or after). */
function boundaryNode(node: Node, offset: number, edge: 'start' | 'end') {
  if (node instanceof Text) return node.parentElement;
  const child = node.childNodes[edge === 'start' ? offset : offset - 1];
  return (child instanceof Text ? child.parentElement : child) ?? node;
}

function lineElement(node: Node | null): Element | null {
  return node instanceof Element ? node.closest('[data-line]') : null;
}

/** Same rule as Pierre's annotation side: context follows its column. */
function sideOf(line: Element): DiffSide {
  const type = line.getAttribute('data-line-type');
  if (type === 'change-deletion') return 'deletions';
  if (type === 'change-addition') return 'additions';
  return line.closest('[data-code]')?.hasAttribute('data-deletions')
    ? 'deletions'
    : 'additions';
}

function selectedLine(line: Element): SelectedLine {
  return {
    root: line.getRootNode(),
    side: sideOf(line),
    lineNumber: Number(line.getAttribute('data-line')),
  };
}

/**
 * The lines from where `range` starts to where it ends, when both ends are
 * on lines of the same file's diff. A selection that ends at the very start
 * of a line (a triple-click, or a drag past the line end) ends on the line
 * before it.
 */
export function selectedDiffLines(range: AbstractRange): LineRange | undefined {
  const startLine = lineElement(
    boundaryNode(range.startContainer, range.startOffset, 'start')
  );
  let endLine = lineElement(
    boundaryNode(range.endContainer, range.endOffset, 'end')
  );
  if (!startLine || !endLine) return undefined;
  if (range.endOffset === 0 && endLine !== startLine) {
    let previous = endLine.previousElementSibling;
    while (previous && !previous.hasAttribute('data-line')) {
      previous = previous.previousElementSibling;
    }
    if (previous) endLine = previous;
  }
  const start = selectedLine(startLine);
  const end = selectedLine(endLine);
  if (start.root !== end.root || !(start.root instanceof ShadowRoot)) {
    return undefined;
  }
  const path = start.root.host
    .closest('[data-diff-path]')
    ?.getAttribute('data-diff-path');
  if (!path) return undefined;
  if (start.side === end.side) {
    return {
      path,
      side: end.side,
      lineNumber: Math.min(start.lineNumber, end.lineNumber),
      endLineNumber: Math.max(start.lineNumber, end.lineNumber),
    };
  }
  return {
    path,
    side: end.side,
    startSide: start.side,
    lineNumber: start.lineNumber,
    endLineNumber: end.lineNumber,
  };
}
