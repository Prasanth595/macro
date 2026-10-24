import { err, ok } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
}));
vi.mock('@app/lib/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('@queries/auth', () => ({ invalidateUserQuota: async () => {} }));
vi.mock('@queries/history/history', () => ({
  postNewHistoryItem: async () => {},
}));
vi.mock('@queries/preview/preview', () => ({ setPreviewOnCreate: vi.fn() }));
vi.mock('@queries/soup/cache', () => ({ refetchSoupEntity: async () => {} }));
vi.mock('@service-storage/client', () => ({
  storageServiceClient: {
    createDocument: mocks.createDocument,
    deleteDocument: mocks.deleteDocument,
  },
}));
vi.mock('@service-storage/util/uploadToPresignedUrl', () => ({
  uploadToPresignedUrl: mocks.uploadToPresignedUrl,
}));

import { createCodeFileFromText } from './create';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createDocument.mockResolvedValue(
    ok({
      metadata: { documentId: 'code-doc', documentVersionId: 1 },
      presignedUrl: 'https://s3.example.com/code-doc',
    })
  );
  mocks.deleteDocument.mockResolvedValue(ok({ success: true }));
});

describe('createCodeFileFromText', () => {
  it('deletes the created document when the content upload fails', async () => {
    mocks.uploadToPresignedUrl.mockResolvedValue(
      err([{ code: 'SERVER_ERROR', message: '<Code>AccessDenied</Code>' }])
    );

    const result = await createCodeFileFromText({
      code: 'print("Hello, World!")',
      extension: 'py',
      title: 'New Code File',
    });

    expect(result.isErr()).toBe(true);
    expect(mocks.deleteDocument).toHaveBeenCalledWith({
      documentId: 'code-doc',
    });
  });

  it('keeps the created document when the content upload succeeds', async () => {
    mocks.uploadToPresignedUrl.mockResolvedValue(ok(undefined));

    const result = await createCodeFileFromText({
      code: 'print("Hello, World!")',
      extension: 'py',
      title: 'New Code File',
    });

    expect(result._unsafeUnwrap()).toEqual({ documentId: 'code-doc' });
    expect(mocks.deleteDocument).not.toHaveBeenCalled();
  });
});
