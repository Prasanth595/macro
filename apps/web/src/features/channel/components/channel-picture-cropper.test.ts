import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createComponent, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChannelPictureCropper from './channel-picture-cropper';

const cropper = vi.hoisted(() => ({
  ready: vi.fn(),
  exportCanvas: vi.fn(),
  destroy: vi.fn(),
  finished: vi.fn(),
}));
vi.mock('cropperjs', () => ({
  default: class {
    canvas = { disabled: false, $toCanvas: cropper.exportCanvas };
    getCropperCanvas() {
      return this.canvas;
    }
    getCropperImage() {
      return { $ready: cropper.ready };
    }
    destroy = cropper.destroy;
  },
}));
vi.mock('@macro-inc/observability', () => ({
  Telemetry: {
    span: async (
      _name: string,
      work: (span: { setAttr: () => void; error: () => void }) => Promise<void>
    ) => {
      await work({ setAttr: vi.fn(), error: vi.fn() });
      cropper.finished();
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  cropper.ready.mockResolvedValue(document.createElement('img'));
});
afterEach(cleanup);

function exportedCanvas(blob: Blob | null) {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(blob));
  return canvas;
}

describe('channel picture crop lifecycle', () => {
  it('shows a recoverable error when the image cannot be decoded', async () => {
    cropper.ready.mockRejectedValueOnce(new Error('Invalid image'));
    const cancel = vi.fn();
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        file: new File(['invalid'], 'team.png', { type: 'image/png' }),
        disabled: false,
        onApply: vi.fn(),
        onCancel: cancel,
      })
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not read'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(cropper.exportCanvas).not.toHaveBeenCalled();
  });
  it('applies a PNG draft only after the crop finishes', async () => {
    const completed = Promise.withResolvers<void>();
    cropper.finished.mockImplementation(() => completed.resolve());
    cropper.exportCanvas.mockResolvedValue(
      exportedCanvas(new Blob(['cropped'], { type: 'image/png' }))
    );
    const apply = vi.fn();
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        file: new File(['original'], 'team.photo.jpg', { type: 'image/jpeg' }),
        disabled: false,
        onApply: apply,
        onCancel: vi.fn(),
      })
    );
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Apply crop' }));
    await completed.promise;
    expect(cropper.exportCanvas).toHaveBeenCalledWith({
      width: 1024,
      height: 1024,
    });
    expect(apply).toHaveBeenCalledOnce();
    const file: File = apply.mock.calls[0][0];
    expect(file.name).toBe('team.photo.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(7);
  });

  it('discards a completed crop after going back during export', async () => {
    const pending = Promise.withResolvers<HTMLCanvasElement>();
    const completed = Promise.withResolvers<void>();
    cropper.finished.mockImplementation(() => completed.resolve());
    cropper.exportCanvas.mockReturnValue(pending.promise);
    const apply = vi.fn();
    const view = render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        file: new File(['original'], 'team.png', { type: 'image/png' }),
        disabled: false,
        onApply: apply,
        onCancel: () => view.unmount(),
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Apply crop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    pending.resolve(exportedCanvas(new Blob(['cropped'])));
    await completed.promise;
    expect(cropper.destroy).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();
  });

  it('does not apply a crop after edit permission is lost', async () => {
    const pending = Promise.withResolvers<HTMLCanvasElement>();
    const completed = Promise.withResolvers<void>();
    cropper.finished.mockImplementation(() => completed.resolve());
    cropper.exportCanvas.mockReturnValue(pending.promise);
    const [disabled, setDisabled] = createSignal(false);
    const apply = vi.fn();
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        file: new File(['original'], 'team.png', { type: 'image/png' }),
        get disabled() {
          return disabled();
        },
        onApply: apply,
        onCancel: vi.fn(),
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Apply crop' }));
    setDisabled(true);
    pending.resolve(exportedCanvas(new Blob(['cropped'])));
    await completed.promise;
    expect(apply).not.toHaveBeenCalled();
  });

  it('keeps the crop open and allows retry when image encoding fails', async () => {
    const completed = Promise.withResolvers<void>();
    cropper.finished.mockImplementation(() => completed.resolve());
    cropper.exportCanvas.mockResolvedValue(exportedCanvas(null));
    const apply = vi.fn();
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        file: new File(['original'], 'team.png', { type: 'image/png' }),
        disabled: false,
        onApply: apply,
        onCancel: vi.fn(),
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Apply crop' }));
    await completed.promise;
    expect(screen.getByRole('alert').textContent).toContain('Could not crop');
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Apply crop' })
        .disabled
    ).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
});
