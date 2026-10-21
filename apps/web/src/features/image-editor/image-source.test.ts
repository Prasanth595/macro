import { Blob as NodeBlob } from 'node:buffer';
import { fetchBinary } from '@service-storage/util/fetchBinary';
import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { err, ok, type Result } from 'neverthrow';
import { createComponent, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImagePreview } from './primitives/create-image-preview';
import { loadImage } from './queries/load-image';
import { ImageEditor } from './views/image-editor';

const cropper = vi.hoisted(() => vi.fn());
vi.mock('@service-storage/util/fetchBinary', () => ({ fetchBinary: vi.fn() }));
vi.mock('@core/component/Toast/Toast', () => ({ toast: { failure: vi.fn() } }));
vi.mock('./components/image-cropper', () => ({
  default: (props: { source: File | string }) => {
    cropper(props.source);
    const element = document.createElement('div');
    element.textContent = 'Crop workspace';
    return element;
  },
}));
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.clearAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:loaded-image');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('saved image format detection', () => {
  it.each(['GIF87a', 'GIF89a'])(
    'recognizes %s even with a misleading MIME type',
    async (signature) => {
      const blob = new Blob([signature + 'image'], { type: 'image/png' });
      vi.mocked(fetchBinary).mockResolvedValueOnce(ok(blob));
      const result = await loadImage(
        'https://files.test/opaque-id',
        new AbortController().signal
      );
      expect(result.isOk() && result.value.animated).toBe(true);
      expect(result.isOk() && result.value.blob).toBe(blob);
    }
  );

  it('waits for saved GIF detection without mounting the cropper', async () => {
    const response = Promise.withResolvers<Result<Blob, never>>();
    vi.mocked(fetchBinary).mockReturnValueOnce(response.promise);
    render(() =>
      createComponent(ImageEditor, {
        source: 'https://files.test/opaque-id',
        pictureUrl: 'https://files.test/opaque-id',
        disabled: false,
        canSave: false,
        hasImageDraft: false,
        preview: createImagePreview(),
        onSelect: vi.fn(),
        onClear: vi.fn(),
        onSave: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    expect(screen.getByText('Loading image editor…')).toBeDefined();
    expect(cropper).not.toHaveBeenCalled();
    response.resolve(ok(new Blob(['GIF89aimage'])));
    await screen.findByText('Animated images are kept as uploaded.');
    expect(cropper).not.toHaveBeenCalled();
    expect(screen.queryByText('Crop workspace')).toBeNull();
  });

  it('uses fetched still-image bytes rather than requesting the source again', async () => {
    const blob = new Blob(['png image bytes'], { type: 'image/png' });
    vi.mocked(fetchBinary).mockResolvedValueOnce(ok(blob));
    render(() =>
      createComponent(ImageEditor, {
        source: 'https://files.test/still-id',
        pictureUrl: 'https://files.test/still-id',
        disabled: false,
        canSave: false,
        hasImageDraft: false,
        preview: createImagePreview(),
        onSelect: vi.fn(),
        onClear: vi.fn(),
        onSave: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    await screen.findByText('Crop workspace');
    expect(cropper).toHaveBeenCalledExactlyOnceWith('blob:loaded-image');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(fetchBinary).toHaveBeenCalledOnce();
  });

  it.each(['replace', 'clear'])(
    'aborts the old GIF read after %s and ignores its late response',
    async (action) => {
      const response = Promise.withResolvers<Result<Blob, never>>();
      vi.mocked(fetchBinary).mockReturnValueOnce(response.promise);
      const [source, setSource] = createSignal<File | string | undefined>(
        'https://files.test/old-image'
      );
      render(() =>
        createComponent(ImageEditor, {
          get source() {
            return source();
          },
          disabled: false,
          canSave: false,
          hasImageDraft: false,
          preview: createImagePreview(),
          onSelect: vi.fn(),
          onClear: vi.fn(),
          onSave: vi.fn(),
          onCancel: vi.fn(),
        })
      );
      await waitFor(() => expect(fetchBinary).toHaveBeenCalledOnce());
      const signal = vi.mocked(fetchBinary).mock.calls[0][2]?.signal;
      const file = new File(['image'], 'replacement.png', {
        type: 'image/png',
      });
      setSource(action === 'replace' ? file : undefined);
      if (action === 'replace') await screen.findByText('Crop workspace');
      else await screen.findByText('Choose an image to get started.');
      expect(signal?.aborted).toBe(true);
      response.resolve(ok(new Blob(['GIF89aimage'])));
      await response.promise;
      if (action === 'replace')
        expect(cropper).toHaveBeenCalledExactlyOnceWith(file);
      else expect(cropper).not.toHaveBeenCalled();
      expect(
        screen.queryByText('Animated images are kept as uploaded.')
      ).toBeNull();
    }
  );

  it('keeps cropping unavailable when the saved format cannot be read', async () => {
    vi.mocked(fetchBinary).mockResolvedValueOnce(
      err([{ code: 'NETWORK_ERROR', message: 'offline' }])
    );
    render(() =>
      createComponent(ImageEditor, {
        source: 'https://files.test/unknown-image',
        pictureUrl: 'https://files.test/unknown-image',
        disabled: false,
        canSave: false,
        hasImageDraft: false,
        preview: createImagePreview(),
        onSelect: vi.fn(),
        onClear: vi.fn(),
        onSave: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not read'
    );
    expect(cropper).not.toHaveBeenCalled();
  });
});
