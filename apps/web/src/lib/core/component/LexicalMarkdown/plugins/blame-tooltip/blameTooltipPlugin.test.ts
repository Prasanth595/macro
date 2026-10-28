import { $setId } from '@macro-inc/lexical-core';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
} from 'lexical';
import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';
import {
  blameTooltipPlugin,
  createBlameTooltipStore,
} from './blameTooltipPlugin';

describe('blame tooltip gating', () => {
  it('preserves the hovered target across Alt release and reacts to preferences', () => {
    createRoot((dispose) => {
      const [enabled, setEnabled] = createSignal(true);
      const [onlyWhileHoldingAlt, setOnlyWhileHoldingAlt] = createSignal(true);
      const [state, setState] = createBlameTooltipStore({
        enabled,
        onlyWhileHoldingAlt,
      });
      setState({ hovering: true, nodeId: 'paragraph', x: 20, y: 30 });
      expect(state.hovering).toBe(false);
      expect(state.nodeId).toBeNull();
      setState({ altHeld: true });
      expect(state.hovering).toBe(true);
      expect(state.nodeId).toBe('paragraph');
      setState({ altHeld: false });
      expect(state.nodeId).toBeNull();
      setOnlyWhileHoldingAlt(false);
      expect(state.hovering).toBe(true);
      setEnabled(false);
      expect(state.hovering).toBe(false);
      expect(state.nodeId).toBeNull();
      dispose();
    });
  });

  it('handles keyboard, blur, pointer modifiers, and listener cleanup', () => {
    createRoot((dispose) => {
      const [state, setState] = createBlameTooltipStore({
        enabled: () => true,
        onlyWhileHoldingAlt: () => true,
      });
      const editor = createEditor({
        namespace: 'blame-test',
        onError: (error) => {
          throw error;
        },
      });
      const root = document.createElement('div');
      document.body.append(root);
      editor.setRootElement(root);
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          $setId(paragraph, 'paragraph');
          paragraph.append($createTextNode('Hover this text'));
          $getRoot().append(paragraph);
        },
        { discrete: true }
      );
      const unregister = blameTooltipPlugin({ setState })(editor);
      const text = root.querySelector('span')!;
      text.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
      expect(state.hovering).toBe(false);
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Alt', altKey: true })
      );
      expect(state.nodeId).toBe('paragraph');
      window.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'Alt', altKey: false })
      );
      expect(state.nodeId).toBeNull();
      text.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, altKey: true })
      );
      expect(state.hovering).toBe(true);
      window.dispatchEvent(new Event('blur'));
      expect(state.hovering).toBe(false);
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Alt', altKey: true })
      );
      expect(state.hovering).toBe(false);
      text.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, altKey: true })
      );
      unregister();
      expect(state.hovering).toBe(false);
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Alt', altKey: true })
      );
      expect(state.hovering).toBe(false);
      editor.setRootElement(null);
      root.remove();
      dispose();
    });
  });
});
