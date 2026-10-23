import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import { $getRoot, $isParagraphNode, createEditor } from 'lexical';
import { describe, expect, it } from 'vitest';
import { SupportedNodeTypes } from '../node-list';
import { $isTemplateVariableNode } from '../nodes/TemplateVariableNode';
import { ALL_TRANSFORMERS } from '../transformers';
import { markdownToPlainText } from '../utils/parsers';

// The exact form `crates/mention_utils` serializes.
const SLOT =
  '<m-template-variable>{"key":"urgent_channel"}</m-template-variable>';

function editorWith(markdown: string) {
  const editor = createEditor({
    nodes: SupportedNodeTypes,
    onError: (error) => {
      throw error;
    },
  });
  editor.update(() => $convertFromMarkdownString(markdown, ALL_TRANSFORMERS), {
    discrete: true,
  });
  return editor;
}

describe('template variable', () => {
  it('parses into a chip and serializes back unchanged', () => {
    const markdown = `Post urgent threads to ${SLOT} right away.`;
    const editor = editorWith(markdown);
    const chips = editor.getEditorState().read(() => {
      const [paragraph] = $getRoot().getChildren();
      if (!$isParagraphNode(paragraph)) throw new Error('expected a paragraph');
      return paragraph
        .getChildren()
        .filter($isTemplateVariableNode)
        .map((node) => node.getVariableKey());
    });
    expect(chips).toEqual(['urgent_channel']);
    const exported = editor
      .getEditorState()
      .read(() => $convertToMarkdownString(ALL_TRANSFORMERS));
    expect(exported).toBe(markdown);
  });

  it('reads as its key in plain text', () => {
    expect(markdownToPlainText(`Post to ${SLOT}.`)).toBe(
      'Post to {urgent_channel}.'
    );
  });
});
