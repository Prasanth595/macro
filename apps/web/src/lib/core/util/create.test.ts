import { ok } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  platformFetch: vi.fn(),
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
vi.mock('@core/util/platformFetch', () => ({
  platformFetch: mocks.platformFetch,
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
    mocks.platformFetch.mockResolvedValue(
      new Response('<Code>AccessDenied</Code>', { status: 403 })
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

  it('deletes the created document when the content upload gets no response', async () => {
    mocks.platformFetch.mockRejectedValue(new TypeError('Failed to fetch'));

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
    mocks.platformFetch.mockResolvedValue(new Response(null));

    const result = await createCodeFileFromText({
      code: 'print("Hello, World!")',
      extension: 'py',
      title: 'New Code File',
    });

    expect(result._unsafeUnwrap()).toEqual({ documentId: 'code-doc' });
    expect(mocks.deleteDocument).not.toHaveBeenCalled();
  });
});
