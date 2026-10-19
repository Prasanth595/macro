import {
  $createClassedBlockNode,
  $isClassedBlockNode,
  $isDocumentMentionNode,
} from '@macro-inc/lexical-core';
import { $getRoot, $isElementNode, type LexicalEditor } from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_ATTACHMENTS_BYTES_SIZE } from '../core/constants';
import { createComposeContext } from '../tests/capabilities';
import { mountEmailComposer } from '../tests/composer';
import { createEmailEditor } from '../tests/editor';
import { mountReplyComposer } from '../tests/reply';
import {
  appendAttachmentLinks,
  createAttachmentLinkOffer,
} from './attachment-links';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const report = {
  documentId: 'doc-1',
  name: 'Quarterly report',
  blockName: 'pdf',
};
const huge = new File(
  [new ArrayBuffer(MAX_ATTACHMENTS_BYTES_SIZE)],
  'huge.mov'
);
const small = new File(['notes'], 'notes.txt');

/** One entry per top-level block: the written text, a link's document, or the quoted thread. */
function outline(editor: LexicalEditor): string[] {
  return editor.read(() =>
    $getRoot()
      .getChildren()
      .map((node) => {
        if ($isClassedBlockNode(node)) return 'quote';
        const mention = $isElementNode(node)
          ? node.getChildren().find((child) => $isDocumentMentionNode(child))
          : undefined;
        return mention
          ? `link:${mention.getDocumentId()}`
          : `text:${node.getTextContent()}`;
      })
  );
}

function appendQuotedThread(editor: LexicalEditor) {
  editor.update(
    () =>
      $getRoot().append(
        $createClassedBlockNode({
          tag: 'div',
          classes: ['macro_quote', 'gmail_quote'],
        })
      ),
    { discrete: true }
  );
}

describe('appendAttachmentLinks', () => {
  it('links each document after the written text, above the quoted thread', () => {
    const editor = createEmailEditor('Please review');
    appendQuotedThread(editor);
    appendAttachmentLinks(editor, [
      report,
      { documentId: 'doc-2', name: 'Recording', blockName: 'video' },
    ]);
    expect(outline(editor)).toEqual([
      'text:Please review',
      'link:doc-1',
      'link:doc-2',
      'quote',
    ]);
  });

  it('links at the end of a message without a quoted thread', () => {
    const editor = createEmailEditor('Please review');
    appendAttachmentLinks(editor, [report]);
    expect(outline(editor)).toEqual(['text:Please review', 'link:doc-1']);
  });
});

describe('createAttachmentLinkOffer', () => {
  function offerFor(editor: LexicalEditor, confirmed: boolean) {
    const confirm = vi.fn(async () => confirmed);
    const uploadDocuments = vi.fn(async () => [report]);
    const makePublic = vi.fn();
    const offer = createAttachmentLinkOffer({
      editor: () => editor,
      notices: { confirm },
      editorFiles: { uploadDocuments, makePublic },
    });
    return { offer, confirm, uploadDocuments, makePublic };
  }

  it('uploads nothing when the user declines', async () => {
    const editor = createEmailEditor('Hi');
    const { offer, confirm, uploadDocuments } = offerFor(editor, false);
    await offer([huge]);
    expect(confirm).toHaveBeenCalledExactlyOnceWith({
      title: 'Attachments exceed 18 MB',
      body: '"huge.mov" won\'t fit as an attachment. Upload it to Macro and share a view-only link instead?',
      confirmLabel: 'Share link',
    });
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(outline(editor)).toEqual(['text:Hi']);
  });

  it('uploads, opens, and links each confirmed file', async () => {
    const editor = createEmailEditor('Hi');
    const { offer, confirm, uploadDocuments, makePublic } = offerFor(
      editor,
      true
    );
    await offer([huge, small]);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "2 files won't fit as attachments. Upload them to Macro and share view-only links instead?",
        confirmLabel: 'Share links',
      })
    );
    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith([huge, small]);
    expect(makePublic).toHaveBeenCalledExactlyOnceWith('doc-1');
    expect(outline(editor)).toEqual(['text:Hi', 'link:doc-1']);
  });

  it('asks nothing when every file fits', async () => {
    const editor = createEmailEditor('Hi');
    const { offer, confirm } = offerFor(editor, true);
    await offer([]);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('oversized attachments in the composers', () => {
  it('attaches what fits in a new email and offers the rest as links', async () => {
    const context = createComposeContext();
    const root = mountEmailComposer(context);
    try {
      root.edit('With files');
      await root.state.context.onAddAttachments([small, huge]);
      expect(root.state.context.attachments()).toEqual([
        { type: 'local', file: small },
      ]);
      expect(context.notices.confirm).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ confirmLabel: 'Share link' })
      );
      expect(context.editorFiles.uploadDocuments).not.toHaveBeenCalled();
      expect(outline(root.editor)).toEqual(['text:With files']);
    } finally {
      root.dispose();
    }
  });

  it('links a confirmed file above the quoted thread of a reply without attaching it', async () => {
    const context = createComposeContext();
    vi.mocked(context.notices.confirm).mockResolvedValue(true);
    vi.mocked(context.editorFiles.uploadDocuments).mockResolvedValue([report]);
    const composer = mountReplyComposer(context);
    try {
      appendQuotedThread(composer.editor);
      await composer.handleAddAttachments([huge]);
      expect(
        context.editorFiles.uploadDocuments
      ).toHaveBeenCalledExactlyOnceWith([huge]);
      expect(context.editorFiles.makePublic).toHaveBeenCalledExactlyOnceWith(
        'doc-1'
      );
      expect(composer.form.attachments.list()).toEqual([]);
      expect(outline(composer.editor)).toEqual([
        'text:Ready to send',
        'link:doc-1',
        'quote',
      ]);
    } finally {
      composer.dispose();
    }
  });
});
