import {
  $getNodeById,
  $getPeerId,
  $liftDraftCommentMarks,
  $restoreDraftCommentMarks,
  $setLocal,
  isSerializedImageNode,
  isSerializedVideoNode,
  type NodeIdMappings,
  stripDraftCommentMarks,
} from '@macro-inc/lexical-core';
import deepEqual from 'fast-deep-equal';
import {
  $getEditor,
  $isElementNode,
  $parseSerializedNode,
  type LexicalEditor,
  type LexicalNode,
  type SerializedEditorState,
  type SerializedLexicalNode,
} from 'lexical';

type NodeWithChildren = {
  children: SerializedLexicalNode[];
} & SerializedLexicalNode;

type NodeWithCustomId = { $: { id: string } } & SerializedLexicalNode;

// Improved type guards with clearer naming
function hasChildren(node: SerializedLexicalNode): node is NodeWithChildren {
  return 'children' in node && Array.isArray(node.children);
}

function hasCustomId(node: SerializedLexicalNode): node is NodeWithCustomId {
  return '$' in node && 'id' in node.$!;
}

function getNodeId(node: SerializedLexicalNode): string | undefined {
  if (hasCustomId(node)) {
    return node.$.id;
  }
  return undefined;
}

/** Get a node's value that is safe to compare between updates */
function getComparableNodeValue(
  node: SerializedLexicalNode
): Record<string, any> {
  if (isSerializedImageNode(node) || isSerializedVideoNode(node)) {
    // NOTE: dss image urls have a bunch of generated query params that we don't want to compare
    return {
      ...node,
      url: node.srcType === 'dss' ? undefined : node.url,
    };
  }
  return {
    ...node,
    children: undefined,
  };
}

// Map of a nodeId -> parent nodeId. If parent is undefined, it means the node is the root node
type ParentMap = Map<string, string | undefined>;

function buildParentMap(
  node: SerializedLexicalNode,
  parentId: string | undefined,
  out: ParentMap
) {
  const id = getNodeId(node);
  if (id) out.set(id, parentId);
  if (hasChildren(node)) {
    for (const child of node.children) {
      buildParentMap(child, id, out);
    }
  }
}

/**
 * Reconcile changes between two editor states
 * Recursively diff and apply changes between nodes
 *
 * @param oldState - Old editor state
 * @param newState - New editor state
 * @param mapping - LoroNodeMapping instance
 */
export function $reconcileLexicalState(
  oldState: SerializedEditorState,
  newState: SerializedEditorState,
  mapping: NodeIdMappings,
  peerId: () => string
): void {
  const editor = $getEditor();

  // The local draft comment mark is never synced, so it is lifted out while
  // the tree is compared with the shared state. Drafts that arrive in the
  // shared state were left behind by sessions that ended mid-draft.
  const drafts = $liftDraftCommentMarks();
  const oldRoot = stripDraftCommentMarks(oldState).root;
  const newRoot = stripDraftCommentMarks(newState).root;

  const newParentMap = new Map<string, string | undefined>();
  const oldParentMap = new Map<string, string | undefined>();
  buildParentMap(newRoot, undefined, newParentMap);
  buildParentMap(oldRoot, undefined, oldParentMap);

  $applyChildren(
    editor,
    mapping,
    oldRoot,
    newRoot,
    oldParentMap,
    newParentMap,
    peerId
  );

  $restoreDraftCommentMarks(drafts);
}

// Mark incoming tracked peerId nodes with correct local status.
function $applyLocalStatus(node: LexicalNode, peerId: () => string) {
  const nodePeerId = $getPeerId(node);
  if (nodePeerId) {
    $setLocal(node, nodePeerId === peerId());
  }
}

// Apply state changes to a specific node
function $applyNodeState(
  editor: LexicalEditor,
  mapping: NodeIdMappings,
  nodeId: string,
  state: Partial<SerializedLexicalNode>,
  peerId: () => string
): void {
  const node = $getNodeById(editor, mapping.idToNodeKeyMap, nodeId);
  if (!node) {
    console.error('Node not found for ID:', nodeId);
    return;
  }

  try {
    // Update the node with new state and mark it as dirty to trigger re-render
    const newNode = node.updateFromJSON(state);
    $applyLocalStatus(newNode, peerId);
    newNode.markDirty();
  } catch (error) {
    console.error(`Failed to update node ${nodeId}:`, error);
  }
}

/** Diff and apply changes between two sets of nodes
 *
 * @param editor - Lexical editor instance
 * @param mapping - LoroNodeMapping instance
 * @param oldNode - Old node to diff against
 * @param newNode - New node to diff against
 */
function $applyChildren(
  editor: LexicalEditor,
  mapping: NodeIdMappings,
  oldNode: NodeWithChildren,
  newNode: NodeWithChildren,
  oldParentMap: ParentMap,
  newParentMap: ParentMap,
  peerId: () => string
): void {
  const oldChildren = oldNode.children;
  const newChildren = newNode.children;
  const parentId = getNodeId(oldNode as any);
  const parent = parentId
    ? $getNodeById(editor, mapping.idToNodeKeyMap, parentId)
    : null;

  if (!parent || !$isElementNode(parent)) {
    console.error(
      'Parent node notOD found or is not an ElementNode during reconciliation'
    );
    return;
  }

  const oldIdToIndex = new Map<string, number>();
  const newIdToIndex = new Map<string, number>();

  for (let i = 0; i < oldChildren.length; i++) {
    const id = getNodeId(oldChildren[i]);
    if (id) oldIdToIndex.set(id, i);
  }
  for (let i = 0; i < newChildren.length; i++) {
    const id = getNodeId(newChildren[i]);
    if (id) newIdToIndex.set(id, i);
  }

  // Remove nodes that arent present in the newChildren array first. The
  // parent's children line up with oldChildren, so walk both together.
  let child = parent.getFirstChild();
  for (const oldChild of oldChildren) {
    if (!child) break;
    const next = child.getNextSibling();
    const id = getNodeId(oldChild);
    if (!id || !newIdToIndex.has(id)) child.remove(true);
    child = next;
  }

  // Children before `index` are in place; `expected` is the one after them.
  // New nodes collect in `inserts` and go in with one splice per run, since
  // each splice walks to its index.
  let index = 0;
  let expected = parent.getFirstChild();
  let inserts: LexicalNode[] = [];
  const flushInserts = () => {
    if (inserts.length === 0) return;
    parent.splice(index, 0, inserts);
    index += inserts.length;
    inserts = [];
  };

  for (const newChild of newChildren) {
    const id = getNodeId(newChild);

    let node = id ? $getNodeById(editor, mapping.idToNodeKeyMap, id) : null;

    // Node already exists, check for move / update
    if (node && id) {
      flushInserts();
      const oldParentId = oldParentMap.get(id);
      const newParentId = newParentMap.get(id);

      // Handle cross-parent move
      if (oldParentId && newParentId && oldParentId !== newParentId) {
        parent.splice(index, 0, [node]);
        index++;
        continue;
      }

      if (node.is(expected)) {
        index++;
        expected = node.getNextSibling();
      } else if (node.getParent()?.is(parent)) {
        parent.splice(index, 0, [node]);
        index++;
      }

      // Node exists in old and new children
      const oldIdx = oldIdToIndex.get(id!);
      if (oldIdx !== undefined) {
        const oldChildValue = getComparableNodeValue(oldChildren[oldIdx]);
        const newChildValue = getComparableNodeValue(newChild);
        // Node has a value change
        if (!deepEqual(oldChildValue, newChildValue)) {
          $applyNodeState(editor, mapping, id!, newChildValue, peerId);
        }
      }

      // Recurse all children if they exist
      if (hasChildren(newChild)) {
        const oldIdx = oldIdToIndex.get(id!);
        if (oldIdx !== undefined && hasChildren(oldChildren[oldIdx])) {
          $applyChildren(
            editor,
            mapping,
            oldChildren[oldIdx] as NodeWithChildren,
            newChild as NodeWithChildren,
            oldParentMap,
            newParentMap,
            peerId
          );
        }
      }
    } else {
      inserts.push($parseSerializedNode(newChild));
    }
  }
  flushInserts();
}
