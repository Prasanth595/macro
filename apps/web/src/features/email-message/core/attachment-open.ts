const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function isDocxAttachment(
  fileName: string | null | undefined,
  mimeType: string | null | undefined
): boolean {
  const type = mimeType?.split(';')[0].trim().toLowerCase();
  if (type === DOCX_MIME) return true;
  return !!fileName?.toLowerCase().endsWith('.docx');
}

export type AttachmentCopyChoice = {
  documentId: string;
  name: string;
};

export type AttachmentOpenPlan =
  | { kind: 'open-original' }
  | {
      kind: 'choose';
      copies: AttachmentCopyChoice[];
      /** No Drive copy yet; the live attachment document is the edited one. */
      includeCurrent: boolean;
    };

/**
 * A Word attachment opens straight through until someone has a saved Drive
 * copy or the attachment document already has collaborative edits. After
 * that, the chip asks which file to open.
 */
export function planAttachmentOpen(input: {
  isDocx: boolean;
  copies: AttachmentCopyChoice[];
  hasLiveCopy: boolean;
}): AttachmentOpenPlan {
  if (!input.isDocx || (input.copies.length === 0 && !input.hasLiveCopy)) {
    return { kind: 'open-original' };
  }
  return {
    kind: 'choose',
    copies: input.copies,
    includeCurrent: input.copies.length === 0,
  };
}
