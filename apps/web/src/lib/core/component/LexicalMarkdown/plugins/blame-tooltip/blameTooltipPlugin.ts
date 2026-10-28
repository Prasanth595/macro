import { isTouchDevice } from '@core/mobile/isTouchDevice';
import { mergeRegister } from '@lexical/utils';
import { $getId } from '@macro-inc/lexical-core';
import {
  $getNearestNodeFromDOMNode,
  $isTextNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import type { Accessor } from 'solid-js';
import { createStore } from 'solid-js/store';

export type BlameTooltipState = {
  hovering: boolean;
  x: number;
  y: number;
  nodeId: string | null;
};

export function createBlameTooltipStore(options: {
  enabled: Accessor<boolean>;
  onlyWhileHoldingAlt: Accessor<boolean>;
}) {
  const [state, setState] = createStore<
    BlameTooltipState & { altHeld: boolean }
  >({
    hovering: false,
    x: 0,
    y: 0,
    nodeId: null,
    altHeld: false,
  });
  const hovering = () =>
    state.hovering &&
    options.enabled() &&
    (!options.onlyWhileHoldingAlt() || state.altHeld);
  const gatedState: BlameTooltipState = {
    get hovering() {
      return hovering();
    },
    get x() {
      return state.x;
    },
    get y() {
      return state.y;
    },
    get nodeId() {
      return hovering() ? state.nodeId : null;
    },
  };
  return [gatedState, setState] as const;
}

type BlameTooltipPluginProps = {
  setState: (state: Partial<BlameTooltipState & { altHeld: boolean }>) => void;
};

/**
 * Given a DOM element under the cursor, find the stable Lexical id of the
 * nearest ancestor text-bearing node. Must be called inside `editor.read()`
 * so the Lexical state is readable.
 *
 * Returns null when the cursor isn't over a text node, or when no ancestor
 * has been assigned a stable id yet (typically transient nodes).
 */
function $resolveHoveredNodeId(target: HTMLElement): string | null {
  const node = $getNearestNodeFromDOMNode(target);
  if (!node || !$isTextNode(node)) return null;

  let cursor: LexicalNode | null = node;
  while (cursor) {
    const id = $getId(cursor);
    if (id) return id;
    cursor = cursor.getParent();
  }
  return null;
}

function registerBlameTooltipPlugin(
  editor: LexicalEditor,
  props: BlameTooltipPluginProps
) {
  const handlePointerMove = (e: MouseEvent) => {
    if (isTouchDevice()) return;
    props.setState({ altHeld: e.altKey });
    const target = e.target;
    if (!(target instanceof HTMLElement)) {
      props.setState({ hovering: false, nodeId: null });
      return;
    }

    // Suppress while the user has a text selection — that's when the
    // formatting popup shows and the tooltip would compete with it.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().length > 0) {
      props.setState({ hovering: false, nodeId: null });
      return;
    }

    const nodeId = editor.read(() => $resolveHoveredNodeId(target));
    if (nodeId === null) {
      props.setState({ hovering: false, nodeId: null });
      return;
    }
    props.setState({
      hovering: true,
      x: e.clientX,
      y: e.clientY,
      nodeId,
    });
  };

  const dismiss = () => {
    props.setState({ hovering: false, nodeId: null });
  };

  const handleKey = (event: KeyboardEvent) => {
    props.setState({ altHeld: event.altKey });
  };
  const handleBlur = () => {
    props.setState({ altHeld: false, hovering: false, nodeId: null });
  };

  document.addEventListener('scroll', dismiss, true);
  window.addEventListener('keydown', handleKey);
  window.addEventListener('keyup', handleKey);
  window.addEventListener('blur', handleBlur);

  return mergeRegister(
    () => {
      document.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      window.removeEventListener('blur', handleBlur);
      handleBlur();
    },
    editor.registerRootListener((root, prevRoot) => {
      if (root) {
        root.addEventListener('pointermove', handlePointerMove);
        root.addEventListener('pointerleave', dismiss);
        root.addEventListener('pointerdown', dismiss);
        root.addEventListener('beforeinput', dismiss);
      }
      if (prevRoot) {
        prevRoot.removeEventListener('pointermove', handlePointerMove);
        prevRoot.removeEventListener('pointerleave', dismiss);
        prevRoot.removeEventListener('pointerdown', dismiss);
        prevRoot.removeEventListener('beforeinput', dismiss);
      }
    })
  );
}

export function blameTooltipPlugin(props: BlameTooltipPluginProps) {
  return (editor: LexicalEditor) => registerBlameTooltipPlugin(editor, props);
}
