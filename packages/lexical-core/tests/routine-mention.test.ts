import { describe, expect, it } from 'vitest';
import { extractChannelMentionsFromMarkdown } from '../utils/markdown-mentions';
import {
  markdownToSerializedEditorStateWithIds,
  serializedEditorStateToMarkdown,
} from '../utils/markdown-state';

describe('routine links in agent replies', () => {
  it('imports a routine link as a clickable document mention', () => {
    const id = '0195ceb6-ec2e-7023-80e4-6e084fa6cccd';
    const state = markdownToSerializedEditorStateWithIds(
      `Created [Daily review](routine:${id}).`
    );
    expect(state.root.children[0]).toMatchObject({
      children: [
        { type: 'text', text: 'Created ' },
        {
          type: 'document-mention',
          documentId: id,
          documentName: 'Daily review',
          blockName: 'routine',
        },
        { type: 'text', text: '.' },
      ],
    });
    expect(serializedEditorStateToMarkdown(state)).toContain(
      '"blockName":"routine"'
    );
    expect(
      extractChannelMentionsFromMarkdown(
        `Created [Daily review](routine:${id}).`
      )
    ).toEqual([{ entityType: 'automation', entityId: id }]);
  });
});
