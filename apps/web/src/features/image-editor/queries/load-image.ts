import { Telemetry } from '@macro-inc/observability';
import { fetchBinary } from '@service-storage/util/fetchBinary';
import { err, ok, ResultAsync } from 'neverthrow';

/** Inspect the bytes, not the URL or MIME header: saved files can have neither. */
export async function loadImage(
  url: string,
  signal: AbortSignal,
  telemetryAttributes: Record<string, string> = {}
) {
  return Telemetry.span('image.load', async (span) => {
    for (const [key, value] of Object.entries(telemetryAttributes))
      span.setAttr(key, value);
    const result = await fetchBinary(url, 'blob', {
      signal,
      credentials: 'omit',
    });
    if (result.isErr()) {
      span.error('Image load failed');
      return err(
        'Could not read this image. Choose another image or try again.'
      );
    }
    const blob = result.value;
    const header = await ResultAsync.fromPromise(
      blob.slice(0, 6).text(),
      () => 'Could not read this image. Choose another image or try again.'
    );
    if (header.isErr()) {
      span.error('Image type detection failed');
      return err(header.error);
    }
    const animated = header.value === 'GIF87a' || header.value === 'GIF89a';
    span.setAttr('image.input_bytes', blob.size);
    span.setAttr('image.animated', animated);
    return ok({ url, blob, animated });
  });
}
