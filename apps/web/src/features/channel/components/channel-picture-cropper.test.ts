import { toast } from '@core/component/Toast/Toast';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { err, ok } from 'neverthrow';
import { createComponent, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelIdentityModal } from '../views/channel-identity-editor';
import ChannelPictureCropper from './channel-picture-cropper';

const cropper = vi.hoisted(() => ({
  ready: vi.fn(),
  exportCanvas: vi.fn(),
  destroy: vi.fn(),
  finished: vi.fn(),
  construct: vi.fn(),
  exportFullCanvas: vi.fn(),
  rotate: vi.fn(),
  move: vi.fn(),
  zoom: vi.fn(),
  transform: vi.fn<(matrix: number[]) => void>(),
  matrix: [1, 0, 0, 1, 0, 0],
}));
vi.mock('cropperjs', () => ({
  default: class {
    canvas = {
      disabled: false,
      clientWidth: 400,
      clientHeight: 400,
      getBoundingClientRect: () => ({
        x: 100,
        y: 100,
        width: 400,
        height: 400,
      }),
      $toCanvas: cropper.exportFullCanvas,
    };
    selection = {
      $toCanvas: cropper.exportCanvas,
      getBoundingClientRect: () => ({
        x: 100,
        y: 100,
        width: 400,
        height: 400,
      }),
    };
    image = Object.assign(new EventTarget(), {
      $image: document.createElement('img'),
      $ready: cropper.ready,
      $getTransform: () => cropper.matrix,
      getBoundingClientRect: () => ({
        x: -140,
        y: 60,
        width: 800,
        height: 400,
      }),
      $zoom: (amount: number, x: number, y: number) => {
        cropper.zoom(amount, x, y);
        const factor = amount > 0 ? 1 + amount : 1 / (1 - amount);
        cropper.transform([
          cropper.matrix[0] * factor,
          0,
          0,
          cropper.matrix[3] * factor,
          0,
          0,
        ]);
      },
      $setTransform: (...matrix: number[]) => {
        cropper.transform(matrix);
        return this.image;
      },
      $center: () => {
        const [a, b, c, d] = cropper.matrix;
        cropper.transform([a, b, c, d, -200, 0]);
        return this.image;
      },
      $rotate: (angle: string) => {
        cropper.rotate(angle);
        const [a, b, c, d, e, f] = cropper.matrix;
        cropper.transform([c, d, -a, -b, e, f]);
      },
      $move: cropper.move,
    });
    constructor(
      image: HTMLImageElement,
      options: { container: HTMLElement; template: string }
    ) {
      options.container.innerHTML = options.template;
      cropper.construct(image);
      Object.defineProperties(this.image.$image, {
        naturalWidth: { value: 800 },
        naturalHeight: { value: 400 },
      });
      cropper.transform.mockImplementation((matrix) => {
        this.image.dispatchEvent(new Event('transform'));
        cropper.matrix = matrix;
      });
    }
    getCropperCanvas() {
      return this.canvas;
    }
    getCropperImage() {
      return this.image;
    }
    getCropperSelection() {
      return this.selection;
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
vi.mock('@core/mobile/isMobile', () => ({ isMobile: () => false }));
vi.mock('@core/component/Toast/Toast', () => ({ toast: { failure: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  cropper.matrix = [1, 0, 0, 1, 0, 0];
  cropper.ready.mockResolvedValue(document.createElement('img'));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function exportedCanvas(blob: Blob | null) {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(blob));
  return canvas;
}

describe('channel picture crop lifecycle', () => {
  it('reports committed zoom changes from buttons, wheel transforms, and reset', async () => {
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        source: new File(['image'], 'team.png', { type: 'image/png' }),
        disabled: false,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    await screen.findByRole('button', { name: 'Save' });
    expect(screen.getByLabelText('Zoom level').textContent).toBe('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(cropper.zoom).toHaveBeenLastCalledWith(0.1, 440, 240);
    await screen.findByText('110%');
    cropper.transform([1.5, 0, 0, 1.5, 0, 0]);
    await screen.findByText('150%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(cropper.zoom).toHaveBeenLastCalledWith(-0.1, 440, 240);
    fireEvent.click(screen.getByRole('button', { name: 'Reset crop' }));
    await screen.findByText('100%');
  });

  it('rotates without changing zoom and resets rotation while keeping the crop fixed', async () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        source: new File(['image'], 'team.png', { type: 'image/png' }),
        get disabled() {
          return disabled();
        },
        onSave: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    await screen.findByRole('button', { name: 'Save' });
    expect(screen.queryByRole('button', { name: /Resize crop/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rotate image' }));
    expect(cropper.rotate).toHaveBeenCalledWith('90deg');
    await screen.findByText('100%');
    expect(cropper.matrix).toEqual([0, 1, -1, -0, -200, 0]);
    fireEvent.keyDown(screen.getByRole('group', { name: 'Crop preview' }), {
      key: 'ArrowLeft',
    });
    expect(cropper.move).toHaveBeenCalledWith(-10, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Reset crop' }));
    expect(cropper.matrix).toEqual([1, 0, 0, 1, -200, 0]);
    setDisabled(true);
    fireEvent.click(screen.getByRole('button', { name: 'Rotate image' }));
    expect(cropper.rotate).toHaveBeenCalledOnce();
  });

  it('loads a saved image with CORS and exports a PNG draft', async () => {
    const completed = Promise.withResolvers<void>();
    cropper.finished.mockImplementation(() => completed.resolve());
    cropper.exportCanvas.mockResolvedValue(
      exportedCanvas(new Blob(['cropped'], { type: 'image/png' }))
    );
    const apply = vi.fn();
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        source: 'https://files.example.com/channel.png',
        disabled: false,
        onSave: apply,
        onCancel: vi.fn(),
      })
    );
    const image: HTMLImageElement = cropper.construct.mock.calls[0][0];
    expect(image.src).toBe('https://files.example.com/channel.png');
    expect(image.crossOrigin).toBe('anonymous');
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await completed.promise;
    expect(apply.mock.calls[0][0].name).toBe('channel-picture.png');
  });

  it('shows a recoverable error when the image cannot be decoded', async () => {
    cropper.ready.mockRejectedValueOnce(new Error('Invalid image'));
    const cancel = vi.fn();
    render(() =>
      createComponent(ChannelPictureCropper, {
        channelId: 'design',
        source: new File(['invalid'], 'team.png', { type: 'image/png' }),
        disabled: false,
        onSave: vi.fn(),
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
        source: new File(['original'], 'team.photo.jpg', {
          type: 'image/jpeg',
        }),
        disabled: false,
        onSave: apply,
        onCancel: vi.fn(),
      })
    );
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await completed.promise;
    expect(cropper.exportCanvas).toHaveBeenCalledWith({
      width: 1024,
      height: 1024,
    });
    expect(cropper.exportFullCanvas).not.toHaveBeenCalled();
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
        source: new File(['original'], 'team.png', { type: 'image/png' }),
        disabled: false,
        onSave: apply,
        onCancel: () => view.unmount(),
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
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
        source: new File(['original'], 'team.png', { type: 'image/png' }),
        get disabled() {
          return disabled();
        },
        onSave: apply,
        onCancel: vi.fn(),
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
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
        source: new File(['original'], 'team.png', { type: 'image/png' }),
        disabled: false,
        onSave: apply,
        onCancel: vi.fn(),
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await completed.promise;
    expect(screen.getByRole('alert').textContent).toContain('Could not crop');
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled
    ).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('channel editor steps', () => {
  it('opens dropped images as drafts and saves GIFs only after Save', async () => {
    const close = vi.fn();
    const savePicture = vi.fn().mockResolvedValue(ok(undefined));
    render(() =>
      createComponent(ChannelIdentityModal, {
        channelId: 'design',
        name: 'Design',
        pictureLoading: false,
        canEdit: true,
        writer: { saveName: vi.fn(), savePicture },
        onClose: close,
      })
    );
    const circle = screen.getByRole('button', { name: 'Upload channel image' });
    const png = new File(['image'], 'dropped.png', { type: 'image/png' });
    fireEvent.drop(circle, {
      dataTransfer: { files: [png], items: [] },
    });
    expect(
      await screen.findByRole('heading', { name: 'dropped.png' })
    ).toBeDefined();
    await screen.findByRole('button', { name: 'Save' });
    expect(savePicture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('img', { name: 'Channel picture' })).toBeNull();
    const emptyCircle = screen.getByRole('button', {
      name: 'Upload channel image',
    });
    const gif = new File(['animation'], 'dropped.gif', { type: 'image/gif' });
    fireEvent.drop(emptyCircle, {
      dataTransfer: { files: [gif], items: [] },
    });
    expect(
      await screen.findByRole('heading', { name: 'dropped.gif' })
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(savePicture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(savePicture).toHaveBeenCalledExactlyOnceWith(gif);
  });

  it.each(['circle', 'upload'])(
    'rejects mixed and multi-image drops on the %s without accepting the first file',
    (target) => {
      render(() =>
        createComponent(ChannelIdentityModal, {
          channelId: 'design',
          name: 'Design',
          pictureUrl: 'https://files.example.com/channel.png',
          pictureLoading: false,
          canEdit: true,
          writer: { saveName: vi.fn(), savePicture: vi.fn() },
          onClose: vi.fn(),
        })
      );
      const circle = screen.getByRole('button', { name: 'Edit channel image' });
      if (target === 'upload') fireEvent.click(circle);
      const upload =
        target === 'upload'
          ? screen.getByRole('group', { name: 'Image upload' })
          : circle;
      const image = new File(['image'], 'first.png', { type: 'image/png' });
      fireEvent.drop(upload, {
        dataTransfer: {
          files: [
            image,
            new File(['text'], 'notes.txt', { type: 'text/plain' }),
          ],
          items: [],
        },
      });
      expect(toast.failure).toHaveBeenLastCalledWith(
        'Invalid attachment file(s)'
      );
      expect(screen.queryByRole('heading', { name: 'first.png' })).toBeNull();
      fireEvent.drop(upload, {
        dataTransfer: {
          files: [
            image,
            new File(['image'], 'second.png', { type: 'image/png' }),
          ],
          items: [],
        },
      });
      expect(toast.failure).toHaveBeenLastCalledWith(
        'Drop one image at a time.'
      );
      expect(screen.queryByRole('heading', { name: 'first.png' })).toBeNull();
    }
  );

  it.each(['circle', 'upload'])(
    'only shows the image drop cue for supported image drags on the %s',
    (target) => {
      render(() =>
        createComponent(ChannelIdentityModal, {
          channelId: 'design',
          name: 'Design',
          pictureUrl: 'https://files.example.com/channel.png',
          pictureLoading: false,
          canEdit: true,
          writer: { saveName: vi.fn(), savePicture: vi.fn() },
          onClose: vi.fn(),
        })
      );
      const circle = screen.getByRole('button', { name: 'Edit channel image' });
      if (target === 'upload') fireEvent.click(circle);
      const upload =
        target === 'upload'
          ? screen.getByRole('group', { name: 'Image upload' })
          : circle;
      fireEvent.dragEnter(upload, {
        dataTransfer: { items: [{ kind: 'file', type: 'text/plain' }] },
      });
      expect(screen.queryByText('Drop image here')).toBeNull();
      fireEvent.dragLeave(upload);
      fireEvent.dragEnter(upload, {
        dataTransfer: {
          items: [{ kind: 'string', type: 'text/html' }],
          types: ['text/html'],
        },
      });
      expect(screen.queryByText('Drop image here')).toBeNull();
      fireEvent.dragLeave(upload);
      fireEvent.dragEnter(upload, {
        dataTransfer: { items: [{ kind: 'file', type: '' }] },
      });
      expect(screen.queryByText('Drop image here')).toBeNull();
      fireEvent.dragLeave(upload);
      fireEvent.dragEnter(upload, {
        dataTransfer: {
          items: [
            { kind: 'file', type: 'image/png' },
            { kind: 'file', type: 'image/png' },
          ],
        },
      });
      expect(screen.queryByText('Drop image here')).toBeNull();
      fireEvent.dragLeave(upload);
      fireEvent.dragEnter(upload, {
        dataTransfer: { items: [{ kind: 'file', type: 'image/png' }] },
      });
      expect(screen.getByText('Drop image here')).toBeDefined();
    }
  );

  it.each(['circle', 'upload'])(
    'validates dropped files and blocks drops on the %s after edit permission is lost',
    async (target) => {
      const [canEdit, setCanEdit] = createSignal(true);
      const savePicture = vi.fn();
      render(() =>
        createComponent(ChannelIdentityModal, {
          channelId: 'design',
          name: 'Design',
          pictureUrl: 'https://files.example.com/channel.png',
          pictureLoading: false,
          get canEdit() {
            return canEdit();
          },
          writer: { saveName: vi.fn(), savePicture },
          onClose: vi.fn(),
        })
      );
      const circle = screen.getByRole('button', { name: 'Edit channel image' });
      if (target === 'upload') fireEvent.click(circle);
      const upload =
        target === 'upload'
          ? screen.getByRole('group', { name: 'Image upload' })
          : circle;
      fireEvent.drop(upload, {
        dataTransfer: {
          files: [new File(['text'], 'notes.txt', { type: 'text/plain' })],
          items: [],
        },
      });
      expect(toast.failure).toHaveBeenLastCalledWith(
        'Invalid attachment file(s)'
      );
      expect(screen.queryByRole('alert')).toBeNull();
      const oversized = new File(['image'], 'large.png', { type: 'image/png' });
      Object.defineProperty(oversized, 'size', { value: 16_000_001 });
      fireEvent.drop(upload, {
        dataTransfer: { files: [oversized], items: [] },
      });
      expect(screen.getByRole('alert').textContent).toBe(
        'Choose an image smaller than 16 MB'
      );
      setCanEdit(false);
      fireEvent.drop(upload, {
        dataTransfer: {
          files: [new File(['image'], 'blocked.png', { type: 'image/png' })],
          items: [],
        },
      });
      expect(screen.queryByRole('heading', { name: 'blocked.png' })).toBeNull();
      expect(savePicture).not.toHaveBeenCalled();
    }
  );
  it('opens the chooser directly from the empty circle and returns without changing the draft', async () => {
    const saveName = vi.fn();
    const savePicture = vi.fn();
    render(() =>
      createComponent(ChannelIdentityModal, {
        channelId: 'design',
        name: 'Design',
        pictureLoading: false,
        canEdit: true,
        writer: { saveName, savePicture },
        onClose: vi.fn(),
      })
    );
    fireEvent.input(screen.getByRole('textbox', { name: 'Channel name' }), {
      target: { value: 'Draft team' },
    });
    const picker = screen.getByLabelText('Choose channel picture');
    const pick = vi.spyOn(picker, 'click');
    fireEvent.click(
      screen.getByRole('button', { name: 'Upload channel image' })
    );
    expect(pick).toHaveBeenCalledOnce();
    expect(screen.queryByText('Choose an image to get started.')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Channel name' })).toBeDefined();
    fireEvent.change(picker, {
      target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] },
    });
    await screen.findByRole('button', { name: 'Save' });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Clear image' })
        .disabled
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Clear image' }));
    await screen.findByText('Choose an image to get started.');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Channel name' })
        .value
    ).toBe('Draft team');
    expect(saveName).not.toHaveBeenCalled();
    expect(savePicture).not.toHaveBeenCalled();
  });

  it('closes only the lightbox on Escape and restores its trigger', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    const close = vi.fn();
    const savePicture = vi.fn();
    render(() =>
      createComponent(ChannelIdentityModal, {
        channelId: 'design',
        name: 'Design',
        pictureUrl: 'https://files.example.com/channel.png?size=1080',
        pictureSourceUrl: 'https://files.example.com/channel.png',
        pictureLoading: false,
        canEdit: true,
        writer: { saveName: vi.fn(), savePicture },
        onClose: close,
      })
    );
    fireEvent.input(screen.getByRole('textbox', { name: 'Channel name' }), {
      target: { value: 'Draft team' },
    });
    const trigger = screen.getByRole('button', { name: 'Preview image' });
    trigger.focus();
    fireEvent.click(trigger);
    const preview = await screen.findByRole(
      'dialog',
      { name: 'Lightbox image viewer' },
      { timeout: 5000 }
    );
    expect(preview.querySelector('img')?.getAttribute('src')).toBe(
      'https://files.example.com/channel.png'
    );
    fireEvent.keyDown(preview, { key: 'Escape' });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Lightbox image viewer' })
      ).toBeNull()
    );
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Channel name' })
        .value
    ).toBe('Draft team');
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    fireEvent.click(screen.getByRole('button', { name: 'Edit channel image' }));
    await screen.findByRole('button', { name: 'Save' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:replacement');
    fireEvent.change(screen.getByLabelText('Choose channel picture'), {
      target: {
        files: [new File(['replacement'], 'new.png', { type: 'image/png' })],
      },
    });
    const imageTrigger = await screen.findByRole('button', {
      name: 'Preview image',
    });
    imageTrigger.focus();
    fireEvent.click(imageTrigger);
    const replacementPreview = await screen.findByRole('dialog', {
      name: 'Lightbox image viewer',
    });
    expect(replacementPreview.querySelector('img')?.getAttribute('src')).toBe(
      'blob:replacement'
    );
    fireEvent.keyDown(replacementPreview, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(imageTrigger));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(close).not.toHaveBeenCalled();
    expect(savePicture).not.toHaveBeenCalled();
  });

  it('reverts a replacement or cleared image without discarding name edits or writing', async () => {
    const saveName = vi.fn();
    const savePicture = vi.fn();
    render(() =>
      createComponent(ChannelIdentityModal, {
        channelId: 'design',
        name: 'Design',
        pictureUrl: 'https://files.example.com/channel.png?size=1080',
        pictureSourceUrl: 'https://files.example.com/channel.png',
        pictureFileName: 'design-team.jpg',
        pictureLoading: false,
        canEdit: true,
        writer: { saveName, savePicture },
        onClose: vi.fn(),
      })
    );
    fireEvent.input(screen.getByRole('textbox', { name: 'Channel name' }), {
      target: { value: 'Design team' },
    });
    fireEvent.change(screen.getByLabelText('Choose channel picture'), {
      target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] },
    });
    await screen.findByRole('heading', { name: 'new.png' });
    fireEvent.click(screen.getByRole('button', { name: 'Revert image' }));
    await screen.findByRole('heading', { name: 'design-team.jpg' });
    expect(cropper.construct.mock.calls.at(-1)?.[0].src).toBe(
      'https://files.example.com/channel.png'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear image' }));
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Revert image' }));
    await screen.findByRole('heading', { name: 'design-team.jpg' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Channel name' })
        .value
    ).toBe('Design team');
    expect(saveName).not.toHaveBeenCalled();
    expect(savePicture).not.toHaveBeenCalled();
  });

  it('keeps Save visible with no image and saves an image removal directly', async () => {
    const close = vi.fn();
    const savePicture = vi.fn().mockResolvedValue(ok(undefined));
    render(() =>
      createComponent(ChannelIdentityModal, {
        channelId: 'design',
        name: 'Design',
        pictureUrl: 'https://files.example.com/channel.png',
        pictureSourceUrl: 'https://files.example.com/channel.png',
        pictureLoading: false,
        canEdit: true,
        writer: { saveName: vi.fn(), savePicture },
        onClose: close,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit channel image' }));
    await screen.findByRole('button', { name: 'Save' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear image' }));
    const save = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Save',
    });
    expect(save.disabled).toBe(false);
    expect(screen.getByText('Choose an image to get started.')).toBeDefined();
    expect(savePicture).not.toHaveBeenCalled();
    fireEvent.click(save);
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(savePicture).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('retries only the name after saving a crop when renaming fails', async () => {
    cropper.exportCanvas.mockResolvedValue(
      exportedCanvas(new Blob(['cropped'], { type: 'image/png' }))
    );
    const savePicture = vi.fn().mockResolvedValue(ok(undefined));
    const saveName = vi
      .fn()
      .mockResolvedValueOnce(err({ kind: 'name' }))
      .mockResolvedValueOnce(ok(undefined));
    const close = vi.fn();
    render(() =>
      createComponent(ChannelIdentityModal, {
        channelId: 'design',
        name: 'Design',
        pictureLoading: false,
        canEdit: true,
        writer: { saveName, savePicture },
        onClose: close,
      })
    );
    fireEvent.input(screen.getByRole('textbox', { name: 'Channel name' }), {
      target: { value: 'New design' },
    });
    fireEvent.change(screen.getByLabelText('Choose channel picture'), {
      target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'picture was saved'
    );
    expect(savePicture).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(savePicture).toHaveBeenCalledOnce();
    expect(saveName).toHaveBeenCalledTimes(2);
  });

  it('retains name edits across crop steps and saves only after explicit Save', async () => {
    cropper.exportCanvas.mockResolvedValue(
      exportedCanvas(new Blob(['cropped'], { type: 'image/png' }))
    );
    const saved = Promise.withResolvers<void>();
    const saveName = vi.fn().mockImplementation(async () => {
      saved.resolve();
      return ok(undefined);
    });
    const savePicture = vi.fn().mockResolvedValue(ok(undefined));
    render(() =>
      createComponent(ChannelIdentityModal, {
        channelId: 'design',
        name: 'Design',
        pictureLoading: false,
        canEdit: true,
        writer: { saveName, savePicture },
        onClose: vi.fn(),
      })
    );
    fireEvent.input(screen.getByRole('textbox', { name: 'Channel name' }), {
      target: { value: 'Design team' },
    });
    const file = new File(['original'], 'team.png', { type: 'image/png' });
    const picker = screen.getByLabelText('Choose channel picture');
    fireEvent.change(picker, { target: { files: [file] } });
    await screen.findByRole('button', { name: 'Save' });
    expect(screen.queryByRole('textbox', { name: 'Channel name' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      (
        await screen.findByRole<HTMLInputElement>('textbox', {
          name: 'Channel name',
        })
      ).value
    ).toBe('Design team');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Upload channel image' })
    );
    expect(cropper.destroy).toHaveBeenCalledOnce();
    expect(cropper.exportCanvas).not.toHaveBeenCalled();
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savePicture).toHaveBeenCalledOnce());
    await saved.promise;
    expect(saveName).toHaveBeenCalledWith('Design team');
  });
});
