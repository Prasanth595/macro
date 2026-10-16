import { platformFetch } from '@core/util/platformFetch';
import { afterEach, expect, it, vi } from 'vitest';
import { staticFileClient } from './client';

vi.mock('@core/constant/servers', () => ({
  SERVER_HOSTS: { 'static-file': 'https://static-file-service-dev.macro.com' },
}));
vi.mock('@core/util/fetchWithToken', () => ({ fetchWithToken: vi.fn() }));
vi.mock('@core/util/platformFetch', () => ({ platformFetch: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  [
    'true',
    'https://coworker:5122/__macro_dev/static-upload/file.png?X-Amz-Signature=fixture',
  ],
  [
    'false',
    'https://static-file-storage-dev.s3.us-east-1.amazonaws.com/file.png?X-Amz-Signature=fixture',
  ],
])(
  'uploads static files using the configured proxy mode %s',
  async (proxyMode, uploadUrl) => {
    vi.stubEnv('VITE_DEV_PROXY', proxyMode);
    vi.stubGlobal('location', { origin: 'https://coworker:5122' });
    vi.mocked(platformFetch).mockResolvedValue(
      new Response(null, { status: 200 })
    );
    const url =
      'https://static-file-storage-dev.s3.us-east-1.amazonaws.com/file.png?X-Amz-Signature=fixture';
    const blob = new Blob(['image bytes'], { type: 'image/png' });

    expect(
      await staticFileClient.uploadToPresignedUrl({
        url,
        blob,
        contentType: 'image/png',
      })
    ).toEqual({ success: true });
    expect(platformFetch).toHaveBeenCalledExactlyOnceWith(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/png' },
    });
  }
);

it('reports an upstream upload failure without changing the request body', async () => {
  vi.stubEnv('VITE_DEV_PROXY', 'true');
  vi.mocked(platformFetch).mockResolvedValue(
    new Response(null, { status: 403 })
  );
  const blob = new Blob(['image bytes']);
  expect(
    await staticFileClient.uploadToPresignedUrl({
      url: 'https://unrelated.example/file',
      blob,
    })
  ).toEqual({ success: false });
  expect(platformFetch).toHaveBeenCalledExactlyOnceWith(
    'https://unrelated.example/file',
    {
      method: 'PUT',
      body: blob,
      headers: {},
    }
  );
});
