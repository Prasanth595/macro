import { isTauri } from '@core/util/platform';
import { platformFetch } from '@core/util/platformFetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadToPresignedUrl } from './uploadToPresignedUrl';

const telemetry = vi.hoisted(() => ({
  clientSpan: vi.fn(),
  span: { setAttr: vi.fn(), error: vi.fn(), end: vi.fn() },
}));
vi.mock('@core/util/platform', () => ({ isTauri: vi.fn(() => false) }));
vi.mock('@core/util/platformFetch', () => ({ platformFetch: vi.fn() }));
vi.mock('@macro-inc/observability', () => ({
  Telemetry: { clientSpan: telemetry.clientSpan },
}));

class FakeXhr {
  static instances: FakeXhr[] = [];
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  upload = {
    onprogress: null as ((event: Partial<ProgressEvent>) => void) | null,
  };
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.());

  constructor() {
    FakeXhr.instances.push(this);
  }

  respond(status: number, responseText = ''): void {
    this.status = status;
    this.responseText = responseText;
    this.onload?.();
  }
}

const xhr = () => FakeXhr.instances[0];
const params = () => ({
  presignedUrl: 'https://bucket.example/doc?signed',
  buffer: new Uint8Array([1, 2, 3, 4]),
  sha: 'ab'.repeat(32),
  type: 'application/pdf',
});

beforeEach(() => {
  vi.resetAllMocks();
  telemetry.clientSpan.mockReturnValue(telemetry.span);
  FakeXhr.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
});
afterEach(() => vi.unstubAllGlobals());

describe('uploadToPresignedUrl with progress', () => {
  it('PUTs the signed request over XHR and reports bytes sent', async () => {
    const onProgress = vi.fn();
    const pending = uploadToPresignedUrl({ ...params(), onProgress });

    expect(xhr().open).toHaveBeenCalledWith(
      'PUT',
      'https://bucket.example/doc?signed'
    );
    expect(xhr().setRequestHeader.mock.calls).toEqual([
      ['Content-Type', 'application/pdf'],
      [
        'x-amz-checksum-sha256',
        btoa(String.fromCharCode(...new Uint8Array(32).fill(171))),
      ],
    ]);
    expect(onProgress).toHaveBeenLastCalledWith(0);

    xhr().upload.onprogress?.({ loaded: 2 });
    expect(onProgress).toHaveBeenLastCalledWith(2);

    xhr().respond(200);
    expect((await pending).isOk()).toBe(true);
    expect(onProgress).toHaveBeenLastCalledWith(4);
    expect(platformFetch).not.toHaveBeenCalled();
  });

  it('returns the response body as a server error', async () => {
    const pending = uploadToPresignedUrl({ ...params(), onProgress: vi.fn() });
    xhr().respond(403, 'SignatureDoesNotMatch');
    expect((await pending)._unsafeUnwrapErr()).toEqual([
      { code: 'SERVER_ERROR', message: 'SignatureDoesNotMatch' },
    ]);
  });

  it('returns a network error when the upload gets no response', async () => {
    const pending = uploadToPresignedUrl({ ...params(), onProgress: vi.fn() });
    xhr().onerror?.();
    expect((await pending)._unsafeUnwrapErr()[0]?.code).toBe('NETWORK_ERROR');
  });

  it('aborts with the signal and removes its listener', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = uploadToPresignedUrl({
      ...params(),
      signal: controller.signal,
      onProgress: vi.fn(),
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(xhr().abort).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('uses the native transport in Tauri and reports progress as unmeasurable', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(platformFetch).mockResolvedValue(new Response(null));
    const onProgress = vi.fn();

    const result = await uploadToPresignedUrl({ ...params(), onProgress });

    expect(result.isOk()).toBe(true);
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(null);
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('keeps using fetch when no progress is requested', async () => {
    vi.mocked(platformFetch).mockResolvedValue(new Response(null));

    expect((await uploadToPresignedUrl(params())).isOk()).toBe(true);
    expect(platformFetch).toHaveBeenCalledOnce();
    expect(FakeXhr.instances).toHaveLength(0);
  });
});

describe('uploadToPresignedUrl without progress', () => {
  it('returns a network error when fetch gets no response', async () => {
    vi.mocked(platformFetch).mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    const result = await uploadToPresignedUrl(params());

    expect(result._unsafeUnwrapErr()[0]?.code).toBe('NETWORK_ERROR');
  });

  it('rejects when the signal aborts the fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.mocked(platformFetch).mockRejectedValue(controller.signal.reason);

    await expect(
      uploadToPresignedUrl({ ...params(), signal: controller.signal })
    ).rejects.toBe(controller.signal.reason);
  });
});

describe('uploadToPresignedUrl telemetry', () => {
  it('records the S3 error code of a rejected upload, not its URL or body', async () => {
    const pending = uploadToPresignedUrl({ ...params(), onProgress: vi.fn() });
    xhr().respond(
      403,
      '<?xml version="1.0" encoding="UTF-8"?><Error><Code>SignatureDoesNotMatch</Code><Message>The request signature we calculated does not match</Message><StringToSign>AWS4-HMAC-SHA256 canonical-request-hash</StringToSign></Error>'
    );
    await pending;

    expect(telemetry.clientSpan).toHaveBeenCalledExactlyOnceWith(
      'storage.upload'
    );
    expect(Object.fromEntries(telemetry.span.setAttr.mock.calls)).toEqual({
      'upload.bytes': 4,
      'upload.error_code': 'SERVER_ERROR',
      'upload.s3_error_code': 'SignatureDoesNotMatch',
    });
    expect(telemetry.span.error).toHaveBeenCalledOnce();
    expect(telemetry.span.end).toHaveBeenCalledOnce();
    const recorded = JSON.stringify([
      telemetry.span.setAttr.mock.calls,
      telemetry.span.error.mock.calls,
    ]);
    expect(recorded).not.toContain('bucket.example');
    expect(recorded).not.toContain('canonical-request-hash');
  });

  it('records a network failure without the transport message', async () => {
    vi.mocked(platformFetch).mockRejectedValue(
      new TypeError(
        'error sending request for url (https://bucket.example/doc?signed)'
      )
    );

    await uploadToPresignedUrl(params());

    expect(Object.fromEntries(telemetry.span.setAttr.mock.calls)).toEqual({
      'upload.bytes': 4,
      'upload.error_code': 'NETWORK_ERROR',
    });
    expect(telemetry.span.error).toHaveBeenCalledOnce();
    expect(telemetry.span.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(telemetry.span.error.mock.calls)).not.toContain(
      'bucket.example'
    );
  });

  it('ends a successful upload without marking it failed', async () => {
    vi.mocked(platformFetch).mockResolvedValue(new Response(null));

    await uploadToPresignedUrl(params());

    expect(Object.fromEntries(telemetry.span.setAttr.mock.calls)).toEqual({
      'upload.bytes': 4,
    });
    expect(telemetry.span.error).not.toHaveBeenCalled();
    expect(telemetry.span.end).toHaveBeenCalledOnce();
  });

  it('ends the span when the signal aborts the upload', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.mocked(platformFetch).mockRejectedValue(controller.signal.reason);

    await expect(
      uploadToPresignedUrl({ ...params(), signal: controller.signal })
    ).rejects.toBe(controller.signal.reason);

    expect(telemetry.span.end).toHaveBeenCalledOnce();
  });
});
