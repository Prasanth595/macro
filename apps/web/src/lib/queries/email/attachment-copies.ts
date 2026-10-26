import { throwOnErr } from '@core/util/result';
import { uploadFile } from '@core/util/upload';
import { emailClient } from '@service-email/client';
import type { AttachmentDriveCopyResponse } from '@service-email/generated/schemas/attachmentDriveCopyResponse';
import { storageServiceClient } from '@service-storage/client';
import { filenameWithoutExtension } from '@service-storage/util/filename';
import { refetchResources } from '@service-storage/util/refetchResources';
import { syncServiceClient } from '@service-sync/client';
import { queryOptions } from '@tanstack/solid-query';
import { getEmailAttachmentDocument } from './integration';
import { emailKeys } from './keys';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type EmailAttachmentDriveCopy = {
  documentId: string;
  name: string;
};

function toCopy(copy: AttachmentDriveCopyResponse): EmailAttachmentDriveCopy {
  return { documentId: copy.document_id, name: copy.name };
}

export async function listEmailAttachmentCopies(
  attachmentId: string
): Promise<EmailAttachmentDriveCopy[]> {
  const copies = await throwOnErr(() =>
    emailClient.listAttachmentDriveCopies(attachmentId)
  );
  return copies.copies.map(toCopy);
}

/** The attachment this document was imported from, or null when it is a normal file. */
export async function emailAttachmentForDocument(
  documentId: string
): Promise<string | null> {
  const result = await throwOnErr(() =>
    emailClient.attachmentForDocument(documentId)
  );
  return result.attachment_id ?? null;
}

export function emailAttachmentForDocumentOptions(documentId: string) {
  return queryOptions({
    queryKey: emailKeys.documentAttachment(documentId).queryKey,
    queryFn: () => emailAttachmentForDocument(documentId),
  });
}

export type DocxAttachmentOpenContext = {
  documentId: string;
  copies: EmailAttachmentDriveCopy[];
  /** The attachment document already has a collaborative copy. */
  hasLiveCopy: boolean;
};

export async function loadDocxAttachmentOpenContext(
  attachmentId: string
): Promise<DocxAttachmentOpenContext> {
  const [document, copies] = await Promise.all([
    throwOnErr(() => getEmailAttachmentDocument(attachmentId)),
    listEmailAttachmentCopies(attachmentId),
  ]);
  let hasLiveCopy = false;
  if (copies.length === 0) {
    const exists = await syncServiceClient.exists({
      documentId: document.document_id,
    });
    hasLiveCopy = exists.isOk() && exists.value.exists;
  }
  return {
    documentId: document.document_id,
    copies,
    hasLiveCopy,
  };
}

async function registerCopy(attachmentId: string, documentId: string) {
  await throwOnErr(() =>
    emailClient.registerAttachmentDriveCopy(attachmentId, documentId)
  );
  refetchResources();
}

/** A new Drive document from the attachment's original bytes, without later edits. */
export async function createFreshAttachmentCopy(
  attachmentId: string,
  fileName: string
): Promise<string> {
  const document = await throwOnErr(() =>
    getEmailAttachmentDocument(attachmentId)
  );
  const name = filenameWithoutExtension(fileName) || fileName || 'Document';
  const copied = await storageServiceClient.copyDocument({
    documentId: document.document_id,
    documentName: name,
  });
  if (copied.isErr()) throw new Error('Could not save a fresh copy');
  const documentId = copied.value.documentId;
  await registerCopy(attachmentId, documentId);
  return documentId;
}

/** Upload the editor's current bytes as a Drive document and remember it. */
export async function saveEditedAttachmentCopy(
  attachmentId: string,
  bytes: Uint8Array,
  fileName: string
): Promise<string> {
  const name = /\.docx$/i.test(fileName) ? fileName : `${fileName}.docx`;
  const file = new File(
    [new Blob([bytes.slice().buffer], { type: DOCX_MIME })],
    name,
    { type: DOCX_MIME }
  );
  const uploaded = await uploadFile(file, 'dss');
  if (uploaded.failed) throw new Error('Could not save a copy to Drive');
  if (uploaded.type !== 'document') {
    throw new Error('Could not save a copy to Drive');
  }
  await registerCopy(attachmentId, uploaded.documentId);
  return uploaded.documentId;
}
