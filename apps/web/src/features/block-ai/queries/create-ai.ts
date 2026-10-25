/**
 * Creating a new Illustrator document: one empty artboard.
 */

import { analytics } from '@app/lib/analytics';
import { runInDocumentSpan } from '@block-md/observability';
import { AiEngine } from '@core/ai-engine/client';
import { fireAndForget } from '@core/util/fireAndForget';
import { contentHash } from '@core/util/hash';
import { type Span, Telemetry } from '@macro-inc/observability';
import { invalidateUserQuota } from '@queries/auth';
import { postNewHistoryItem } from '@queries/history/history';
import { setPreviewOnCreate } from '@queries/preview/preview';
import { refetchSoupEntity } from '@queries/soup/cache';
import { storageServiceClient } from '@service-storage/client';
import { uploadToPresignedUrl } from '@service-storage/util/uploadToPresignedUrl';
import { NEW_ARTBOARD } from '../core/new-document';
import { AI_MIME } from '../definition';

export async function createAiDocument(args: {
  title?: string;
  projectId?: string;
  /** UI surface the creation originated from, for analytics. */
  source?: string;
  /** Parent of the create, upload, and cleanup requests. */
  span?: Span;
}): Promise<string | undefined> {
  const title = args.title ?? 'Untitled illustration';
  const bytes = await AiEngine.blank(NEW_ARTBOARD.width, NEW_ARTBOARD.height);
  const sha = await contentHash(bytes);
  const created = await runInDocumentSpan(args.span, () =>
    storageServiceClient.createDocument({
      documentName: title,
      fileType: 'ai',
      sha,
      projectId: args.projectId,
    })
  );
  fireAndForget(invalidateUserQuota(), 'create-ai-document');
  if (created.isErr()) return undefined;
  const doc = created.value;
  const documentId = doc.metadata.documentId;
  const upload = await runInDocumentSpan(args.span, () =>
    uploadToPresignedUrl({
      presignedUrl: doc.presignedUrl,
      buffer: bytes,
      sha,
      type: AI_MIME,
    })
  );
  if (upload.isErr()) {
    await runInDocumentSpan(args.span, () =>
      storageServiceClient.deleteDocument({ documentId })
    );
    return undefined;
  }
  fireAndForget(
    postNewHistoryItem('document', documentId),
    'create-ai-document'
  );
  setPreviewOnCreate({
    itemId: documentId,
    itemType: 'document',
    name: title,
    fileType: 'ai',
  });
  refetchSoupEntity(documentId, 'document', {
    ownTouch: true,
    refreshGraphql: true,
  }).catch((error) =>
    Telemetry.error(error, { surface: 'create-ai-document' })
  );
  analytics.track('create_entity', {
    entityType: 'ai',
    entityId: documentId,
    projectId: args.projectId,
    source: args.source,
  });
  return documentId;
}
