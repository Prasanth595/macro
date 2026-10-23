import {
  type FileDocumentData,
  loadFileDocumentData,
} from '@service-storage/util/fileDocument';

export type UnknownDocumentData = FileDocumentData;

export function loadUnknownDocument(
  documentId: string
): Promise<UnknownDocumentData> {
  return loadFileDocumentData(documentId);
}
