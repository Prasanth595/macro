import {
  $createDocumentMentionNode,
  $isClassedBlockNode,
} from '@macro-inc/lexical-core';
import {
  $addUpdateTag,
  $createParagraphNode,
  $getRoot,
  type LexicalEditor,
} from 'lexical';
import type { Accessor } from 'solid-js';
import type {
  EmailComposeFeedback,
  EmailEditorFiles,
  UploadedDocument,
} from '../context/compose-capabilities';
import { MAX_ATTACHMENTS_BYTES_SIZE } from '../core/constants';

const LIMIT_LABEL = `${MAX_ATTACHMENTS_BYTES_SIZE / 1_000_000} MB`;

/**
 * Links each document on its own line at the end of the written message,
 * above the quoted thread a reply carries, where recipients expect attachments.
 */
export function appendAttachmentLinks(
  editor: LexicalEditor,
  documents: readonly UploadedDocument[]
) {
  if (documents.length === 0) return;
  editor.update(() => {
    // Attaching from the toolbar must not pull focus into the editor.
    $addUpdateTag('skip-dom-selection');
    const root = $getRoot();
    const quote = root
      .getChildren()
      .find(
        (node) =>
          $isClassedBlockNode(node) && node.__classes.includes('macro_quote')
      );
    for (const document of documents) {
      const paragraph = $createParagraphNode().append(
        $createDocumentMentionNode({
          documentId: document.documentId,
          documentName: document.name,
          blockName: document.blockName,
        })
      );
      if (quote) quote.insertBefore(paragraph);
      else root.append(paragraph);
    }
  });
}

/**
 * Offers to share files that exceed the delivery limit as Macro links. Each
 * confirmed file is uploaded as a document, opened to anyone with the link,
 * and linked from the body, as a file dropped into the body would be.
 */
export function createAttachmentLinkOffer(options: {
  editor: Accessor<LexicalEditor | undefined>;
  notices: Pick<EmailComposeFeedback, 'confirm'>;
  editorFiles: Pick<EmailEditorFiles, 'uploadDocuments' | 'makePublic'>;
}) {
  return async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    const single = files.length === 1;
    const confirmed = await options.notices.confirm({
      title: `Attachments exceed ${LIMIT_LABEL}`,
      body: single
        ? `"${files[0].name}" won't fit as an attachment. Upload it to Macro and share a view-only link instead?`
        : `${files.length} files won't fit as attachments. Upload them to Macro and share view-only links instead?`,
      confirmLabel: single ? 'Share link' : 'Share links',
    });
    if (!confirmed) return;
    const documents = await options.editorFiles.uploadDocuments(files);
    for (const document of documents) {
      options.editorFiles.makePublic(document.documentId);
    }
    const editor = options.editor();
    if (editor) appendAttachmentLinks(editor, documents);
  };
}
