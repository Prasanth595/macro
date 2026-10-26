import {
  $getNodeByKey,
  $isElementNode,
  $isTextNode,
  type LexicalNode,
  type PointType,
} from 'lexical';

export type SavedPoint = Pick<PointType, 'key' | 'offset' | 'type'>;

function $insertAfter(node: LexicalNode, nodes: LexicalNode[]) {
  let previous = node;
  for (const inserted of nodes) {
    previous.insertAfter(inserted);
    previous = inserted;
  }
  return true;
}

const $isBlock = (node: LexicalNode | null) =>
  $isElementNode(node) && !node.isInline();

/**
 * Inserts inline nodes at a point saved from an earlier selection, without
 * touching the live selection (Lexical's insertNodes inserts at the live
 * selection whenever one exists). Returns false when the point's node is gone
 * or the point has no inline position to insert at.
 */
export function $insertAtSavedPoint(
  point: SavedPoint,
  nodes: LexicalNode[]
): boolean {
  const node = $getNodeByKey(point.key);
  if (point.type === 'text' && $isTextNode(node)) {
    const offset = Math.min(point.offset, node.getTextContentSize());
    if (offset === 0) {
      for (const inserted of nodes) node.insertBefore(inserted);
      return true;
    }
    return $insertAfter(node.splitText(offset)[0], nodes);
  }
  if (point.type !== 'element' || !$isElementNode(node)) return false;

  const offset = Math.min(point.offset, node.getChildrenSize());
  const before = offset > 0 ? node.getChildAtIndex(offset - 1) : null;
  // Between blocks, e.g. after a checklist item: follow the block's text.
  if ($isElementNode(before) && !before.isInline()) {
    const leaf = before.getLastDescendant();
    return leaf !== null && !$isElementNode(leaf) && $insertAfter(leaf, nodes);
  }
  // Lists, tables and the root hold only blocks.
  if ($isBlock(node.getFirstChild()) || node.getParent() === null) return false;
  node.splice(offset, 0, nodes);
  return true;
}
