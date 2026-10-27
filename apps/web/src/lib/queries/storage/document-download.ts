import type { DownloadSource } from '@core/util/createFileDownload';
import { catchToResult } from '@core/util/result';
import { formatDocumentName } from '@service-storage/util/filename';
import { getFileDocumentBlob, loadFileDocumentData } from './file-document';

/**
 * An uploaded document's latest stored file under its own name and
 * extension, fetched without opening its viewer.
 */
export function storedDocumentDownloadSource(
  documentId: string
): DownloadSource {
  return {
    id: documentId,
    name: 'download',
    load: (options) =>
      catchToResult(async () => {
        const { documentMetadata } = await loadFileDocumentData(
          documentId,
          options
        );
        options.signal.throwIfAborted();
        return {
          blob: await getFileDocumentBlob(
            {
              documentId,
              documentVersionId: documentMetadata.documentVersionId,
            },
            options
          ),
          name: formatDocumentName(
            documentMetadata.documentName || 'download',
            documentMetadata.fileType,
            { caseInsensitiveSuffix: true }
          ),
        };
      }),
  };
}
